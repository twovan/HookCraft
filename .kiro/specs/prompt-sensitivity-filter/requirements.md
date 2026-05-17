# 需求文档：敏感词拦截与智能提示词改写

## 简介

本功能为 AI 音乐生成平台（HookCraft）增加敏感词拦截与智能提示词改写能力。当用户在创作描述中引用明星名字或歌曲名称时，系统通过调用廉价语言模型（Gemini Flash）将其转化为合规的、详细的 Lyria 3 音乐描述 Prompt，在保护版权的同时保留用户期望的音乐风格。对于歌词中出现的明星名字或违禁词，系统直接拦截并提示用户修改。

整体设计目标：用户体验丝滑无感，检测与改写在后台快速完成，用户只在必要时看到一次确认弹窗，确认后即可无缝进入生成流程。

## 术语表

- **Sensitivity_Filter（敏感词过滤器）**：负责检测用户输入中是否包含敏感词（明星名字、歌曲名称、违禁词）的服务模块
- **Prompt_Rewriter（提示词改写器）**：调用 Gemini Flash 模型，将包含敏感词的创作描述改写为合规的 Lyria 3 音乐描述 Prompt 的服务模块
- **Creation_Description（创作描述）**：用户在创作页面输入的音乐风格描述文本（即 userPrompt 字段）
- **Custom_Lyrics（自定义歌词）**：用户在创作页面输入的歌词文本（即 customLyrics 字段）
- **Style_Tags（风格标签）**：由 Prompt_Rewriter 从敏感词中提取的音乐风格关键词，用于向用户展示改写后的风格方向
- **Sensitive_Word（敏感词）**：包括明星名字、歌曲名称、以及其他违禁词汇
- **Confirmation_Dialog（确认弹窗）**：当创作描述中检测到敏感词时，向用户展示的确认对话框
- **Rejection_Dialog（拒绝弹窗）**：当歌词中检测到敏感词或违禁词时，向用户展示的拒绝修改对话框
- **Gemini_Flash（Gemini Flash 模型）**：Google 提供的廉价、快速的语言模型，用于敏感词检测和提示词改写
- **Lyria_3**：Google 的 AI 音乐生成模型，接收英文音乐描述 Prompt 生成音频
- **Admin_Panel（管理后台）**：平台管理员使用的后台管理界面，用于管理敏感词库等运营配置
- **Sensitive_Word_Library（本地敏感词库）**：存储在数据库中的敏感词列表，包含明星名字、歌曲名称和违禁词三种分类
- **Loading_Indicator（加载指示器）**：检测过程中向用户展示的加载动画，提供视觉反馈

## 需求

### 需求 1：创作描述敏感词检测

**用户故事：** 作为平台运营方，我希望系统能自动检测用户创作描述中的敏感词，以避免因版权问题导致生成失败或法律风险。

#### 验收标准

1. WHEN 用户点击【开始创作】按钮，THE Sensitivity_Filter SHALL 先对 Creation_Description 执行本地敏感词库快速匹配
2. WHEN 本地敏感词库未命中，THE Sensitivity_Filter SHALL 调用 Gemini_Flash 模型对 Creation_Description 进行语义级敏感词检测
3. WHEN Creation_Description 中包含明星名字或歌曲名称（本地匹配或模型检测），THE Sensitivity_Filter SHALL 返回检测结果，包含检测到的敏感词列表和敏感词类型（明星名字或歌曲名称），触发智能改写流程
4. WHEN Creation_Description 中包含违禁词（本地匹配或模型检测），THE Sensitivity_Filter SHALL 直接拦截生成流程，返回拦截结果，包含检测到的违禁词列表，触发 Rejection_Dialog（不进行改写）
5. WHEN Creation_Description 中不包含任何 Sensitive_Word，THE Sensitivity_Filter SHALL 返回通过结果，允许生成流程继续执行
6. IF Gemini_Flash 模型调用失败或超时，THEN THE Sensitivity_Filter SHALL 允许生成流程继续执行并记录错误日志（降级策略：不阻塞用户）
7. THE Sensitivity_Filter SHALL 在 3 秒内完成检测并返回结果
8. THE Sensitivity_Filter SHALL 区分三种检测结果类型：pass（通过）、rewrite（需改写，针对明星名字/歌曲名称）、block（直接拦截，针对违禁词）

### 需求 2：创作描述智能改写

**用户故事：** 作为用户，我希望当我引用了明星或歌曲名称时，系统能自动将其转化为详细的音乐风格描述，让我仍然能获得风格相似的原创歌曲。

#### 验收标准

