# Tanzo 压缩与历史模型重构设计文档

> 状态：已实施终态（不保留旧 `compacted_into` 运行路径）
> 日期：2026-06-24
> 范围：当前代码已落地消息顺序日志 + payload revisions + compaction overlay；旧 `compacted_into` 只保留在一次性 legacy migration 中。
> 前置阅读：`docs/architecture/11-context-engineering.md`、`docs/architecture/22-persistence.md`。

---

## 1. 背景

当前的上下文压缩（compaction）把三个本质不同的概念塞进了同一条 `messages` 流：

1. **线性对话历史**——不可变的事实记录。
2. **压缩视图**——为了塞进上下文窗口而生成的、有损的*派生投影*。
3. **UI 展示**——给用户看的渲染。

压缩的实现方式是「在消息流里制造一条伪装成消息的标记」，由此产生了一连串隐式契约。本文档主张把这三者拆开：**历史是一条只增日志，压缩/上下文/显示都是它之上的纯函数视图。**

### 1.1 重构前基线（历史快照，描述被替换的旧 `compacted_into` 模型）

> 注意：本小节记录的是**重构前**的实现，用于说明动机。当前代码已切换到 §3 的 seq 日志 + overlay 模型（DB 迁移至 v17）；下列 `compacted_into`、`role:'user'` 摘要、`tailBoundaryMessageId`、BFS `inflateHistory` 等均已不在运行路径中。要看当前实现，请读 `docs/architecture/11-context-engineering.md` §7 与 `src/main/agent/repositories/message-repo.ts`。

- **存储**：所有活跃与归档消息共用 `messages` 表。归档靠可空列 `compacted_into` 表达：`NULL` = 活跃，置值 = 归档在某 `summaryId` 下（`src/main/database/schema.ts:191`、`:198`）。
- **活跃视图**：运行时只读 `compacted_into IS NULL`（`src/main/agent/repositories/message-repo.ts:46`）。部分唯一索引 `uq_messages__active_ord WHERE compacted_into IS NULL` 保证活跃流 ord 唯一，归档行不受约束（`schema.ts:204`）。
- **摘要消息**：压缩产物是一条 `role: 'user'` 消息，带一个 `text` part 和一个 `data-compaction` part，靠 `metadata.compaction.isSummary` 才能认出它「其实不是消息」（`src/main/agent/context/compact/compact.ts:72`）。
- **位置编码**：摘要该插回历史的哪个位置，由 `tailBoundaryMessageId` 描述，且在 `data-compaction` part 和 `metadata.compaction` **存了两份**（`compact.ts:70`、`:86`；读取时数据优先、元数据兜底见 `src/shared/message-history.ts:37`）。
- **压缩执行**：`runCompaction` 切分 head/tail → 跑一次 fork 模型调用生成摘要 → `finalizeCompaction` 把 head 标记 `compacted_into`、重写活跃流为 `[summary, ...tail]`（`src/main/agent/runtime/compaction-coordinator.ts:131`、`message-repo.ts:260`）。
- **嵌套压缩是有意为之**：`findCut` 在遇到旧摘要时停止，`planCompaction` 只在 head 全是摘要时才放弃（`src/main/agent/context/compact/segments.ts:70`、`compact.ts:36`），于是旧摘要会被归档进新摘要之下，形成「摘要套摘要」。
- **历史重建**：`loadFullHistory`（main）与 `useArchivedMessages`（renderer）都用 `src/shared/message-history.ts` 的纯函数，BFS 解析所有可达归档集合再 `inflateHistory` 还原顺序（`message-repo.ts:302`、`use-archived-messages.ts:14`）。这是上一轮重构刚收敛的唯一算法。
- **乐观并发**：`finalizeCompaction` 用 `expectedActiveIds` 守卫，活跃流在压缩期间被改动则抛 `CHAT_COMPACTION_STALE`（`message-repo.ts:243`）。
- **续接**：前台 `MAX_CONTINUATION_PASSES = 10`、子代理 `MAX_CONTEXT_CONTINUATION_PASSES = 10`，流在压缩触发点中途停下后用 `force: true` 重入 `prepareMessages`（`turn-loop.ts:23`、`:357`、`subagent/task-service.ts:24`）。
- **数据库版本**：迁移内联在 `schema.ts`，最新版本 16（`repair_database_constraints`），注册表 `_tanzo_migrations`（`schema.ts:793`、`migrations.ts:7`）。

