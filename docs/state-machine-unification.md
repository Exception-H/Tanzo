# Tanzo Agent 运行时状态机统一设计文档

> 状态：已实施（阶段 0–3 完成；阶段 4 仅合并续跑上限常量，DriverLoop 合并按风险评估暂缓；阶段 5 文档更新完成）
> 日期：2026-06-24
> 范围：`src/main/agent/runtime/*`、`src/main/agent/goal/*`、`src/main/agent/subagent/*` 中所有承载状态的模块。
> 前置阅读：`docs/architecture/10-agent-runtime.md`、`docs/compaction-redesign.md`、`docs/subagent-redesign.md`。
> 目标：把当前分散在多个模块、用布尔标志 / `for(;;)` 循环 / 分散赋值实现的隐式状态机，收敛为**若干个独立但遵循同一套规范**的显式状态机。

---

## 1. 背景与问题

Agent 运行时里有大量"状态"，但它们用三种互不相同的方式表达：

1. **布尔标志 + 命令式循环**：`turn-loop.ts` 的 `run()` 用 `for (let pass = 0; ; pass += 1)` 加 `pendingTerminal / planExitPasses / forceExitPlanMode / forceCompactionOnPrepare` 四个标志驱动续跑（`turn-loop.ts:263-394`）。`task-service.ts` 的 `runTask()` 同构地用 `forceCompaction / continuationPasses` 加 `for(;;)`（`task-service.ts:297-396`）。
2. **派生状态 + 分散转移**：`goal/service.ts` 的真实状态由 `deriveStatus(outcome, limit, userState)` 派生（`goal.ts:37-43`），但设置这些字段的逻辑散落在 `create / updateObjective / setUserState / markOutcome / markUsageLimited / evaluate` 六个方法里，每个各自 `patch` 一组字段。
3. **显式状态字段 + 散落赋值**：`subagent-task.ts` 的 `status` 是显式的 6 态联合（`subagent-task.ts:5`），但转移动作（`{...task, status: 'x'}` + `delete task.block` + `persist`）重复出现在 `spawn / startDriver / failTask / completeTask / surfaceApprovals / clearApprovalBlock / cancel / instruct / redefine / retry / cancelTree` 等 10+ 处。

由此产生的具体债务：

- **决策逻辑被切成两段**：一个 turn 结束后"下一步做什么"被拆在 `turn-loop.ts`（plan-exit 续跑、compaction 续跑、post-compact）和 `turn-finalizer.ts`（清 steering、派发排队消息、goal 续跑）两个文件，用 `continue` 和异步派发两种机制。
- **"改标志再调一次"的协调**：`turnFinalizer.finish` 在每个 run 的 `onFinally` 调一次（`turn-loop.ts:185`），但当 `hitCompactionTrigger` 为真时 finalizer 直接 early-return 跳过派发（`turn-finalizer.ts:46`）；turn-loop 随后在另一分支用 `{ ...state, hitCompactionTrigger: false }` **再调一次** finalizer 补上派发（`turn-loop.ts:379-386`）。这是隐式状态机复杂度外溢的典型症状。
- **合法性靠分散守卫**：goal 的"complete 之后不应再 evaluate""paused 时不续跑"靠散落的 `if (goal.outcome) return` / `if (goal.userState !== 'active')` 守卫（`goal/service.ts:158`），容易漏。
- **转移副作用重复**：task 的"进入终态要 `delete block` + `persist` + `notifySettled`"在每个终态函数里手抄一遍，新增状态极易遗漏某一步。

**本文主张**：不把它们合并成一个巨型状态机（那会把不同抽象层揉在一起），而是让每个有状态的模块**各自成为一个独立状态机**，并全部遵循**同一套规范**——统一的类型形状、命名、纯转移函数、副作用解释器、持久化映射、非法转移语义和测试范式。

---

## 2. 现状盘点（已核对代码）

把所有"持有跨调用状态"的模块分三类，明确各自是否应 FSM 化。

