# Implementation Plan: 敏感词拦截与智能提示词改写

## Overview

本实现计划将敏感词检测与智能改写功能分解为增量式编码任务。从数据层和类型定义开始，逐步构建核心服务层（本地匹配器、Gemini 检测器、过滤服务），然后实现 API 端点，最后完成前端组件集成。每个任务都建立在前一步的基础上，确保代码始终可运行。

## Tasks

- [x] 1. 定义类型和数据库结构
  - [x] 1.1 创建 TypeScript 类型定义文件
    - 创建 `src/types/sensitivity.ts`，定义所有接口和类型：`SensitiveWordCategory`、`SensitivityResultType`、`SensitiveWordEntry`、`SensitivityCheckInput`、`SensitivityCheckResult`、`DescriptionCheckResult`、`LyricsCheckResult`、`DetectedWord`、`LocalMatchResult`、`DetectAndRewriteInput`、`DetectAndRewriteResult`、`RewriteOnlyInput`、`RewriteResult`、`SensitivityLogEntry`
    - _Requirements: 1.8, 6.6_

  - [x] 1.2 创建 Supabase 数据库迁移脚本
    - 创建 `scripts/create-sensitivity-tables.sql`，包含 `sensitive_words` 表和 `sensitivity_logs` 表的建表语句
    - 包含索引定义（word 字段、category 字段、created_at 字段）
    - _Requirements: 7.1, 6.4_

- [x] 2. 实现本地敏感词匹配器
  - [x] 2.1 实现 LocalWordMatcher 类
    - 创建 `src/lib/sensitivity/LocalWordMatcher.ts`
    - 实现 `initialize()` 方法：从 Supabase 加载敏感词库到内存
    - 实现 `refreshIfNeeded()` 方法：每 60 秒检查并刷新缓存
    - 实现 `match(text: string)` 方法：对文本执行本地匹配，支持精确匹配和变体匹配
    - 匹配逻辑需支持大小写不敏感、变体词匹配
    - _Requirements: 7.1, 7.2, 7.5, 7.6, 7.7_

  - [ ]* 2.2 编写 LocalWordMatcher 属性测试
    - **Property 7: Variant matching covers all registered forms**
    - **Validates: Requirements 7.5**

  - [ ]* 2.3 编写 LocalWordMatcher 单元测试
    - 测试精确匹配、变体匹配、大小写处理、空输入、无命中场景
    - _Requirements: 7.5, 7.6_

- [x] 3. 实现 Gemini 语义检测与改写服务
  - [x] 3.1 实现 GeminiSensitivityDetector 类
    - 创建 `src/lib/sensitivity/GeminiSensitivityDetector.ts`
    - 实现 `detectAndRewrite()` 方法：单次 Gemini Flash 调用完成语义检测 + Prompt 改写 + Style Tags 提取
    - 实现 `rewriteOnly()` 方法：本地已命中时跳过检测直接改写
    - 构建 Gemini Prompt 模板，要求返回结构化 JSON 响应
    - 实现超时处理（3s 超时）和响应解析逻辑
    - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 5.4_

  - [ ]* 3.2 编写 GeminiSensitivityDetector 属性测试
    - **Property 2: Style tags count invariant**
    - **Validates: Requirements 2.3**

  - [ ]* 3.3 编写 GeminiSensitivityDetector 属性测试
    - **Property 3: Rewritten prompt contains no sensitive words**
    - **Validates: Requirements 2.5**

  - [ ]* 3.4 编写 GeminiSensitivityDetector 单元测试
    - 测试 Prompt 构建、响应解析、超时处理、格式异常降级
    - _Requirements: 2.1, 2.4, 2.6_

- [x] 4. Checkpoint - 确保核心服务层测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. 实现核心过滤服务
  - [x] 5.1 实现 SensitivityFilterService 类
    - 创建 `src/lib/sensitivity/SensitivityFilterService.ts`
    - 实现 `check()` 方法：完整检测流程编排
    - 流程：歌词优先检测 → 本地词库匹配 → Gemini 语义检测+改写
    - 实现降级策略：Gemini 失败时仅依赖本地结果
    - 实现结果类型判定逻辑：forbidden → block，celebrity/song_name → rewrite，无命中 → pass
    - 计算并返回 durationMs
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 4.1, 4.5, 4.6_

  - [ ]* 5.2 编写 SensitivityFilterService 属性测试
    - **Property 1: Result type classification is determined by word category**
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.8**

  - [ ]* 5.3 编写 SensitivityFilterService 属性测试
    - **Property 4: Lyrics sensitive words always result in block**
    - **Validates: Requirements 4.2, 4.5**

  - [ ]* 5.4 编写 SensitivityFilterService 属性测试
    - **Property 5: Lyrics block short-circuits description processing**
    - **Validates: Requirements 4.6**

  - [ ]* 5.5 编写 SensitivityFilterService 属性测试
    - **Property 6: API response structure completeness**
    - **Validates: Requirements 6.3, 6.6**

  - [ ]* 5.6 编写 SensitivityFilterService 单元测试
    - 测试完整流程（mock Gemini）、降级策略、优先级逻辑、歌词短路逻辑
    - _Requirements: 1.6, 4.6_

- [x] 6. 实现日志服务
  - [x] 6.1 实现 SensitivityLogService 类
    - 创建 `src/lib/sensitivity/SensitivityLogService.ts`
    - 实现 `log()` 方法：记录检测日志到 `sensitivity_logs` 表
    - 实现 `getLogs()` 方法：查询检测日志（支持分页）
    - 实现 `incrementHitCount()` 方法：更新敏感词命中次数
    - _Requirements: 6.4, 8.7, 8.8_

