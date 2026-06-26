# Tanzo 子代理系统重构设计文档

> 状态：设计草案（未实施）
> 日期：2026-06-23
> 范围：本文档仅记录设计方案，不包含任何代码改动。是否实施、按什么节奏实施，需要单独评审和排期。

---

## 1. 背景

当前子代理系统把子代理当作"调用即执行的黑盒工具"来实现：每个子代理是一个独立的 conversation，通过 `subagent` 工具同步（foreground）或异步（background）调用，审批请求跨 conversation 路由到根对话。

这套设计在用户心智和 Agent 业务逻辑两侧都存在结构性问题。

### 1.1 现有实现要点

- 子代理通过 `src/main/agent/subagent/subagent.ts` 的 `subagent` 工具创建，本质是 spawn 一个新的 conversation。
- Foreground 模式：`subagent.ts` 中用 `for (;;) { await iterator.next() }` 同步阻塞，直到子代理结束。
- Background 模式：子代理结束后，`coordinator.ts` 主动向父 conversation 注入一条 `role: 'user'` 的消息（`[subagent ${childChatId} ${status}] ...`），强制打断主 agent 当前 turn。
- 任务 ID 是 `randomUUID()`，无语义、不可读、用户在 UI 上直接看到裸 UUID（`subagent-result-message.tsx` 第 41 行）。
- 审批请求通过 `approval-broker` 跨 conversation 路由：子 conversation 触发审批 → 路由到根对话 → 用户决策 → 路由回子对话。
- 三种内置子代理类型：`explore`、`verify`、`review`，定义在 `src/main/agent/builtin-agents/*.md`。
- Plan mode 下，`registry.ts` 的 `isSafeReadOnlySubagent` 会过滤掉非只读子代理类型，但这个过滤结果不会体现在工具描述里，主 agent 只能"调用后失败"才发现。

### 1.2 用户心智侧问题（按优先级）

| 优先级 | 问题 | 影响 |
|---|---|---|
| P0 | 审批卡缺少父任务上下文（目标是什么、为什么要做这件事） | 用户无法做出有信息支撑的审批决策 |
| P0 | 结果消息暴露裸 UUID（`childChatId`） | 对用户毫无意义，无法引用、无法记忆 |
| P1 | 前台 / 后台模式在 UI 上无视觉区分 | 用户分不清当前任务是阻塞的还是后台跑的 |
| P1 | 缺少全局进度总览，只有逐条 shimmer 动画 | 多任务并行时用户无法一目了然 |
| P2 | 失败后没有重试路径 | 只能重新发起一次完整请求 |
| P2 | 审批时看不到子代理的能力边界（允许哪些工具） | 审批决策缺少关键信息 |

### 1.3 Agent 业务逻辑侧问题

1. Prompt 创建后不可变，无法在执行中迭代任务定义。
2. Foreground 模式阻塞主 agent 当前 turn，期间无法处理审批之外的任何事。
3. Background 完成通知是"推"模式，强制注入消息打断主 agent 的控制流。
4. 子代理深度限制（`maxSubagentDepth`）达到后直接硬切断，没有向上转交（escalate）机制。
5. Plan mode 工具过滤不透明，主 agent 看不到"为什么这个工具消失了"。
6. Trace entry 只记录工具名，没有语义信息（比如"正在搜索配置文件"）。
7. 审批被拒绝后没有结构化反馈，子代理不知道该换一种方式重试还是放弃。
8. 子代理之间没有共享状态机制，并行任务经常重复做相同的探索工作。

---

## 2. 设计目标

把子代理从"黑盒工具调用"重构为"可观察、可干预的一等任务对象"，核心诉求：

- 用户能看懂任务在做什么、为什么需要审批、做到哪一步了。
- Agent 能并发调度任务、声明依赖、动态调整目标，而不是被同步阻塞或被异步打断。
- 任务身份可读、可引用（不是裸 UUID）。
- 审批决策有上下文，拒绝有结构化反馈。

---

## 3. 核心理念：子代理是协程，不是工具

主 agent 不是"调用"子代理，而是 **spawn 一个协程**，协程与主协程并发执行，通过任务状态和消息通道通信。

### 3.1 领域模型：ExecutionGraph

用单一 `ExecutionGraph` 取代当前的 conversation 父子树：

```typescript
interface ExecutionGraph {
  rootChatId: string
  timeline: Message[]                  // 所有消息按时间排列，用 executorId 区分来源
  executors: Map<string, Executor>     // 主 agent + 所有子代理
  tasks: Map<string, Task>             // 任务对象
  channels: Map<string, Channel>       // executor 间消息通道
}

interface Message {
  id: string
  executorId: string
  role: 'user' | 'assistant'
  parts: Part[]
  timestamp: number
}

interface Executor {
  id: string                     // "main" | "explore-1" | "verify-2"
  type: 'main-agent' | 'subagent'
  agentType?: string
  status: 'idle' | 'running' | 'paused' | 'done' | 'failed'
  visibleMessages: string[]      // 这个 executor 可见的消息 id 范围
  currentTask?: string
  abortController?: AbortController
}

interface Task {
  id: string                     // "explore-1" 格式
  executorId: string
  objective: string
  status: 'pending' | 'running' | 'blocked' | 'done' | 'failed'
  dependsOn: string[]
  blockedBy?: { type: 'approval' | 'dependency', detail: string }
  result?: { summary: string; artifacts: Map<string, unknown> }
  phases: Array<{ name: string; status: 'done' | 'running'; timestamp: number }>
  createdAt: number
  startedAt?: number
  completedAt?: number
}

interface Channel {
  id: string
  from: string
  to: string
  messages: unknown[]
}
```