### 2.1 一类：真正的状态机（应显式化）

| 模块 | 当前状态表达 | 状态数 | 转移分散度 | 文件 |
|---|---|---|---|---|
| **TurnLoop** | `for(;;)` + 4 个布尔标志 | 隐式 ~5 态 | 高（含双重 finalizer） | `turn-loop.ts` |
| **Goal** | `deriveStatus` 派生 + 散落 patch | 显式 6 态 | 中（6 方法） | `goal/service.ts`, `goal.ts` |
| **SubagentTask** | `status` 字段 + 散落赋值 | 显式 6 态 | 高（10+ 处） | `task-service.ts`, `subagent-task.ts` |

补充：TurnLoop 与 SubagentTask 内部各自还套了一个**驱动子循环**（prepare → stream → decide），两者高度同构（都处理 compaction 续跑、supersede/abort 检测），是统一规范后可共享抽象的重点。

### 2.2 二类：轻量状态载体（部分符合规范即可）

| 模块 | 状态 | 性质 | 文件 |
|---|---|---|---|
| **RunSession** | `running → finished/failed/aborted` | 每个 run 的投影 + delta 合并缓冲 | `run-session-registry.ts:344` |
| **QuestionBroker** | `pending → resolved/rejected` | Promise 包装的叶子异步 | `question/broker.ts` |

这两者的"状态"是单向、无分支的线性生命周期，不存在复杂转移图。规范化只要求它们**遵守命名与终态约定**，不要求拆出纯 reducer。

### 2.3 三类：并发原语（明确排除，不 FSM 化）

| 模块 | 性质 | 为什么不是状态机 |
|---|---|---|
| **RunEngine** | 按 chatId 的 mutex + abort + epoch/cancelGen 计数 | 五张 Map 互相正交，`preparing` 与 `inflight` 可叠加（`run-engine.ts:196`），epoch/cancelGen 是计数器不是状态。强行 enum 化要引入组合状态，更复杂。 |
| **ChatMailbox** | 按 chatId 的 FIFO 串行器 | 纯执行基座（`chat-mailbox.ts`），无领域语义。 |
| **RunPersistenceRegistry** | 消息合并累加器 | 是 registry + 纯合并函数（`run-persistence-registry.ts`），无状态转移图。 |

> **关键边界**：RunEngine / Mailbox 是**执行基座（imperative shell 的底座）**，三类一类的 FSM 是**领域逻辑（functional core）**。统一规范的本质就是把后者从前者里提纯出来。

---

## 3. 统一规范（核心）

所有一类状态机遵循同一套形状：**纯转移函数（functional core）+ 副作用解释器（imperative shell）**。

### 3.1 类型契约

```ts
// src/main/agent/runtime/machine/types.ts  (新增)

/** 转移结果：下一状态 + 要执行的副作用描述（非执行本身）。 */
export interface Transition<S, Eff> {
  readonly state: S
  readonly effects: readonly Eff[]
}

/** 纯状态机定义。transition 必须是纯函数：无 I/O、无随机、无时钟读取。 */
export interface Machine<S, E, Eff, Ctx = void> {
  /** 初始状态由显式输入构造，绝不读取外部可变量。 */
  initial(input: Ctx): S
  /** (状态, 事件) -> (新状态, 副作用[])。非法转移返回 { state, effects: [] }。 */
  transition(state: S, event: E): Transition<S, Eff>
  /** 终态判定，供解释器决定何时停止喂事件。 */
  isTerminal(state: S): boolean
}
```

约定（强制）：