- [x] 7. 实现敏感词检测 API 端点
  - [x] 7.1 实现 /api/sensitivity-check 端点
    - 创建 `src/app/api/sensitivity-check/route.ts`
    - 实现 POST 方法：接收 `{ description, lyrics? }` 请求体
    - 调用 SensitivityFilterService.check() 执行检测
    - 调用 SensitivityLogService.log() 记录日志
    - 返回结构化 JSON 响应（包含 passed、resultType、descriptionResult、lyricsResult、rewrittenPrompt、styleTags、blockedWords、durationMs）
    - 实现请求验证（description 必填）
    - _Requirements: 6.1, 6.3, 6.5, 6.6_

  - [ ]* 7.2 编写 /api/sensitivity-check 集成测试
    - 测试端到端请求响应、请求验证、错误处理、响应格式
    - _Requirements: 6.6_

- [x] 8. Checkpoint - 确保后端 API 测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. 实现管理后台服务和 API
  - [x] 9.1 实现 SensitiveWordAdminService 类
    - 创建 `src/lib/sensitivity/SensitiveWordAdminService.ts`
    - 实现 `list()` 方法：获取敏感词列表（支持分页、按分类筛选）
    - 实现 `create()` 方法：新增敏感词
    - 实现 `update()` 方法：编辑敏感词
    - 实现 `delete()` 方法：删除敏感词
    - 实现 `batchImport()` 方法：批量导入（去重处理）
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ]* 9.2 编写 SensitiveWordAdminService 属性测试
    - **Property 8: Batch import preserves all valid entries**
    - **Validates: Requirements 8.5**

  - [x] 9.3 实现管理后台 API 端点
    - 创建 `src/app/api/admin/sensitive-words/route.ts`（GET 列表 + POST 新增）
    - 创建 `src/app/api/admin/sensitive-words/[id]/route.ts`（PUT 编辑 + DELETE 删除）
    - 创建 `src/app/api/admin/sensitive-words/batch/route.ts`（POST 批量导入）
    - 创建 `src/app/api/admin/sensitivity-logs/route.ts`（GET 日志列表）
    - 所有端点需验证管理员权限
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.8_

- [x] 10. 实现前端检测 Hook 和弹窗组件
  - [x] 10.1 实现 useSensitivityCheck Hook
    - 创建 `src/hooks/useSensitivityCheck.ts`
    - 管理检测状态：idle、loading、success、error
    - 封装 /api/sensitivity-check 调用
    - 实现加载提示文案切换逻辑（2s 后切换为"正在进行内容安全检查..."）
    - 实现降级策略：请求失败时允许继续生成
    - _Requirements: 5.1, 5.2, 5.3, 5.6, 6.5_

  - [x] 10.2 实现 SensitivityConfirmDialog 确认弹窗组件
    - 创建 `src/components/studio/SensitivityConfirmDialog.tsx`
    - 展示提示信息，动态插入 Style_Tags
    - 包含【是】和【否】按钮
    - 点击【是】触发回调（使用改写 Prompt 调用生成 API）
    - 点击【否】关闭弹窗返回编辑
    - 实现淡入动画
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 10.3 实现 SensitivityBlockDialog 拦截弹窗组件
    - 创建 `src/components/studio/SensitivityBlockDialog.tsx`
    - 展示拦截提示信息
    - 高亮标注检测到的违禁词/敏感词
    - 确认后关闭弹窗，光标定位到对应输入区域
    - 支持创作描述违禁词和歌词敏感词两种场景
    - _Requirements: 3.1(需求3.1), 3.1.2, 3.1.3, 3.1.4, 3.1.5, 4.2, 4.3, 4.4_

- [x] 11. 集成到创作页面
  - [x] 11.1 将敏感词检测集成到创作流程
    - 修改创作页面的【开始创作】按钮点击逻辑
    - 点击后先调用 useSensitivityCheck 执行检测
    - 根据检测结果展示对应弹窗或直接进入生成流程
    - 用户确认改写后，使用 rewrittenPrompt 作为 userPrompt 调用生成 API
    - 展示 Loading_Indicator 加载状态
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 6.1, 6.2_

- [x] 12. 实现管理后台页面
  - [x] 12.1 实现敏感词管理页面
    - 创建 `src/app/admin/sensitive-words/page.tsx`
    - 展示敏感词列表（支持分类筛选、分页）
    - 支持新增、编辑、删除操作（含确认提示）
    - 支持批量导入功能
    - 展示命中次数和最近命中时间
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 12.2 实现检测日志页面
    - 创建 `src/app/admin/sensitivity-logs/page.tsx`
    - 展示最近的检测记录列表
    - 包含用户输入、检测结果、是否触发改写、用户是否确认继续
    - 支持分页浏览
    - _Requirements: 8.8_

- [x] 13. Final checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design document
- Unit tests validate specific examples and edge cases
- 项目已配置 vitest 和 fast-check 依赖，无需额外安装
- 所有服务类遵循项目现有的 `src/lib/` 目录结构模式
- 管理后台 API 端点遵循项目现有的 `src/app/api/admin/` 路由模式

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "3.4", "6.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 6, "tasks": ["7.1", "9.1"] },
    { "id": 7, "tasks": ["7.2", "9.2", "9.3"] },
    { "id": 8, "tasks": ["10.1", "10.2", "10.3", "12.1", "12.2"] },
    { "id": 9, "tasks": ["11.1"] }
  ]
}
```