### 1.2 这套设计的结构性问题

| 编号 | 问题                                                                      | 表现 / 风险                                                                                                                                     |
| ---- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | **概念混叠**：`compacted_into` 一列同时表达「LLM 看什么」和「历史是什么」 | 任何想读「完整历史」的代码都必须懂压缩机制                                                                                                      |
| P0   | **摘要伪装成 user 消息**                                                  | 角色被挪用；到处要靠 `isSummary` 特判「这条其实不是消息」；校验、计数、fork、显示全要绕开它                                                     |
| P1   | **位置信息双写** `tailBoundaryMessageId`                                  | metadata 与 data part 两份，读取顺序是隐式约定，易漂移                                                                                          |
| P1   | **嵌套关系靠运行时反推**                                                  | schema 里没有「代/generation」概念，每次读取都要 BFS 现场发现嵌套（`message-history.ts`）                                                       |
| P2   | **fork 必须懂压缩**                                                       | fork 要先 `loadFullHistory` 展开归档才能定位目标（`store.ts:244`），本应只是「按位置切日志」                                                    |
| P2   | **partial-split 制造合成消息**                                            | 跨 step 边界切分时归档原 assistant、用 `randomUUID()` 造一条新 tail 片段（`segments.ts:103`、`:109`），引入了一条数据库里不存在于原始历史的消息 |

`inflateHistory` / `pendingSummaries` / `tailBoundaryMessageId` 这套拼接舞蹈，本质是**在运行时反推一个本该被显式存储的关系**。上一轮重构把它收敛成了一份、写干净了，但它存在本身就是模型欠债的症状。

---

## 2. 设计目标

把「不可变历史日志」与「压缩派生视图」彻底分离：

- **唯一事实源**：消息顺序日志只追加 `conversation_id/id/seq` 锚点；payload 变更追加到 `message_revisions`，不再覆盖历史修订；没有 `compacted_into`。
- **压缩是 overlay**：压缩记录独立成表，描述「哪段历史被哪条摘要覆盖」，不进消息流。
- **上下文是算出来的**：发给 LLM 的 prompt = 「最新压缩 overlay + 其覆盖范围之后的消息」，纯函数推导。
- **fork 退化为切片**：按 `seq` 截取日志 `[0..seq]`，不需要 inflate。
- **摘要不是历史消息**：摘要文本只存在于 overlay；需要喂给模型或渲染 UI 时才临时合成一条带 `data-compaction` 的消息（落地实现为 `assistant` 角色），不进只增日志。

### 2.1 非目标（刻意不做）

- 不改变压缩的**触发策略**（90% 窗口、保留 6 步）、续接上限、fork 模型调用方式。这些行为保持不变。
- 不引入「压缩历史的版本树 / 时间旅行」等新功能。本次只重构存储与读取模型。
- 不改 IPC 对 renderer 的**语义**承诺（完整历史可读、压缩可视）。通道签名可调整，但能力对等。

---

## 3. 目标模型

### 3.1 两张表

**`messages`——只增顺序日志（历史锚点）**

```
messages (
  conversation_id  TEXT,
  id               TEXT,
  seq              INTEGER NOT NULL,   -- 会话内单调递增，永不复用
  role             TEXT,
  message_json     TEXT,              -- 初始 payload 快照；最新内容读 message_revisions
  metadata_json    TEXT,
  created_at       INTEGER,
  PRIMARY KEY (conversation_id, id)
)
UNIQUE (conversation_id, seq)
```

与现状的关键差异：

