# AGENTS.md

本文件是本仓库的项目级 agent 工作说明。后续自动化 agent、Codex、Claude Code 或其他协作助手进入本项目时，应优先阅读并遵守这里的约定。

## 项目概览

这是一个基于 Next.js 14 App Router 的 AI 音乐创作与音乐版权/模板交易 Demo。

主要技术栈：

- Next.js 14、React 18、TypeScript
- Supabase Auth、Database、Storage
- Zustand 状态管理
- Vitest + fast-check 测试
- Gemini / Lyria / MiniMax / Kie Suno 等音乐生成与音频处理能力

主要业务域：

- 用户端：首页、定价、模板、购物车、结账、账号、创作历史
- Studio：模板生成、上传音频编曲、Stem 编辑、Style DNA
- Admin：用户、订单、模板、音乐人、敏感词、收益、AI 任务、配置
- Credits / Membership：积分扣减、套餐、会员权限、降级
- Supabase：数据库迁移、RLS、Storage、Auth

## 常用命令

优先使用 npm 脚本：

```powershell
npm run dev
npm run typecheck
npm run test
npm run build
```

等价脚本定义在 `package.json`：

- `npm run dev`：启动本地 Next.js 开发服务器
- `npm run typecheck`：运行 `tsc --noEmit --incremental false`
- `npm run test`：运行 `vitest run --dir src`
- `npm run build`：运行 `next build`

完成代码修改后，至少运行与改动范围匹配的验证。涉及类型、路由、服务层或共享配置时，优先运行 `npm run typecheck`。涉及业务逻辑时，运行相关测试或 `npm run test`。

## 仓库结构

- `src/app`：Next.js App Router 页面与 API routes
- `src/components`：React UI 组件
- `src/lib`：业务服务、provider、工具函数、Supabase 封装
- `src/types`：跨模块类型定义
- `src/config`：积分、会员、功能开关、Studio tab 等配置
- `src/store`：Zustand stores
- `src/hooks`：React hooks
- `supabase/migrations`：Supabase 迁移 SQL
- `scripts`：一次性或运维 SQL / mjs 脚本
- `docs`：需求、计划、进度、交接与安全修复文档

## 编码约定

- 使用 TypeScript，保持 `strict` 兼容。
- 路径别名使用 `@/*` 指向 `src/*`。
- 尽量让 route handler 保持薄层，把业务逻辑放在 `src/lib/*` 服务中。
- 新增或修改核心业务逻辑时，同步补充或更新相邻测试。
- 保持现有模块边界，不把无关重构混进功能修复。
- 不随意移动或删除用户已有文件、生成文件、SQL 脚本和未跟踪资料。
- 中文 UI 文案较多，编辑时注意编码，避免 mojibake。
- 前端组件当前大量使用局部样式/内联样式；除非明确做 UI 重构，否则延续局部既有风格。

## 测试与验证策略

优先验证真实风险，而不是只跑最便宜的命令。

- 纯类型/接口改动：运行 `npm run typecheck`。
- 服务层、provider、配置、工具函数改动：运行相关 `*.test.ts`，必要时运行 `npm run test`。
- API route 改动：至少验证类型，并尽量补服务层测试或 route 行为测试。
- 前端交互或布局改动：启动 dev server 后用浏览器实际检查关键视口和控制台错误。
- Supabase schema/RLS 改动：检查迁移顺序、策略影响和现有 mapper/service 是否同步。

当前历史交接记录显示，测试基线曾存在失败项；不要假设 `npm run test` 一定通过。若测试失败，先区分是本次改动引入还是既有失败，并在交付说明中明确。

## 高风险业务规则

### Credits / Membership

积分扣减、会员权限、套餐价格是高风险区域。

- 改动 `src/lib/credits/*`、`src/config/creditsCost.ts`、`src/lib/membership/*`、`src/config/tierConfig.ts` 时必须优先看现有测试。
- 生成类 API 不应在积分不足时继续执行。
- 生成成功、失败、扣费失败的行为要清晰，避免静默吞错导致免费生成或重复扣费。

