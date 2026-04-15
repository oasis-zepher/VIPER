# V6 模块化重构路线图

> 目标：把当前 `VIPER` 从“功能强但高度耦合的单体 CLI”重构为“可分层、可分包、可并行开发”的终端 agent 平台。

## 1. 当前现状

仓库已经部分 workspace 化，但核心问题没有解决：

- `packages/` 里主要是原生模块和外设能力：
  - `@ant/computer-use-input`
  - `@ant/computer-use-swift`
  - `@ant/computer-use-mcp`
  - `@ant/claude-for-chrome-mcp`
  - `@ant/ink`
  - `*-napi`
- 主业务仍然堆在 `src/` 单体中
- 多个核心文件已经达到“需要拆解而不是继续维护”的体量：
  - `src/main.tsx`：6970 行
  - `src/cli/print.ts`：5596 行
  - `src/commands/insights.ts`：3200 行
  - `src/services/analytics/growthbook.ts`：1256 行
  - `src/commands.ts`：756 行

这意味着当前架构虽然已经支持大量能力，但在以下方面成本越来越高：

- 新功能容易牵动入口、状态、UI、命令分发和工具层
- feature flag 与构建产物边界不够清晰
- 局部修复容易暴露历史隐藏问题
- 并行开发冲突概率高
- 测试和发布粒度仍然偏粗

## 2. V6 的真正目标

V6 不是“继续加功能”，而是做三件基础设施级的事情：

1. 建立清晰分层：入口、内核、UI、远控、provider、基础设施不再混在一起。
2. 建立真实分包：高内聚模块迁移到独立 package，而不是只在 `src/` 下分目录。
3. 保持可迁移：重构过程中不能打断现有 CLI、构建链和主线能力。

简化后的目标结构：

```text
apps/
  cli-shell            终端入口与发行壳

packages/
  core-runtime         agent loop / query / session / task
  command-registry     命令注册与命令元数据
  repl-ui              Ink UI、消息渲染、输入框、状态栏
  tools-runtime        tool 注册、tool 权限、tool 上下文
  remote-control       bridge / daemon / remote session
  model-providers      anthropic/openai/gemini/grok/... 适配
  config-runtime       配置、settings、环境变量、feature flags
  observability        analytics / growthbook / sentry / metrics
  existing native/*    当前已拆出去的 mcp/napi/native 包
```

## 3. 推荐的拆分顺序

### Phase 0：冻结边界，不先动大手术

目标：先让代码知道“自己分哪几层”，再开始搬家。

要做的事：

- 给 `src/` 顶层目录补一份“逻辑归属表”
- 明确哪些目录允许相互依赖，哪些不能再新增横向引用
- 对超大文件标记“只允许减重，不允许继续加职责”
- 给 build feature 建立最小回归用例

交付物：

- 本文档
- import 边界约束
- 构建 smoke tests

### Phase 1：先拆“最稳定、最容易独立”的基础层

这是 V6 的最佳起点，因为风险最低、收益最高。

优先拆出去的模块：

- `config-runtime`
  - 来源：`src/utils/config.ts`、`src/utils/env.ts`、`src/utils/envUtils.ts`、`src/utils/settings/*`
- `observability`
  - 来源：`src/services/analytics/*`
- `model-providers`
  - 来源：`src/services/api/*`、`src/utils/model/*`
- `command-registry`
  - 来源：`src/commands.ts`、`src/types/command.ts`、部分 `src/commands/*/index.ts`

为什么先拆这批：

- 接口相对明确
- UI 依赖少
- 可单独测试
- 对主流程是“被调用方”，不是“主控方”

### Phase 2：把工具系统单独拉平

目标：形成真正的 `tools-runtime`。

范围：

- `src/tools/*`
- `src/Tool.ts`
- `src/tools.ts`
- `src/utils/permissions/*`
- 与 tool 直接耦合的权限上下文、审批数据结构

拆完后的收益：

- tool 注册不再依赖主 UI
- 更容易把 tool runtime 提供给 headless / server / remote 执行环境
- permission model 可以独立演进

### Phase 3：分离 REPL UI 和主循环

这是最痛但必须做的一步。

核心目标：

- 把“渲染”从“决策与状态推进”里剥出来
- 降低 `src/main.tsx` 和 `src/cli/print.ts` 的巨石程度

优先迁移：

- `repl-ui`
  - `src/components/*`
  - `src/screens/*`
  - `src/hooks/*`
  - `src/context/*`
  - `src/keybindings/*`
- 保留在 `core-runtime`
  - session state
  - query loop
  - task state transitions
  - message normalization

衡量标准：

- `main.tsx` 降到 2000 行以下
- `cli/print.ts` 降到 2000 行以下
- UI 层不直接 import provider / analytics / config internals

### Phase 4：把 remote / bridge / daemon 做成独立子系统

范围：

- `src/bridge/*`
- `src/remote/*`
- `src/daemon/*`
- `src/commands/bridge/*`
- `src/commands/remoteControlServer/*`
- 与 remote 强耦合的 transport/permission callback

这是 V6 的关键商业能力层，因为：

- remote-control
- daemon worker
- remote session attach
- future self-hosting / multi-session control

本质上应该形成一个独立包：

```text
packages/remote-control
  api/
  bridge/
  daemon/
  session-runner/
  command-adapters/
```

### Phase 5：回头清理入口壳

最后才处理这些：

- `src/main.tsx`
- `src/entrypoints/*`
- `src/cli/handlers/*`
- 打包与安装脚本

原因很现实：

- 入口壳依赖几乎所有东西
- 如果太早动它，会把每一阶段都变成高风险
- 入口壳应该最后只做“组装”，不再承载业务

## 4. 建议的目标包映射

### `packages/core-runtime`