1. **状态是判别联合，不是布尔标志包**。用 `{ kind: '...' }` 表达互斥状态；只有真正正交的数据才作为同一 state 内的字段。
2. **事件是判别联合**。所有外部输入（用户操作、流结束、工具结果、超时）都建模为事件，由解释器喂入。
3. **副作用是判别联合的"描述"**，不是函数调用。`transition` 只产出 `{ kind: 'finish-stream', ... }`，由解释器去真正调用 `streams.finish`。这保证 `transition` 可纯测试。
4. **非法转移是 no-op**，返回原状态 + 空副作用，可选记 `logger.debug`，**绝不抛异常**。替换当前散落的 `if (...) return` 守卫。
5. **终态显式**。进入终态后解释器停止喂事件；终态的"清理副作用"（如 task 的 `notifySettled`）由 transition 产出，不再手抄。
6. **时钟/随机/UUID 不进 transition**。`Date.now()`、`randomUUID()` 的结果作为事件载荷或 `initial` 输入传入。这是当前代码可纯测试性的最大障碍（`turn-loop.ts:241` 在循环内 `randomUUID()`）。

### 3.2 解释器（imperative shell）

每个机器配一个解释器，负责：喂事件 → 执行副作用 → 把副作用的异步结果转成新事件回喂。

```ts
// src/main/agent/runtime/machine/interpreter.ts (新增)

export interface Interpreter<S, E, Eff> {
  state(): S
  /** 同步推进一步：transition + 执行同步副作用，返回新状态。 */
  send(event: E): S
  /** 异步副作用执行器，由各机器注入（真正调用 streams/store/queue 等）。 */
}

export function createInterpreter<S, E, Eff>(
  machine: Machine<S, E, Eff>,
  initial: S,
  runEffect: (eff: Eff, send: (e: E) => void) => void | Promise<void>
): Interpreter<S, E, Eff>
```

`runEffect` 是唯一接触 I/O 的地方，对应现存模块里的"真正调用"——`deps.streams.finish`、`deps.store.patch`、`steerQueue.drain`、`broadcast` 等。

### 3.3 持久化映射（对 Goal / Task）

持久化状态机额外要求**纯映射**，替换当前散落在 store 的 `rowToGoal` / 内联 patch：

```ts
toRow(state: S): Row      // 纯
fromRow(row: Row): S      // 纯
```

`goal/store.ts` 的 `rowToGoal`（`store.ts:21-38`）已是雏形；规范要求 task 也补一份，并要求所有写库走 `toRow(transition().state)`，而不是 `{...task, status}` 内联拼。

### 3.4 文件与命名约定

| 关注点 | 约定 | 示例 |
|---|---|---|
| 纯核心 | `*.machine.ts` | `turn-loop.machine.ts` |
| 解释器 / shell | 保留原文件名 | `turn-loop.ts` |
| 状态类型 | `XState`（判别联合，`kind` 字段） | `TurnState`、`GoalState`、`TaskState` |
| 事件类型 | `XEvent` | `TurnEvent` |
| 副作用类型 | `XEffect` | `TurnEffect` |
| 转移函数 | `xTransition` 或 `createXMachine().transition` | — |
| 终态集合 | `X_TERMINAL` 常量 | — |

每个 `*.machine.ts` 顶部用注释画出状态图（mermaid 或 ASCII），作为单一事实来源。

### 3.5 测试范式

- **核心**：对 `transition` 做穷举表驱动测试 `(state, event) -> { state, effects }`，无需 mock（纯函数）。这是相对现状最大的提升——当前 `turn-loop.test.ts` 必须 mock `startAgentStream`（`turn-loop.test.ts:9-26`）才能测决策。
- **shell**：只测 `runEffect` 的 I/O 接线，少量 mock。
- 非法转移必须有"返回原态 + 空副作用"的专门用例。

---

## 4. 各状态机详细设计

### 4.1 TurnLoop 状态机

把 `run()` 的 `for(;;)` + 4 标志（`turn-loop.ts:263-394`）显式化，**并吸收 `turn-finalizer.ts` 的决策**，消除双重 finalizer 调用。

**状态图**