**relative 于现状的关键改变：**

- 所有消息进同一个 `timeline`，用 `executorId` 区分"谁说的"，不再是分裂的 conversation 树。
- `Executor` 是轻量对象，只记录状态和可见消息范围，不是完整的 conversation。
- `Task` 是一等对象：有依赖（`dependsOn`）、阻塞原因（`blockedBy`）、阶段性进度（`phases`）、结构化结果（`result`）。
- `Channel` 支持子代理之间直接通信，解决"并行任务重复探索"的问题。

### 3.2 TaskId 策略

按类型递增编号：`explore-1`、`verify-2`、`review-3`。

- 可读、可在对话中直接引用("看下 explore-1 的结果")。
- 不用 hash（4 位十六进制只有 6.5 万种组合，碰撞风险且无时序信息）。

---

## 4. 工具接口设计

### 4.1 任务生命周期

```typescript
spawn({ objective, agent, priority?, deps? }) → { task: string }
start({ task }) → { started: true }                    // 可选，默认 spawn 后自动启动
inspect({ task }) → Task
tasks({ status?, executor? }) → Task[]
await({ task }) → { result: TaskResult }
awaitAny({ tasks: string[] }) → { task: string, result: TaskResult }
awaitAll({ tasks: string[] }) → { results: Map<string, TaskResult> }
```

### 4.2 任务控制

```typescript
redefine({ task, objective }) → { redefined: true }    // 替换目标，任务重启
instruct({ task, instruction }) → { instructed: true } // 追加指令，不重启
pause({ task }) → { paused: true }
resume({ task }) → { resumed: true }
cancel({ task }) → { cancelled: true }
merge({ tasks: string[], objective }) → { task: string } // 高级：合并多任务
```

`redefine` 和 `instruct` 分离是为了消除现状里"updateObjective 到底是替换还是追加"的语义歧义。

### 4.3 消息通道（executor 间通信，高级场景）

```typescript
send({ to, message }) → { sent: true }                 // 非阻塞
receive({ from?, timeout? }) → { from: string, message: unknown }  // 阻塞
channel({ from, to }) → { pending: number }
```

### 4.4 审批

废弃跨 conversation 路由的 `approval-broker`，把审批变成 Task 的阻塞状态：

```typescript
interface Task {
  // ...
  blockedBy?: {
    type: 'approval'
    approvals: Array<{
      id: string
      executorId: string
      toolName: string
      input: unknown
      reason?: string
    }>
  }
}

approvals({ task? }) → Approval[]
approve({ approvalId, reason?, scope?: 'once' | 'session' | 'forever' }) → { approved: true }
deny({ approvalId, reason?, suggestion?: { type: string; detail?: string } }) → { denied: true }
approveAll({ task, scope? }) → { count: number }
```

主 agent 可以直接调用 `approve` / `deny`（如果有授权策略），不必每次都等用户；UI 上用户的审批操作底层调用同一套工具，不再走单独的跨对话协议。

### 4.5 子代理内部工具

```typescript
reportPhase(phase: string) → void                      // 声明当前在做什么
submitResult({ summary, findings, artifacts? }) → void // 结构化提交结果
publishArtifact({ type, data }) → void                  // 产出可被其他任务引用的结构化数据
getTaskArtifact({ task, type }) → unknown                // 消费依赖任务的产出
createCheckpoint({ label }) → { checkpointId: string }
```

---

## 5. 典型场景

### 5.1 并行搜索

```typescript
spawn({ objective: "搜索 src/main/agent", agent: "explore" })   // → explore-1
spawn({ objective: "搜索 src/renderer", agent: "explore" })     // → explore-2
spawn({ objective: "搜索 tests/", agent: "explore" })           // → explore-3
awaitAll({ tasks: ["explore-1", "explore-2", "explore-3"] })
```

三个 executor 并发运行（受并发池限制），主 agent 在 `awaitAll` 处等待，任一子任务失败不影响其他。

### 5.2 流水线（依赖声明）

```typescript
spawn({ objective: "搜索 subagent 相关代码", agent: "explore" })  // → explore-1
spawn({
  objective: "验证 explore-1 找到的文件的测试",
  agent: "verify",
  deps: ["explore-1"]
})  // → verify-2，状态为 blocked（dependency）
await({ task: "verify-2" })
```