1. WHEN Sensitivity_Filter 检测到 Creation_Description 中包含明星名字或歌曲名称，THE Prompt_Rewriter SHALL 调用 Gemini_Flash 模型将原始描述改写为详细的 Lyria_3 音乐和人声描述 Prompt
2. THE Prompt_Rewriter SHALL 在一次 Gemini_Flash 调用中同时完成敏感词检测和 Prompt 改写（合并为单次请求，减少延迟）
3. THE Prompt_Rewriter SHALL 从原始描述中提取 2 至 5 个 Style_Tags 用于向用户展示改写后的风格方向
4. THE Prompt_Rewriter SHALL 生成的改写 Prompt 为英文格式，包含音乐流派、BPM 范围、乐器编排、人声特征、情绪氛围等维度的详细描述
5. THE Prompt_Rewriter SHALL 确保改写后的 Prompt 不包含任何明星名字、歌曲名称或其他 Sensitive_Word
6. IF Prompt_Rewriter 改写失败，THEN THE Prompt_Rewriter SHALL 返回错误信息，阻止生成流程继续执行并提示用户手动修改描述

### 需求 3：创作描述敏感词确认弹窗

**用户故事：** 作为用户，我希望在系统检测到敏感词后能看到清晰的提示，了解为什么不能直接使用原始描述，并能选择是否继续使用改写后的描述生成歌曲。

#### 验收标准

1. WHEN Sensitivity_Filter 检测到 Creation_Description 中包含明星名字或歌曲名称（rewrite 类型），THE Confirmation_Dialog SHALL 显示提示信息："非常抱歉，因版权保护，我们暂时无法直接模仿和引用TA的作品，但我们能为你生成【风格标签1/风格标签2/风格标签3】的歌曲，是否继续生成歌曲？"
2. THE Confirmation_Dialog SHALL 包含两个操作按钮：【是】和【否】
3. WHEN 用户点击【是】按钮，THE Confirmation_Dialog SHALL 关闭弹窗并立即进入生成流程（使用已准备好的改写 Prompt），无需二次等待
4. WHEN 用户点击【否】按钮，THE Confirmation_Dialog SHALL 关闭弹窗，返回创作页面，保留用户原始输入内容不做修改
5. THE Confirmation_Dialog SHALL 在 Style_Tags 位置动态展示 Prompt_Rewriter 提取的实际风格标签
6. THE Confirmation_Dialog SHALL 使用平滑的淡入动画展示，避免突兀的弹窗体验

### 需求 3.1：创作描述违禁词拦截弹窗

**用户故事：** 作为平台运营方，我希望当用户创作描述中出现违禁词时，系统直接拦截并提示用户修改，不提供改写选项。

#### 验收标准

1. WHEN Sensitivity_Filter 检测到 Creation_Description 中包含违禁词（block 类型），THE Rejection_Dialog SHALL 显示提示信息，告知用户创作描述中包含不合规内容，需要返回修改
2. THE Rejection_Dialog SHALL 明确指出检测到的违禁词内容并高亮标注，帮助用户快速定位需要修改的部分
3. WHEN 用户确认 Rejection_Dialog，THE Rejection_Dialog SHALL 关闭弹窗，返回创作页面，光标自动定位到创作描述输入区域
4. WHILE Creation_Description 中包含违禁词，THE Sensitivity_Filter SHALL 阻止音乐生成流程执行（不进行改写，不允许继续）
5. THE Rejection_Dialog SHALL 与歌词违禁词拦截弹窗使用一致的视觉风格，保持用户体验统一

### 需求 4：歌词敏感词拦截

**用户故事：** 作为平台运营方，我希望系统能拦截歌词中出现的明星名字和违禁词，以确保生成内容的合规性。

#### 验收标准

1. WHEN 用户点击【开始创作】按钮且 Custom_Lyrics 不为空，THE Sensitivity_Filter SHALL 对 Custom_Lyrics 进行敏感词检测
2. WHEN Custom_Lyrics 中包含明星名字或违禁词，THE Rejection_Dialog SHALL 显示提示信息，告知用户歌词中包含不合规内容，需要返回修改
3. THE Rejection_Dialog SHALL 明确指出检测到的敏感词内容并高亮标注，帮助用户快速定位需要修改的部分
4. WHEN 用户确认 Rejection_Dialog，THE Rejection_Dialog SHALL 关闭弹窗，返回创作页面，光标自动定位到歌词输入区域
5. WHILE Custom_Lyrics 中包含 Sensitive_Word，THE Sensitivity_Filter SHALL 阻止音乐生成流程执行
6. THE Sensitivity_Filter SHALL 优先检测 Custom_Lyrics，若歌词不合规则直接拦截，不再对 Creation_Description 执行检测和改写（避免不必要的 API 调用）

### 需求 5：丝滑的检测交互体验

**用户故事：** 作为用户，我希望敏感词检测过程快速且无感知，不会打断我的创作流程。

#### 验收标准

1. WHEN 用户点击【开始创作】按钮，THE Loading_Indicator SHALL 立即展示"正在准备创作..."的加载状态，提供即时视觉反馈
2. WHEN 本地敏感词库命中（通常在 50ms 内完成），THE Sensitivity_Filter SHALL 立即触发 Prompt_Rewriter 进行改写，用户仅感知到短暂的加载动画
3. WHEN 检测通过（无敏感词），THE Loading_Indicator SHALL 平滑过渡到生成状态，用户无感知地进入正常生成流程
4. THE Sensitivity_Filter SHALL 将敏感词检测和 Prompt 改写合并为单次 Gemini_Flash API 调用，在一次请求中同时返回：是否包含敏感词、敏感词列表、改写后的 Prompt、Style_Tags
5. WHEN 检测和改写完成后弹出 Confirmation_Dialog，THE Confirmation_Dialog SHALL 已包含完整的改写结果，用户点击【是】后无需等待即可开始生成
6. IF 检测耗时超过 2 秒，THEN THE Loading_Indicator SHALL 更新提示文案为"正在进行内容安全检查..."，避免用户以为系统卡住