```
                ┌───────────── prepared ─────────────┐
                ▼                                     │
  (init)→ preparing ──cancelled──▶ done(aborted)      │
                │                                      │
            prepared                                   │
                ▼                                      │
            streaming ──threw──▶ done(failed)          │
                │                                      │
          stream-finished                              │
                ▼                                      │
            deciding ──┬─ retry(plan-exit) ───────────┤
                       ├─ retry(compaction) ──────────┘
                       ├─ post-compact ─▶ postCompacting ─▶ done(finished)
                       └─ finalize ─────▶ done(terminal)
```

**状态**

```ts
type TurnState =
  | { kind: 'preparing'; messages: TanzoUIMessage[]; pass: number
      planExitPasses: number; forceCompaction: boolean; forceExitPlanMode: boolean }
  | { kind: 'streaming'; runId: string; pass: number; planExitPasses: number; forceExitPlanMode: boolean }
  | { kind: 'deciding'; runId: string; final: AgentStreamFinalState; pass: number; planExitPasses: number }
  | { kind: 'post-compacting'; runId: string }
  | { kind: 'done'; terminal: { runId: string; status: Exclude<ChatRunStatus,'running'>; error?: ChatRunError } }
```

**事件**

```ts
type TurnEvent =
  | { kind: 'prepared'; runId: string; messages: TanzoUIMessage[] }
  | { kind: 'preparation-cancelled' }
  | { kind: 'stream-finished'; final: AgentStreamFinalState }
  | { kind: 'stream-threw'; error: unknown }
  | { kind: 'post-compaction-settled' }
  // 决策所需的外部快照随事件携带（保持 transition 纯）：
  | { kind: 'continuation-context'; inflight: boolean; hasConversation: boolean
      isPlanMode: boolean; nextMessages: TanzoUIMessage[] }
```

**副作用**

```ts
type TurnEffect =
  | { kind: 'finish-stream'; runId: string; status; error? }       // 替换 safeFinishStream
  | { kind: 'run-finalizer'; final: AgentStreamFinalState }        // 唯一一次 finalizer 调用
  | { kind: 'start-post-compaction'; final }
  | { kind: 'inject-plan-exit-nudge' }                             // 追加 PLAN_EXIT_NUDGE
  | { kind: 'reprepare'; force: boolean; messages }
```

**决策核心**（替换 `turn-loop.ts:313-393` 的级联 `if`）：纯函数 `decide(final, ctx) -> NextAction`，集中表达四条续跑路径的优先级：

1. `plan-exit`（plan 模式、纯文本结尾、未调 exitPlanMode、`planExitPasses < 2`）→ `retry`，注入 nudge。
2. `compaction`（`hitCompactionTrigger`、`pass < 10`）→ `retry`，`force compaction`。
3. `post-compact`（`exceededCompactionTrigger && !hitCompactionTrigger`）→ `post-compacting`。
4. 否则 → `finalize`（产出**单次** `run-finalizer` 副作用）。

**直接收益**：消除 `turn-loop.ts:379-386` 的"改 `hitCompactionTrigger` 标志再调一次 finalizer"；`turn-finalizer.ts` 的清 steering / 派发队列 / goal 续跑逻辑变成 `run-finalizer` 副作用的解释器实现，决策与执行分离。

### 4.2 Goal 状态机

状态本就是 6 态（`goal.ts:1-7`），规范要求把 `deriveStatus` 升为**一等状态**，把六个方法的散落 patch 收敛为一张转移表。

**状态**（与 `ThreadGoalStatus` 对齐，数据字段作为状态载荷）

```ts
type GoalState = {
  status: 'active' | 'paused' | 'blocked' | 'budget_limited' | 'usage_limited' | 'complete'
  objective: string
  budget: { tokenBudget: number|null; tokensUsed: number; timeBudgetSeconds: number|null; timeUsedSeconds: number }
  idleStreak: number; blockerStreak: number
  pendingInjection: GoalInjection | null
}
```

**事件**