`explore-1` 完成后，`verify-2` 自动从 `blocked` 转为 `running`；`verify-2` 可以用 `getTaskArtifact({ task: "explore-1" })` 拿到上游产出。

### 5.3 动态调整

```typescript
spawn({ objective: "运行所有测试", agent: "verify" })  // → verify-1
pause({ task: "verify-1" })
// ... 主 agent 修复环境 ...
resume({ task: "verify-1" })
await({ task: "verify-1" })
```

### 5.4 子任务间协作（高级）

```typescript
spawn({ objective: "搜索配置文件", agent: "explore" })  // → explore-1
spawn({ objective: "搜索测试文件，参考 explore-1 的结果", agent: "explore" })  // → explore-2

// explore-1 内部找到关键文件后：
send({ to: "explore-2", message: { type: "found-config", files: [...] } })
// explore-2 内部：
receive({ from: "explore-1", timeout: 30000 })
```

---

## 6. 系统提示设计要点

### 6.1 主 agent

需要引入"并发任务"心智：`spawn` 立即返回不阻塞，`await` / `awaitAny` / `awaitAll` 显式声明等待意图，鼓励"识别独立任务 → 并行 spawn → 统一收集"的模式，而不是逐个同步调用。

### 6.2 子代理

需要引入"汇报"心智：开始主要步骤前调用 `reportPhase`，结束时用 `submitResult` 结构化提交而不是裸文本；如果目标涉及与其他任务协作，才需要用到 `send` / `receive`。

---

## 7. 数据层改造方向

废弃 `conversations` 表的父子树结构，改为：

- `execution_graphs`：每个根对话对应一个 graph。
- `messages`：归属某个 `graph_id`，用 `executor_id` 区分来源，取代分裂的多个 conversation。
- `executors`：graph 内的执行单元（主 agent + 子代理），轻量状态记录。
- `tasks`：一等任务对象，含依赖、阻塞原因、结果、阶段。
- `channels`：executor 间消息通道。

（具体字段见本文档第 3.1 节的 TypeScript 接口定义，DB schema 与之对应。）

---

## 8. UI 改造方向

- **任务面板**：替代现状的逐条 shimmer 动画，按 Running / Done 分组展示所有任务及进度阶段。
- **ExecutionGraph 视图**：Timeline（按 executor 过滤的消息流）+ Tasks（依赖关系列表）+ Approvals（统一审批队列）+ Graph（DAG 可视化）。
- **审批卡**：增加任务目标、能力边界（允许的工具）展示；拒绝时提供结构化二级选项（换方式 / 改命令 / 跳过 / 终止）。
- **批量审批**：同一任务下连续的同类审批合并展示，支持"全部批准"。

---

## 9. 与现状的对比

| 维度 | 现状 | 本方案 |
|---|---|---|
| 心智模型 | 工具调用 | 协程并发 |
| 任务可见性 | 隐式状态，UUID | 一等对象，可读 ID |
| 并发控制 | 前台阻塞 / 后台强制打断 | 显式 await / awaitAny / awaitAll |
| 依赖管理 | 无 | DAG 依赖声明，自动解锁 |
| 任务间协作 | 无 | 消息通道（send/receive） |
| 审批流 | 跨 conversation 路由 | Task 的阻塞状态，统一工具 |
| 上下文共享 | 无 | Artifacts + 全局 timeline |
| 数据结构 | conversation 父子树 | ExecutionGraph（graph/executor/task/channel） |

---

## 10. 主要风险

| 风险 | 说明 | 缓解方向 |
|---|---|---|
| 学习曲线 | 新概念多（task / executor / channel） | 分层暴露：基础场景只需 `spawn` + `await`，`send`/`receive` 等高级工具按需开放 |
| 内存占用 | ExecutionGraph 持有全量 timeline | 旧消息定期 compact，`visibleMessages` 用 lazy loading |
| DAG 调试难度 | 任务依赖关系复杂后难排查 | UI 提供"从任一节点重放"功能 |
| 与现有 goal / compaction 机制冲突 | goal 目前是 conversation 级别 | 改为 graph 级别；compaction 仅压缩主 executor 的消息 |
| 数据迁移 | 现有 conversation 树数据如何迁移到 ExecutionGraph | 需要专门的迁移方案，本文档未覆盖，需后续单独评审 |
| 实施规模 | 涉及 DB schema、coordinator、registry、approval-broker、多个 UI 组件的全面替换 | 需要拆分为可独立验证的阶段，而不是单次大爆炸式上线 |

---

## 11. 本文档不包含的内容

为保持文档聚焦于设计本身，以下内容留待实施阶段单独制定：

- 具体的实施阶段拆分和排期。
- 现有 `conversations` 表数据到 `execution_graphs` 的迁移脚本和回滚方案。
- 新旧工具集并存期间的兼容性细节（如果选择渐进式上线）。
- 每个改动文件的具体 diff。

本文档的目的是把"彻底重构"的方案完整落盘、可评审、可讨论，是否进入实施、以什么节奏实施，需要在评审后单独决定。