### 音乐生成

相关路径：

- `src/lib/generation/*`
- `src/app/api/generate*`
- `src/app/api/minimax/*`
- `src/app/api/kie/*`
- `src/components/studio/*`

注意：

- 不要在没有验证的情况下修改 provider 的请求字段、超时、回调处理或状态映射。
- 外部 API 的 base URL、参数名、回调字段和错误结构要以当前实现/官方文档/测试为准。
- 用户输入的 prompt、lyrics、style、audio metadata 进入生成前应经过必要校验。

### 敏感词与内容安全

相关路径：

- `src/app/api/sensitivity-check/route.ts`
- `src/lib/sensitivity/*`
- `src/hooks/useSensitivityCheck.ts`
- `src/app/admin/sensitive-words/page.tsx`
- `src/app/admin/sensitivity-logs/page.tsx`

注意：

- Studio 生成、上传编曲、歌词相关路径应保持一致的安全策略。
- 不要只依赖第三方模型自己的安全拦截。
- 管理端敏感词、日志、重写缓存相关改动需要考虑审计可追踪性。

### Supabase

相关路径：

- `src/lib/supabase/*`
- `src/lib/supabase/mappers/*`
- `supabase/migrations/*`
- `scripts/*.sql`

注意：

- 修改 schema 时，同步 mapper、types、service、测试。
- 迁移文件应保持可重复理解的顺序。当前仓库历史中存在重复数字前缀迁移，新增迁移时不要扩大混乱。
- RLS、Storage public/private、signed URL 行为会直接影响生产可用性，改动前后都要说明影响。
- `.env.local` 含本地环境变量，不要输出密钥值，不要提交新的真实密钥。

## Git 与工作区约束

- 工作区可能已有用户或其他 agent 的未提交改动。不要还原、删除或覆盖与你任务无关的变更。
- 修改前先了解相关文件当前状态；如果同一文件已有无关改动，要在其基础上最小化编辑。
- 不要使用 `git reset --hard`、`git checkout -- <file>` 等破坏性命令，除非用户明确要求。
- 大型生成物、截图、zip、备份目录通常不应因为普通代码任务被改动。

## 修改后发布逻辑

每次完成修改并通过必要验证后，按以下顺序处理发布：

1. 只暂存本次 agent 实际修改/新增的文件，不要把用户已有的无关改动一起 stage。
2. 创建本地 git commit，作为本次修改的本地保存点。
3. 执行 `git push` 推送到远端分支。
4. 如果 `git push` 成功，不需要手动发布到 Vercel；Vercel 会根据远端仓库自动部署。
5. 如果 `git push` 失败，并且本地已安装且已登录 Vercel CLI，则执行 `vercel deploy --prod` 直接发布到 Vercel 作为兜底。
6. 如果 push 和 Vercel CLI 兜底都无法完成，要在交付说明中明确失败命令、失败原因和当前 commit 状态。

注意：

- 不要为了发布而提交 `.env.local`、密钥、临时 zip、截图、构建缓存或无关大文件。
- 如果当前分支、远端或部署目标不明确，先检查 `git branch --show-current`、`git remote -v` 和 Vercel 项目绑定。
- 如果用户明确要求只改代码不提交/不发布，则以用户本次指令为准。

## 交付说明

完成任务时，简要说明：

- 改了哪些文件和核心行为
- 运行了哪些验证命令及结果
- 未能验证的部分和原因
- 若发现既有风险，说明它是否与本次改动相关

## 推荐工作方式

1. 先快速读 `package.json`、相关 `src/lib` 服务、相邻测试和对应 route/page。
2. 对业务逻辑改动，优先从测试或可验证行为入手。
3. 小步修改，小步验证。
4. 对积分、会员、支付、生成、安全、Supabase/RLS 这类高风险区域，宁可多验证一步。
5. 保持交付信息短而准确，让下一个接手的人能继续工作。