```ts
type GoalEvent =
  | { kind: 'created'; input: CreateGoalInput }
  | { kind: 'objective-updated'; objective: string }
  | { kind: 'user-paused' } | { kind: 'user-resumed' }
  | { kind: 'turn-evaluated'; turn: GoalTurnInput }   // 来自 TurnLoop 的 finalizer 副作用
  | { kind: 'outcome-marked'; outcome: 'complete' | 'blocked' }   // updateGoal 工具
  | { kind: 'usage-limited' }                          // 429 错误
  | { kind: 'cleared' }
```

**副作用**

```ts
type GoalEffect =
  | { kind: 'persist'; state: GoalState }   // -> store.upsert(toRow(state))
  | { kind: 'broadcast'; state: GoalState | null }
  | { kind: 'decide-continuation'; continue: boolean }  // 回喂给 TurnLoop 解释器
```

**转移表**（集中替换 `goal/service.ts:54-173`）

| 当前状态 | 事件 | 新状态 | 关键副作用 |
|---|---|---|---|
| (无) | created | active, `pendingInjection='continuation'` | persist, broadcast |
| * | objective-updated | active（重置 streak/outcome/limit），`='objective_updated'` | persist, broadcast |
| active | user-paused | paused，`pendingInjection=null` | persist, broadcast |
| paused/blocked/limited | user-resumed | active（重置），`='continuation'` | persist, broadcast |
| active | turn-evaluated（预算耗尽） | budget_limited，`='budget_limit'` | persist, broadcast, decide(继续 wrap-up) |
| active | turn-evaluated（idle≥2 或 plan/抑制） | active | persist, decide(false) |
| active | turn-evaluated（正常） | active，`='continuation'` | persist, decide(true) |
| active | outcome-marked | complete/blocked | persist, broadcast |
| active | usage-limited | usage_limited | persist, broadcast |
| 非 active | turn-evaluated/outcome/usage | **no-op** | — |

最后一行把当前散落的 `if (goal.userState !== 'active' || goal.outcome || goal.limit) return`（`service.ts:158`）收敛成"非法转移即 no-op"的统一语义。

### 4.3 SubagentTask 状态机

`status` 已显式（`subagent-task.ts:5`），规范要求把散落在 10+ 函数的转移收敛为转移表，并把 `block`（approval/dependency）建模为 `blocked` 状态的载荷而非旁路字段。

**状态图**

```
  pending ──deps-satisfied──▶ running ──approvals-surfaced──▶ blocked(approval)
     │  └─dep-failed─▶ failed        │  ▲                         │
     │                               │  └────approvals-cleared────┘
     │                          ┌────┼────┬──────────┐
     │                      completed  failed   cancelled   (terminal)
     │                          ▼
     └────(spawn with unmet deps)────▶ blocked(dependency)
```

**状态**

```ts
type TaskState =
  | { kind: 'pending'; block?: { kind: 'dependency'; taskIds: string[] } }
  | { kind: 'running'; phase?: string }
  | { kind: 'blocked'; block: { kind: 'approval'; approvals: SubagentTaskApproval[] } }
  | { kind: 'done'; result: SubagentTaskResult }
  | { kind: 'failed'; result: SubagentTaskResult }
  | { kind: 'cancelled' }

const TASK_TERMINAL = new Set(['done','failed','cancelled'])  // 替换 isTerminal (task-service.ts:127)
```

**事件**

```ts
type TaskEvent =
  | { kind: 'dependencies-satisfied' } | { kind: 'dependency-failed'; depId: string }
  | { kind: 'run-started' } | { kind: 'phase-reported'; phase: string }
  | { kind: 'approvals-surfaced'; approvals } | { kind: 'approvals-cleared' }
  | { kind: 'completed'; result } | { kind: 'failed'; message: string } | { kind: 'cancelled' }
  | { kind: 'instructed' } | { kind: 'redefined'; objective: string } | { kind: 'retried' }
```

**副作用**：`persist`（`toRow` → `store.tasks.update`）、`broadcast`、`notify-settled`、`start-driver`、`abort-run`。当前每个终态函数手抄的 `delete task.block` + `persist` + `notifySettled`（`task-service.ts:265-277, 398-413, 589-600`）由 transition 统一产出。