- **删除 `compacted_into` 列**。消息不再有「活跃/归档」状态——所有消息永远是历史的一部分。
- **新增 `seq`**：会话内单调递增的序号，定义唯一的线性顺序，是 fork 切片和 overlay 范围引用的锚点。（现有 `ord` 是「活跃流内的相对序」，压缩后会被重排；`seq` 是「历史绝对序」，永不变。）

**`message_revisions`——payload 修订日志**

```
message_revisions (
  conversation_id TEXT,
  message_id      TEXT,
  revision        INTEGER NOT NULL,
  message_json    TEXT,
  created_at      INTEGER,
  PRIMARY KEY (conversation_id, message_id, revision)
)
```

- 新消息同时写入 `messages` 锚点和 revision 1。
- 已存在消息的内容变化只追加新的 revision；读取时投影最新 revision。
- `messages.seq` 仍是 fork / overlay 范围引用的稳定锚点。

**`compaction_overlays`——压缩视图（派生数据）**

```
compaction_overlays (
  conversation_id   TEXT,
  id                TEXT,            -- summaryId
  generation        INTEGER NOT NULL,-- 第几代压缩，显式表达嵌套
  covers_from_seq   INTEGER NOT NULL,-- 覆盖区间起点（含）
  covers_to_seq     INTEGER NOT NULL,-- 覆盖区间终点（含）
  summary_text      TEXT NOT NULL,
  usage_json        TEXT,            -- 压缩时的 token 统计
  created_at        INTEGER,
  PRIMARY KEY (conversation_id, id)
)
UNIQUE (conversation_id, generation)
```

- 压缩不再用 `compacted_into` 归档消息，而是**追加一条 overlay 记录**（落地实现仍会把保留的 tail 重排进新 seq 区块，见 §5.2）。
- `generation` 显式表达嵌套：第 N+1 代 overlay 的 `covers_from_seq` 可以早于第 N 代的 `covers_to_seq`，「代」字段直接告诉读取方层级，**不再需要 BFS 反推**。
- `[covers_from_seq, covers_to_seq]` 是 seq 区间，位置信息**单处存储**，`tailBoundaryMessageId` 彻底消失。

### 3.2 三个纯函数视图

都建立在 `src/shared/` 之上，main / renderer / fork 共用：

```ts
// 完整历史 = 直接就是日志，无需任何重建
fullHistory(messages): TanzoUIMessage[]            // ≈ 恒等

// 发给 LLM 的上下文 = 取最新代 overlay + 其覆盖范围之后的消息
activeContext(messages, overlays): ModelMessage[]
//   令 top = overlays 中 generation 最大者
//   = [synthSummary(top), ...messages.filter(m => m.seq > top.covers_to_seq)]   // 实现为 assistant 角色
//   无 overlay 时 = 全部 messages

// 显示 = 完整历史 + overlay 作为行内分隔条注解
displayTimeline(messages, overlays): TimelineItem[]
```

对照现状的收益：

- `activeContext` 取代了 `compacted_into IS NULL` 查询——「活跃」不再是存储状态，而是一个**纯函数 derive**。
- `displayTimeline` 取代了 `inflateHistory`——不再需要把归档「拼回」流里，因为它们从未离开日志。
- `fork` 不再调用任何展开逻辑：`messages.filter(m => m.seq <= targetSeq)`。

### 3.3 摘要不再是消息

摘要文本只存在于 overlay 记录里。需要喂给模型或展示时，投影层临时合成一条带 `data-compaction` part 的消息（不落日志）。实现落地时该合成消息为 `role: 'assistant'`（`message-repo.ts:280-297`、`compact/compact.ts:70`），而非本设计初稿设想的 `system`；要点是它**由 overlay 派生、不进只增日志**，而不是其具体角色。于是：

- 没有 `role:'user'` 伪装，没有 `metadata.compaction.isSummary` 特判。
- 消息计数、校验、fork、token 预算都不再需要「跳过摘要」的分支。
- UI 用 `displayTimeline` 把 overlay 渲染成分隔条，和现在 `CompactionMessage` 的观感一致，但数据来源是 overlay 而非伪消息。