建议纳入：

- `src/query/*`
- `src/tasks/*`
- `src/state/*`
- `src/bootstrap/*`
- `src/history.ts`
- `src/query.ts`
- `src/QueryEngine.ts`

职责：

- session 生命周期
- task 状态推进
- query / response 主循环
- runtime 级 app state

### `packages/command-registry`

建议纳入：

- `src/commands.ts`
- `src/types/command.ts`
- `src/constants/src/commands.ts`
- 各命令的元信息和 lazy load adapter

职责：

- slash / local command 注册
- 命令描述、别名、可见性、特性开关

### `packages/tools-runtime`

建议纳入：

- `src/tools/*`
- `src/Tool.ts`
- `src/tools.ts`
- `src/utils/permissions/*`
- `src/utils/bash/*`
- `src/utils/powershell/*`

职责：

- tool schema
- tool dispatch
- tool 权限模型
- shell/tool 审计边界

### `packages/repl-ui`

建议纳入：

- `src/components/*`
- `src/screens/*`
- `src/hooks/*`
- `src/context/*`
- `src/keybindings/*`
- `src/outputStyles/*`

职责：

- terminal UI
- 输入框
- 消息渲染
- dialogs
- 状态栏

### `packages/remote-control`

建议纳入：

- `src/bridge/*`
- `src/remote/*`
- `src/daemon/*`
- `src/commands/bridge/*`
- `src/commands/remoteControlServer/*`

职责：

- bridge transport
- remote-control session
- daemon supervisor
- attach / reconnect / background workers

### `packages/model-providers`

建议纳入：

- `src/services/api/*`
- `src/utils/model/*`
- `src/cost-tracker.ts`
- `src/costHook.ts`

职责：

- 各 provider adapter
- 模型名规范化
- cost / token / provider capability

### `packages/observability`

建议纳入：

- `src/services/analytics/*`
- `src/utils/telemetry/*`

职责：

- event logging
- growthbook
- sentry
- metrics / sinks

## 5. 第一批必须减重的石山文件

### `src/main.tsx`

现状：总装配厂 + commander CLI + UI 启动 +状态切换 + feature gate。

目标：

- 只保留 entry wiring
- 业务逻辑迁出到 `core-runtime` / `command-registry` / `repl-ui`

### `src/cli/print.ts`

现状：消息流、bridge 回传、打印策略、状态消息、交互输出混在一起。

目标：

- 拆成：
  - message normalization
  - render output
  - bridge forwarding
  - transport side effects

### `src/commands/insights.ts`

现状：单个命令过大，内部又含 diff/html/report 逻辑。

目标：

- 提炼成 `packages/insights` 或 `command-registry + report-core`

### `src/services/analytics/growthbook.ts`

现状：远超“adapter”范畴，已经像一个子系统。

目标：

- 独立为 `observability` 包内的单独模块
- 给 refresh、cache、override、exposure 拆层

## 6. 迁移原则

V6 不应该是一次性暴力重写。推荐原则：

1. 先抽接口，再搬代码。
2. 先保留兼容导出，再替换调用方。
3. 每次只拆一个子系统，不同时改入口和内核。
4. 每完成一个 package，就补最小可运行 smoke test。
5. `main` 分支停止做大重构，只接 bugfix 和必要 feature；V6 在新分支推进。

## 7. 风险点

最容易出事故的不是“代码搬不动”，而是“边界看起来分了，实际仍互相穿透”。

重点风险：

- UI 层继续直接读取 config / analytics / provider internals
- tools-runtime 继续依赖 REPL 组件
- remote-control 继续隐式依赖主 session 状态结构
- feature flag 只在 dev 有效，build 漏编
- 包名拆出来了，但发布和测试仍是单体心智

## 8. 里程碑建议

### Milestone A：分层完成

完成条件：

- 明确每个顶层目录归属
- 新增 import 边界约束
- 禁止继续向 `main.tsx` / `cli/print.ts` 叠职责

### Milestone B：基础层独立

完成条件：

- `config-runtime`
- `observability`
- `model-providers`
- `command-registry`

全部可单独构建和测试

### Milestone C：工具内核独立

完成条件：

- `tools-runtime` 从 REPL/UI 解耦
- 主要 tool 权限逻辑不再依赖 `main.tsx`

### Milestone D：REPL/UI 独立

完成条件：

- `main.tsx` 明显瘦身
- Ink UI 作为单独层存在

### Milestone E：远控子系统独立

完成条件：

- `remote-control`、`daemon`、`bridge` 可以作为一个包演进
- 后续自托管/多端入口不再需要改全局主循环

## 9. 我对 V6 的判断

如果不做 V6，`VIPER` 还可以继续堆功能，但代价会越来越高：

- 一个 feature 会频繁跨越命令、状态、UI、远控、构建链
- 隐藏问题只会在某个 feature 第一次真正编进 build 时爆出来
- 未来要做更强的远控、self-hosting、server mode、多 agent 协作时，主线维护成本会快速失控

如果做 V6，最值得的不是“代码好看了”，而是三件实事：

- 新能力能按子系统交付
- 回归范围变小
- 你能真正把 `VIPER` 变成平台，而不是一个越来越大的 fork

## 10. 下一步建议

如果现在就开做，不建议直接“全面重构”。建议先做这三步：

1. 建一个 `v6-modularization` 分支。
2. 先做 Milestone A，只加边界与包草图，不搬大块逻辑。
3. 第一刀从 `observability` 和 `command-registry` 开始，因为它们最容易独立、回报最高。

---

这份路线图不是最终组织结构，而是基于当前仓库状态最稳的一条迁移路径。后续如果要真正开工，建议每个 Milestone 再各自拆成单独设计文档和 PR 序列。