**driver 子循环统一**：`runTask`（`task-service.ts:297-396`）与 TurnLoop 的 prepare→stream→decide 循环同构（都有 `forceCompaction`、compaction 续跑 `< 10`、supersede/abort 检测）。规范要求两者复用同一个 **DriverLoop 状态机**（见 4.4）。

### 4.4 共享 DriverLoop 子状态机（TurnLoop / Task 复用）

TurnLoop 的 `run()` 主循环与 Task 的 `runTask()` 是同一个抽象：**反复 prepare → stream → decide 续跑**。统一规范下提取为参数化机器：

```
preparing → streaming → deciding ─┬─ continue(force?) ─▶ preparing
                                  └─ stop(outcome) ─▶ done
```

差异通过注入点表达：supersede 检测（Task 用 `hasAdvancedSince`，TurnLoop 用 `isCurrent`）、续跑上限（都为 10）、终态语义（Task→`completed/failed`，TurnLoop→`terminal`）。这样 `MAX_CONTINUATION_PASSES`（`turn-loop.ts:23`）与 `MAX_CONTEXT_CONTINUATION_PASSES`（`task-service.ts:24`）合并为一个常量来源。

### 4.5 二类模块的轻量符合

- **RunSession**：`status: running→finished/failed/aborted` 已是线性生命周期（`run-session-registry.ts:344-353`）。规范只要求其 `ChatRunStatus` 终态判定复用统一 `isTerminal` 工具、`finish()` 幂等。不拆纯 reducer（其主体是 delta 合并缓冲，非转移图）。
- **QuestionBroker**：`pending→resolved/rejected`（`broker.ts`）。规范只要求遵守命名与"终态即从 map 删除"的约定。不 FSM 化。

---

## 5. 跨状态机协作

统一规范的最大结构收益：当前 TurnLoop ↔ Goal ↔ Task 之间的隐式协作（散在 `turn-finalizer.ts` 的回调里）变成**显式的事件流**。

```
TurnLoop.deciding
   └─effect: run-finalizer(final)
        └─interpreter:
             ├─ steerQueue.drain / messageQueue 派发        (原 turn-finalizer.ts:33-86)
             └─ Goal.send({ kind:'turn-evaluated', turn })
                  └─effect: decide-continuation(continue)
                       └─ 若 continue 且无排队消息:
                            schedule TurnLoop.startGoalContinuation   (原 turn-finalizer.ts:88-92)

Task.runTask 完成
   └─ Task.send({ kind:'completed', result })
        └─effect: notify-settled  →  awaitTask 的 waiters 解析   (原 task-service.ts:119-125)
```

要点：

- **谁触发谁**用事件显式表达，不再靠 `turn-finalizer` 同时持有 `goal` / `messageQueue` / `startGoalContinuation` 三个回调闭包（`turn-finalizer.ts:26-31`）。
- RunEngine / Mailbox 仍是基座：解释器调度续跑时照旧走 `mailbox.enqueue` + `engine.currentCancelGeneration`（`service.ts:86-91`），状态机不感知并发原语。
- 协作只通过"副作用 → 另一机器的事件"单向流动，**禁止机器之间直接读对方内部状态**，避免重新引入隐式耦合。

---

## 6. 迁移计划（test-first，分阶段，可独立合并）

每阶段都先用特征测试锁定现有行为，再提取，保证行为不变。

**阶段 0 — 规范地基**
1. 新增 `runtime/machine/types.ts`（`Machine` / `Transition`）与 `interpreter.ts`。→ 验证：纯单测覆盖解释器喂事件 / 执行副作用 / 回喂。

**阶段 1 — Goal（最低风险，已半显式）**
2. 补 `goal/service.test.ts` 对现有 `evaluate / markOutcome / setUserState` 的特征测试（已存在 `tests/unit/main/agent/goal/service.test.ts`，扩充非法转移用例）。
3. 提取 `goal/goal.machine.ts`（转移表 + `toRow/fromRow`），`service.ts` 改为解释器。→ 验证：原测试 + 新表驱动测试全绿。

