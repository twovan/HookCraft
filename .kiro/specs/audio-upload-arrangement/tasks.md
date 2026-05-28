# Implementation Plan: Audio Upload Arrangement

## Overview

在现有 AI 创作中心（/studio 页面）中新增"上传音频生成编曲"Tab 页面，集成 MiniMax music-cover API。实现包括：音频上传与校验、波形可视化、MiniMax 预处理 API 集成、编曲参数编辑面板、Prompt 构建、生成流程（含 Credits 扣减和敏感词检查）、结果播放，以及 Tab 状态隔离和错误恢复机制。

## Tasks

- [x] 1. 定义核心类型和接口
  - [x] 1.1 创建 `src/types/arrangement.ts` 类型定义文件
    - 定义 `ArrangementParams`、`MusicalKey`、`MusicalScale`、`AudioSetting` 接口
    - 定义 `PreprocessInput`、`PreprocessResult`、`ArrangementGenerationInput`、`ArrangementGenerationResult` 接口
    - 定义 `AudioUploadTabState` 状态接口，包含 uploadStatus、preprocessStatus、generationStatus 等
    - 定义 `ValidationResult` 接口
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 1.2 创建 `src/lib/generation/MiniMaxProvider.ts` 服务类
    - 实现 `MiniMaxProvider` 类，封装 MiniMax API 认证和请求
    - 实现 `preprocess(input: PreprocessInput): Promise<PreprocessResult>` 方法
    - 实现 `generateArrangement(input: ArrangementGenerationInput): Promise<ArrangementGenerationResult>` 方法
    - 处理 API 错误和超时（60s 预处理，300s 生成）
    - _Requirements: 3.1, 3.2, 6.4, 6.9_

- [x] 2. 实现音频校验和工具函数
  - [x] 2.1 创建 `src/lib/audio/validateAudioFile.ts` 音频校验模块
    - 实现 `validateAudioFile(file: File): Promise<ValidationResult>` 函数
    - 按顺序校验：格式（MP3/WAV）→ 大小（≤50MB）→ 时长（6s-180s）
    - 实现 `getAudioDuration(file: File): Promise<number>` 使用 Web Audio API 获取时长
    - 处理音频解码失败的情况，返回对应错误信息
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.10_

  - [ ]* 2.2 编写 `validateAudioFile` 属性测试
    - **Property 1: Audio Validation Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9**

  - [x] 2.3 创建 `src/lib/audio/fileToBase64Worker.ts` Web Worker 文件
    - 实现 Web Worker 中的 Base64 编码逻辑
    - 支持 postMessage 通信，接收 File ArrayBuffer，返回 Base64 字符串
    - 支持 Worker 终止（用户离开页面时）
    - _Requirements: 13.1, 13.5_

  - [x] 2.4 创建 `src/lib/audio/fileToBase64.ts` 主线程封装
    - 实现 `fileToBase64(file: File): Promise<string>` 函数
    - 对 ≥1MB 文件使用 Web Worker 编码，小文件直接在主线程处理
    - 编码完成后释放 ArrayBuffer 引用
    - _Requirements: 13.1, 13.3_

  - [x] 2.5 创建 `src/lib/audio/buildArrangementPrompt.ts` Prompt 构建函数
    - 实现 `buildArrangementPrompt(params: ArrangementParams): string`
    - 包含 BPM、调性、音阶、乐器名称
    - 追加用户风格描述
    - 截断至 2000 字符
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [ ]* 2.6 编写 `buildArrangementPrompt` 属性测试
    - **Property 3: Prompt Construction Validity**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 2.7 创建 `src/lib/audio/validateLyricsStructure.ts` 歌词结构校验
    - 实现 `validateLyricsStructure(lyrics: string): boolean`
    - 检查歌词是否包含至少一个结构标签（[verse], [chorus], [bridge], [intro], [outro]）
    - _Requirements: 5.4, 5.5_

  - [ ]* 2.8 编写 `validateLyricsStructure` 属性测试
    - **Property 4: Lyrics Structure Tag Validation**
    - **Validates: Requirements 5.4**