---

## 4. 各链路的变化

| 链路            | 现状                                                     | 目标                                                           |
| --------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 写入活跃消息    | `writeActive` 差量删/插 `compacted_into IS NULL` 行      | 新消息追加 `messages(seq)`；已有消息只追加 `message_revisions` |
| 压缩落库        | `finalizeCompaction`：标记归档 + 重写活跃流              | 追加一条 overlay 记录；消息日志完全不动                        |
| 乐观并发        | `expectedActiveIds` 比对活跃流                           | 比对「最大 seq」即可，更简单（日志只增）                       |
| 构建 LLM prompt | `load()`(活跃流) → convertToModelMessages                | `activeContext(messages, overlays)`                            |
| 完整历史        | `loadFullHistory` BFS 展开                               | `fullHistory(messages)`（≈ 读日志）                            |
| fork            | 展开归档 → 找目标 → 切片 → 写活跃流                      | 按 `seq` 切日志 → 写子会话日志                                 |
| renderer 显示   | active + `archivedBySummaryId` 懒加载 + `inflateHistory` | 拉日志 + overlay；`displayTimeline` 渲染                       |
| renderer 流式   | active tail 单独流式，与归档前缀拼接                     | **不变**：新消息追加日志尾部，overlay 是注解，天然不冲突       |

注意 renderer 流式那一行：当前为「活跃尾部 vs 归档前缀」分离付出的复杂度（`chat-session.ts` 里 `archivedBySummaryId` 与 `messages` 的拆分），在目标模型里**自然消解**——因为日志本身就是连续的，overlay 只是覆盖区间注解，流式追加永远发生在日志末尾。这正是 §1.2 P0 想解决的核心收益。

---

## 5. 迁移方案

数据迁移是本次重构的最大风险点。当前实现采用一次性破旧立新：检测 legacy `messages.compacted_into` 后重建 `messages(seq)`、seed `message_revisions`、回填 `compaction_overlays`，最后移除旧表形态。

### 5.1 迁移 v17：重建日志 + 回填 revisions/overlays

1. 如果 legacy `messages` 仍有 `compacted_into`，按旧完整历史语义递归展开 active summary，给真实消息分配稳定 `seq`。不能简单按 `(created_at, ord)` 排序，因为压缩后活跃行与归档行会复用 ord。
2. 重建 `messages(conversation_id,id,seq,...)`，不再带 `ord` / `compacted_into`；同时为每条消息写入 `message_revisions` revision 1。
3. 从 legacy `compacted_into` 分组回填 overlay：每个 summaryId → 一条 overlay。
   - `covers_from_seq` / `covers_to_seq` 由该 summaryId 下归档消息和嵌套 overlay 的 seq 范围推出。
   - `generation` 由嵌套关系拓扑排序推出——这是**一次性**反推，之后运行时不再需要 BFS。
   - `summary_text` 从 legacy 摘要消息的 `text` part 提取。
4. 如果数据库已经是 `messages(seq)` 形态，则只补建/seed `message_revisions` 和 `compaction_overlays`。

回填脚本需对「partial-split 合成片段」（`segments.ts` 造的 `randomUUID()` tail）做特殊处理：这些消息在语义上是原 assistant 的尾部片段，但在当前数据库里已经是一条新的 message。迁移不能静默把它当作普通原始消息，否则只增日志会混入“压缩过程制造的历史”。有两个可评审选项：

- **保守迁移**：把合成片段作为一条 legacy message 保留，并在 `metadata` 标记 `derivedFromMessageId`，保证现有显示和 fork 语义完全不变。
- **模型洁癖迁移**：回到原 assistant 消息，用 segment/range 视图表达“上下文只保留尾部”，彻底消灭合成消息；但这会扩大 schema 与 renderer 改动，不建议放进第一阶段。