### 需求 6：敏感词检测与改写的集成

**用户故事：** 作为开发者，我希望敏感词检测和改写功能能无缝集成到现有的音乐生成流水线中，不影响现有功能的正常运行。

#### 验收标准

1. THE Sensitivity_Filter SHALL 作为独立的 API 端点（/api/sensitivity-check）提供服务，前端在调用生成 API 之前先调用此端点
2. WHEN 用户通过 Confirmation_Dialog 确认继续生成，THE 前端 SHALL 将 Prompt_Rewriter 生成的改写 Prompt 作为 userPrompt 字段传递给生成 API
3. THE Sensitivity_Filter SHALL 同时支持对 Creation_Description 和 Custom_Lyrics 的检测，在单次 API 调用中返回两者的检测结果
4. THE Sensitivity_Filter SHALL 将检测和改写结果记录到数据库中，包含原始输入、检测到的敏感词、改写后的 Prompt、用户是否确认继续
5. IF 用户的 Creation_Description 不包含敏感词且 Custom_Lyrics 不包含敏感词，THEN THE 前端 SHALL 直接调用生成 API，无额外延迟
6. THE Sensitivity_Filter API SHALL 返回结构化的 JSON 响应，包含字段：passed（是否通过）、resultType（结果类型：pass/rewrite/block）、descriptionResult（描述检测结果，含 type 字段区分 rewrite 或 block）、lyricsResult（歌词检测结果）、rewrittenPrompt（改写后的 Prompt，仅 rewrite 类型时有值）、styleTags（风格标签列表，仅 rewrite 类型时有值）、blockedWords（被拦截的违禁词列表，仅 block 类型时有值）

### 需求 7：本地敏感词库

**用户故事：** 作为平台运营方，我希望系统维护一个本地敏感词库，作为 Gemini Flash 语义检测的补充，确保高频敏感词能被快速、准确地拦截。

#### 验收标准

1. THE Sensitivity_Filter SHALL 维护一个本地敏感词库，存储在数据库中，包含明星名字、歌曲名称和违禁词三种分类
2. THE Sensitivity_Filter SHALL 先执行本地敏感词库的快速匹配，再调用 Gemini_Flash 进行语义级别检测
3. WHEN 本地敏感词库匹配命中，THE Sensitivity_Filter SHALL 直接触发 Prompt_Rewriter 进行改写，无需调用 Gemini_Flash 进行检测（但改写仍需调用 Gemini_Flash）
4. WHEN 本地敏感词库未命中，THE Sensitivity_Filter SHALL 调用 Gemini_Flash 模型进行语义级别的敏感词识别（识别变体、昵称、英文名、拼音等）
5. THE Sensitivity_Filter SHALL 支持本地敏感词库的模糊匹配，能匹配到敏感词的部分变体形式（如"孙燕姿"匹配"燕姿"、"周杰伦"匹配"杰伦"、"Jay Chou"等）
6. THE Sensitivity_Filter SHALL 在服务启动时将本地敏感词库加载到内存中，后续检测直接使用内存数据，确保本地匹配延迟低于 50ms
7. WHEN 管理员通过 Admin_Panel 修改敏感词库，THE Sensitivity_Filter SHALL 在 60 秒内刷新内存中的敏感词数据

### 需求 8：敏感词库后台管理

**用户故事：** 作为平台管理员，我希望能在后台管理界面中查看、新增、编辑和删除敏感词，以便及时应对版权和合规要求的变化。

#### 验收标准

1. THE Admin_Panel SHALL 提供敏感词库管理页面，展示所有敏感词条目的列表，支持按分类（明星名字、歌曲名称、违禁词）筛选
2. THE Admin_Panel SHALL 支持管理员新增敏感词条目，包含字段：敏感词内容、分类类型、关联变体词（可选）、备注说明
3. THE Admin_Panel SHALL 支持管理员编辑已有敏感词条目的内容、分类和备注
4. THE Admin_Panel SHALL 支持管理员删除敏感词条目，删除前显示确认提示
5. THE Admin_Panel SHALL 支持管理员批量导入敏感词（通过文本输入，每行一个敏感词，支持指定分类）
6. WHEN 管理员修改敏感词库，THE Sensitivity_Filter SHALL 在下次检测时使用最新的敏感词库数据（无需重启服务）
7. THE Admin_Panel SHALL 展示每个敏感词的命中次数和最近命中时间，帮助运营方了解拦截情况
8. THE Admin_Panel SHALL 提供敏感词检测日志页面，展示最近的检测记录，包含用户输入、检测结果、是否触发改写、用户是否确认继续