**阶段 2 — TurnLoop（收益最大）**
4. 补四条续跑路径（plan-exit / compaction-retry / post-compact / terminal）+ 双重 finalizer 现状的特征测试（扩充 `turn-loop.test.ts`）。
5. 提取 `turn-loop.machine.ts`（`decide` 纯函数 + `TurnState/Event/Effect`），把 `turn-finalizer.ts` 决策并入 `run-finalizer` 副作用解释器。→ 验证：消除双重 finalizer 后，原特征测试断言"finalizer 恰好调用一次"。

**阶段 3 — SubagentTask**
6. 补 task 生命周期特征测试（spawn/deps/approval/cancel/retry）。
7. 提取 `subagent/task.machine.ts`（转移表 + `toRow/fromRow`），收敛 10+ 处散落赋值。→ 验证：`task-service.test.ts` 全绿。

**阶段 4 — DriverLoop 合并（可选，最后做）**
8. ~~把 TurnLoop 主循环与 `runTask` 提取为共享 `runtime/machine/driver-loop.machine.ts`~~。**评估后暂缓**：两条驱动循环仅共享 `prepare → stream → decide-continue` 骨架，但分歧巨大——TurnLoop 含 preparation 取消 / change-set 捕获 / plan-exit / finalizer 派发；`runTask` 含 semaphore 获取 / progress 队列 / epoch supersede / approval 等待子循环。强行参数化共享会引入过多注入点，复杂度不降反升，且同时触碰两条最关键执行路径，违背 surgical 原则。**已落地的部分**：把 `MAX_CONTEXT_CONTINUATION_PASSES` 改为引用 `turn-loop.machine.ts` 的 `MAX_CONTINUATION_PASSES`，续跑上限收敛为单一来源（`task-service.ts:25`）。

**阶段 5 — 文档与收尾**
9. 在 `docs/architecture/10-agent-runtime.md` 增补"状态机层"小节，链接本文档。

> 顺序原则：Goal → TurnLoop → Task → DriverLoop。先做独立、低耦合、已半显式的，最后做跨机器共享抽象。每阶段独立可合并、可回滚。

---

## 7. 取舍与非目标

**明确不做的事**：

1. **不合并成单一巨型状态机**。三类一类的机器抽象层级不同（轮次编排 / 领域生命周期 / 任务调度），合并会产生组合爆炸的状态空间。
2. **不把 RunEngine / Mailbox / RunPersistenceRegistry 状态机化**（见 §2.3）。它们是并发原语与累加器，FSM 化只增不减复杂度。
3. **不引入第三方状态机库**（如 XState）。规范刻意保持轻量：一个 `Transition` 接口 + 一个解释器，契合仓库现有 `createX` 工厂 + 判别联合的风格，零运行时依赖。
4. **不改变对外行为与持久化 schema**。`conversation_goals` 表、`SubagentTask` 形状、`ChatRunStatus` 全部不变；这是纯内部重构，靠特征测试保证等价。

**接受的成本**：

- 每个机器多一层"事件/副作用"间接（相对直接调用，多一次 `send`）。换来的是纯可测的决策核心与单点续跑逻辑。
- `Date.now()/randomUUID()` 需上提到事件载荷/`initial` 输入，调用点略变长，但这正是当前不可纯测的根因。

**判定成功的标准**：

- TurnLoop 决策（四条续跑路径）可在**不 mock** 任何流的情况下表驱动测试。
- `turnFinalizer.finish` 在一个 turn 内**恰好执行一次**（消除双重调用）。
- Goal / Task 的所有状态转移集中在各自 `*.machine.ts` 的一张表里；新增状态只改表，不再多处手抄 `delete block` / `persist` / `notify`。
- 跨机器协作只通过"副作用 → 事件"，grep 不到任何机器直接读另一机器内部 Map/字段。