- [x] 3. Checkpoint - 确保核心工具函数测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. 实现 API Routes
  - [x] 4.1 创建 `src/app/api/minimax/preprocess/route.ts` 预处理 API
    - 实现 POST handler，验证用户认证（session token）
    - 服务端校验：音频数据非空、MIME 类型为 MP3/WAV、大小 ≤50MB、时长 6s-180s
    - 实现用户级速率限制（10 requests/user/minute）
    - 调用 MiniMaxProvider.preprocess()，返回 coverFeatureId、lyrics、structure、duration
    - 未认证返回 401，超限返回 429
    - _Requirements: 3.1, 3.2, 8.1, 8.3, 8.4, 8.5, 10.1, 10.2, 10.4, 10.5_

  - [ ]* 4.2 编写 preprocess API route 单元测试
    - 测试认证校验（401）、速率限制（429）、参数校验
    - **Property 9: Authentication Enforcement**
    - **Property 10: Server-Side Validation Consistency**
    - **Validates: Requirements 8.1, 8.3, 10.1, 10.2**

  - [x] 4.3 创建 `src/app/api/minimax/generate/route.ts` 生成 API
    - 实现 POST handler，验证用户认证
    - 设置 `maxDuration = 300` 适配 Vercel serverless 超时
    - 调用 CreditService 检查余额
    - 调用 SensitivityFilterService 检查 prompt 和 lyrics
    - 调用 MiniMaxProvider.generateArrangement()
    - 成功后：上传音频到 Supabase Storage，创建 generation_tasks 记录（generation_type: 'arrangement'），扣减 Credits
    - 失败时不扣减 Credits
    - 实现用户级速率限制（10 requests/user/minute）
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3, 8.4, 8.5, 10.3, 13.4_

  - [ ]* 4.4 编写 generate API route 单元测试
    - 测试 Credits 检查、敏感词检查、认证校验、生成成功/失败流程
    - **Property 2: Credits Consistency**
    - **Property 7: Sensitivity Check Blocking**
    - **Validates: Requirements 6.4, 6.5, 7.3**

- [x] 5. Checkpoint - 确保 API Routes 测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 实现前端组件 - AudioUploader
  - [x] 6.1 创建 `src/components/studio/AudioUploader.tsx` 音频上传组件
    - 实现拖拽上传区域（drag & drop）和点击选择文件
    - 集成 `validateAudioFile` 进行客户端校验
    - 显示校验状态（validating → ready / error）
    - 显示具体错误信息（格式、大小、时长）
    - 实现文件移除功能，释放 AudioBuffer 引用
    - 支持替换文件（ready 状态下拖入新文件）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

  - [x] 6.2 创建 `src/components/studio/WaveformVisualizer.tsx` 波形可视化组件
    - 使用 Web Audio API 解码音频并渲染 Canvas 波形
    - 对超过 60s 的音频降采样至 2000 数据点
    - 显示音频时长（mm:ss 格式）
    - 解码失败时显示错误信息
    - 渲染完成后释放 AudioBuffer 引用
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 13.2, 13.3_

- [x] 7. 实现前端组件 - ArrangementParamsEditor
  - [x] 7.1 创建 `src/components/studio/ArrangementParamsEditor.tsx` 参数编辑面板
    - 时长选择按钮组（30/60/90/120s，默认 60s）
    - BPM 滑块（60-200，步进 1，默认 120）
    - 调性选择器（12 个半音，默认 C）
    - 音阶选择器（major/minor/dorian/mixolydian/pentatonic，默认 major）
    - 乐器多选标签（1-10 个）
    - 风格描述 Prompt 输入（最大 2000 字符，可选）
    - 歌词编辑器（预填充提取歌词，最大 3500 字符）
    - 纯器乐模式切换（启用时禁用歌词编辑器，保留内容）
    - 输出格式选择（MP3/WAV，默认 MP3）
    - 预处理未完成时禁用生成按钮和参数控件
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