建议阶段一采用保守迁移，先保证等价；等 overlay 模型稳定后，再单独评审是否删除 partial-split。

### 5.2 已完成的切换点

- `load()` 读取 context projection：最新 overlay synthetic marker + `covers_to_seq` 之后的 tail。
- `loadFullHistory()` 读取完整历史日志：按 `seq` 返回真实消息，不需要 inflate。
- `loadDisplay()` 读取 UI timeline：完整日志 + overlay 合成 marker，renderer 不再维护 archived state。
- `finalizeCompaction()` 追加 overlay，并把保留的 tail 消息重排进新的 seq 区块、必要时插入合成 tail 片段（`message-repo.ts:386`、`:396`）；不再用 `compacted_into` 标记归档。
- `listMessages` 返回 display projection；fork 从 full history 切片。

### 5.3 回滚边界

本轮按“破旧立新”执行，不保留双写/旧读路径。回滚只能通过应用版本回退 + 数据库备份恢复；运行时没有 `compacted_into` 兼容分支。

---

## 6. 影响面清单

需要改动的模块（当前已落地）：

- **DB**：`schema.ts` 迁移 v17 重建 log/revisions/overlays。
- **持久化**：`message-repo.ts`（新消息追加 seq 锚点；已有消息追加 revision；`finalizeCompaction` 追加 overlay）、`store.ts`（fork 读 full history）。
- **上下文/压缩**：`compact/compact.ts` 生成由 overlay 派生的合成 `assistant` 摘要消息（带 `data-compaction`，不进只增日志）；`compact/segments.ts` 用该 data part 识别 overlay summary。
- **共享**：移除 `src/shared/message-history.ts`；`agent-message.ts` 移除 `metadata.compaction` / `tailBoundaryMessageId`。
- **renderer**：`chat-session.ts`、`use-archived-messages.ts`、`data-part-router.ts`、`CompactionMessage` 渲染源切换。
- **IPC**：`shared/chat.ts` / `ipc/chat.ts`——`loadArchived` 语义保留或重定义，`listMessages` 现在返回完整日志。
- **测试**：`message-history.test.ts`、`message-repo.test.ts`、`store.test.ts`、renderer 相关测试全面改写；新增迁移回填测试。

---

## 7. 取舍与遗留

- **`activeContext` 每次推导成本**：相比直接查 `compacted_into IS NULL`，目标模型每次要扫日志 + 取最新 overlay。会话消息量级下成本可忽略，且可在 repo 层用 `seq > covers_to_seq` 的索引查询优化，不必真的全量扫。
- **partial-split 的去留**：目标模型下，跨 step 边界的 partial-split 是否还需要？overlay 用 seq 区间覆盖，理论上可以只在消息边界切分，彻底删掉 `randomUUID()` 合成片段。这能进一步简化，但需确认上下文窗口精度可接受——列为实施期决策点。
- **`loadArchived` IPC**：若前端仍要「单独看某次压缩归档了什么」，用 overlay 的 `covers_from/to_seq` 区间查日志即可重新实现，语义对等。
- **不做的**：历史日志的物理清理（无限增长）。当前设计下日志只增，超大会话的存储增长是已知但**本次不解决**的问题，需要时另设「冷归档」方案。

---

## 8. 实施节奏建议

1. 迁移 v17：重建 `messages(seq)`、seed `message_revisions`、回填 overlays。
2. 切换写路径：新消息写 seq 锚点，payload 变动写 revision，compaction 写 overlay。
3. 切换读路径：context/full/display 三投影；renderer 不再维护 archived state。
4. 清理旧 summary metadata / `tailBoundaryMessageId` / `message-history`。

验证关卡：迁移嵌套 overlay 顺序、fork archived 消息、renderer live-run display merge、revision 投影、全测试绿。

---

> 评审要点：(1) `seq` 回填与嵌套 `generation` 反推的正确性；(2) payload revisions 是否足够表达消息修订；(3) partial-split 合成消息的长期去留；(4) 是否接受日志无限增长、冷归档延后。