- [x] 8. 实现前端组件 - AudioUploadTab 容器
  - [x] 8.1 创建 `src/components/studio/AudioUploadTab.tsx` Tab 容器组件
    - 实现左右分栏布局（左：音频上传，右：参数编辑）
    - 管理 AudioUploadTabState 状态机（idle → validating → ready → processing → completed → generating → done/error）
    - 集成 AudioUploader、WaveformVisualizer、ArrangementParamsEditor 子组件
    - 实现"分析音频"按钮逻辑：调用 /api/minimax/preprocess，显示 loading，禁用重复请求
    - 预处理成功后预填充歌词到 ParamEditor
    - 实现"生成编曲"按钮逻辑：构建 prompt，调用 /api/minimax/generate
    - 处理 Credits 不足提示和充值链接
    - 处理敏感词检查结果（block/rewrite/pass）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 7.1, 7.2, 7.3, 7.4_

  - [x] 8.2 实现生成结果展示和播放功能
    - 生成完成后显示音频播放器（play/pause/seek/volume）
    - 非纯器乐模式显示歌词文本
    - 实现"重新生成"功能，保留参数和音频，无需重新上传
    - 生成失败时显示错误信息，保留文件和参数
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 8.3 实现错误恢复机制
    - 网络中断时显示提示，保存任务记录到数据库
    - 页面刷新后查询 pending/completed 任务并显示状态
    - 预处理失败时保留文件，提供"重新分析"按钮（最多 3 次重试）
    - 预处理错误回到 ready 状态，生成错误回到 preprocessing-completed 状态
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 9. 集成 Tab 导航到 /studio 页面
  - [x] 9.1 修改 `src/app/studio/page.tsx` 添加 Tab 切换逻辑
    - 添加 Tab 导航 UI（"模板生成" 和 "上传编曲" 两个 Tab）
    - 默认激活"模板生成"Tab
    - Tab 切换时保持各 Tab 状态独立（不销毁组件）
    - 切换响应时间 < 200ms（无全页面刷新）
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 9.2 编写 Tab 状态隔离测试
    - **Property 6: Tab State Isolation**
    - **Validates: Requirements 9.2**

- [x] 10. Checkpoint - 确保前端组件集成正常
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. 实现 Credits 集成和数据库扩展
  - [x] 11.1 扩展 `src/config/creditsCost.ts` 添加 arrangement_generation 费用规则
    - 添加 `arrangement_generation` 类型的 Credits 消费配置
    - _Requirements: 6.1, 6.5_

  - [x] 11.2 创建数据库迁移脚本 `scripts/add-arrangement-generation-type.sql`
    - 扩展 generation_tasks 表支持 generation_type = 'arrangement'
    - 添加 cover_feature_id、source_audio_duration 字段（如不存在）
    - _Requirements: 6.7_

- [x] 12. 端到端集成和最终验证
  - [x] 12.1 在 AudioUploadTab 中集成 Web Worker 生命周期管理
    - 用户离开页面时终止 Web Worker
    - 编码完成后释放内存引用
    - _Requirements: 13.3, 13.5_

  - [ ]* 12.2 编写端到端集成测试
    - 测试完整流程：上传 → 预处理 → 参数编辑 → 生成 → 播放
    - 测试错误恢复流程
    - **Property 5: State Machine Consistency**
    - **Property 8: Error Recovery Preserves Upload**
    - **Validates: Requirements 12.4, 3.4, 12.3, 11.3**

- [x] 13. Final checkpoint - 确保所有测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript, Next.js 14, React 18, Zustand for state management, Supabase for storage/DB
- Existing patterns to follow: `src/lib/generation/LyriaProvider.ts` for API provider, `src/lib/credits/CreditService.ts` for credits, `src/lib/sensitivity/SensitivityFilterService.ts` for sensitivity checks
- MiniMax API Key stored in `.env.local` as server-side environment variable (never exposed to client)
- fast-check is already available in devDependencies for property-based testing
- vitest is the test runner

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.5", "2.7"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.6", "2.8", "11.1", "11.2"] },
    { "id": 3, "tasks": ["2.4", "4.1", "4.3"] },
    { "id": 4, "tasks": ["4.2", "4.4"] },
    { "id": 5, "tasks": ["6.1", "6.2", "7.1"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3"] },
    { "id": 8, "tasks": ["9.1"] },
    { "id": 9, "tasks": ["9.2", "12.1"] },
    { "id": 10, "tasks": ["12.2"] }
  ]
}
```
