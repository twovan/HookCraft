# HookCraft 参考 Splice 的 UI 重设计方案

日期：2026-05-25
状态：待评审

## 设计方向

采用 **A+B 混合方案**：

- 首页、模板库、制作人内容、音频浏览体验，参考 Splice 的“音乐素材发现和交易平台”结构。
- AI Studio 保持 HookCraft 的核心产品定位，重点服务生成流程、提示词输入、模板选择、Credits、版权安全检查和结果管理。

整体不要做成普通 AI 落地页，而要像一个真正面向音乐创作者的产品。首屏就应该能看到可用的产品界面：可试听模板卡片、风格筛选、生成入口、结果或版本状态。

## 产品目标

重设计后，用户进入第一屏时要立刻理解三件事：

1. HookCraft 可以从成熟的 hook、模板和风格出发，帮助用户快速开始音乐创作。
2. 用户可以基于模板或自定义描述，快速生成 AI demo。
3. 平台强调商业使用和版权安全，不只是随便玩玩的音乐生成器。

主转化路径：

`首页发现 -> 模板或 Studio -> 生成 -> 查看版本 -> 下载或管理作品`

次级转化路径：

`首页发现 -> 模板商城 -> 模板详情 -> 购买/使用模板 -> Studio`

## 信息架构

顶部导航建议：

- Logo：HookCraft
- Explore：发现页/首页
- Templates：模板市场与筛选
- Studio：AI 创作台
- Producers：精选制作人
- Pricing：会员与 Credits
- Account：作品、Credits、个人资料

首页模块建议：

- 首屏：产品界面片段 + AI 生成音乐视觉，不做纯营销横幅。
- 精选 hook / 模板：带试听控件。
- 风格频道：Pop、EDM、Hip-Hop、Lo-Fi、Rock、Jazz、Chinese Pop。
- 制作人精选。
- “从模板开始创作”横向引导区，链接到 Studio。
- 版权安全创作说明。
- 会员和 Credits 的轻量引导。

模板库：

- 桌面端可以左侧筛选，移动端改为顶部抽屉或折叠面板。
- 卡片信息包含封面、试听、标题、制作人、标签、BPM、Key、时长、价格/授权状态、主操作。
- 支持按最新、热门、价格、最近使用排序。

Studio：

- 桌面端采用高效双栏工作区。
- 左栏：模板浏览或已选模板、提示词、歌词、生成控制。
- 右栏：Credits/套餐状态、生成预览、版权安全提示、结果版本。
- 移动端顺序为：已选模板、提示词、控制项、生成按钮、结果。

## 视觉语言

整体气质：

- 现代音乐软件，专业、商业化，但不冰冷。
- 深色界面，高对比内容区域。
- 版式有节奏感，参考 DAW、采样网格、波形轨道、专辑封面墙。

避免：

- 整站只靠紫色渐变。
- 泛 AI 的发光球体、光斑背景。
- 过大的营销式 hero 卡片。
- 卡片套卡片。
- 首屏堆大量功能解释文字。

推荐色彩：

- 背景：`#08090C`
- 基础面板：`#111217`
- 抬高面板：`#181A22`
- 边框：`rgba(255,255,255,0.10)`
- 主操作酸性青柠：`#CEFF35`
- 辅助珊瑚橙：`#FF5A3D`
- 青色强调：`#52D6C6`
- 主文本：`#F4F1EA`
- 次文本：`#A8AAA3`
- 弱文本：`#70746C`
- 版权/警示：`#F5C542`
- 错误：`#FF5A5F`
- 成功：`#5CE08A`

青柠色用于主按钮、激活态和关键焦点。珊瑚橙和青色只用于标签、模板封面、波形和状态点缀。

## 字体与排版

优先使用兼容中文的系统字体，除非后续明确引入字体包。

- 字体栈：`Inter, "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
- 首屏大标题：桌面 56-72，移动 36-44，字重 800-900
- 页面标题：桌面 36-44，移动 28-34，字重 750-850
- 区块标题：桌面 24-32，移动 22-26，字重 750
- 卡片标题：15-18，字重 650-750
- 正文：14-16，字重 400-500
- 元信息：11-13，字重 500-700

字间距保持 `0`，不要使用随视口宽度缩放的字体大小。

## 布局标准

断点：

- 移动端：360-767
- 平板：768-1023
- 桌面：1024-1439
- 宽屏：1440+

间距：

- 页面左右边距：移动 20，平板 32，桌面 48。
- 区块上下间距：移动 56，桌面 80。
- 卡片圆角：8px。
- 胶囊按钮圆角：999px。
- 图标/工具按钮圆角：8px。
- 网格间距：移动/平板 16，桌面 20-24。

首页首屏：

- 使用全宽区块，不做漂浮卡片式首屏。
- 左侧或居中放品牌信息和 CTA。
- 右侧或背景放产品界面片段和 AI 生成视觉。
- 所有桌面和移动视口都要露出下一屏内容的一点提示。

模板网格：

- 1200px 以上 4 列，1024px 约 3 列，平板 2 列，移动 1 列。
- 模板卡封面固定 1:1。
- 专题横幅固定 16:9。
- Hover 显示播放按钮，但不能造成卡片尺寸变化。

Studio：

- 桌面布局：`minmax(360px, 440px) minmax(0, 1fr)`。
- 生成按钮可以在控制栏底部 sticky。
- 控制项应使用分段控件、开关、滑杆、选择器等熟悉模式。
- 结果版本使用音频行或音频卡片，有清楚的选中态。

## 组件标准

导航栏：

- 顶部 sticky，深色半透明面板，保证对比度。
- 当前页面使用青柠下划线或填充胶囊表示。
- 账号/Credits 区域显示紧凑余额。

模板卡片：

- 封面图。
- 播放/暂停图标按钮。
- 标题和制作人。
- 标签：风格、情绪、BPM、Key、人声/纯音乐。
- 价格或“已包含”。
- 主操作：使用、购买或加入购物车。
- Hover 和 active 状态不能改变卡片尺寸。

音频试听：

- 使用通用播放图标。
- 展示波形或简单进度条。
- 支持键盘访问。

筛选器：

- 多选风格/情绪用 checkbox。
- 全部/免费/付费用 radio 或分段控件。
- BPM/价格范围只有在真实可用时才展示 range 或数值输入。

Studio 生成面板：

- 模板选择器。
- 提示词输入。
- 纯音乐/人声开关。
- 选择人声时展示男女声分段控件。
- 时长分段控件。
- Credits 消耗预览。
- 版权安全说明作为辅助信息，不抢主流程。

结果/版本卡：

- 版本号。
- 状态。
- 音频播放器。
- 提示词和风格元信息。
- 选择、下载、重新生成操作。

## AI Image2 资产体系

这里的 `image2` 指：为 HookCraft 新界面生成一套 AI 图片资产，而不是复制 Splice 的素材。

资产类型：

- 首页主视觉：音乐感明确的抽象视觉，包含波形丝带、录音室设备暗示、专辑封面拼贴、华语流行/商业 demo 氛围。
- 模板封面：按风格和情绪生成正方形专辑封面式图片。
- 制作人封面：偏编辑感的人像或录音室场景。
- 空状态/加载状态：低对比的小型音乐物件或波形插画。

规则：

- 不直接模仿 Splice 的图片。
- 统一光线：深色录音室底色，青柠、珊瑚橙、青色点缀。
- 避免泛用霓虹光球背景。
- 避免图片中出现不可读的 AI 文字。
- 重要 UI 文案必须放在真实页面文本里，不放在位图里。

推荐图片生成提示词：

首页主视觉：

```text
premium music production interface, abstract waveform ribbons, album cover grid, modern recording studio, dark graphite background, acid lime and coral accents, high contrast, editorial product photography style, no readable text, no logos
```

模板封面：

```text
square album cover for [GENRE] hook template, energetic waveform sculpture, modern music artwork, dark base, acid lime cyan coral accents, clean composition, no readable text, no logos
```

制作人视觉：

```text
editorial music producer studio scene, laptop and audio controller, atmospheric but clear, dark graphite room, lime accent lights, premium commercial music production, no readable text, no logos
```

## 文案标准

当前产品以中文为主，音乐行业常用词可以保留英文，例如 Studio、BPM、Key、Credits。

推荐使用：

- 探索模板
- 进入 AI Studio
- 使用模板
- 试听
- 生成 2 个版本
- 版权安全说明
- 已包含
- 加入购物车

避免：

- 首屏长段落解释。
- 乱码或编码异常文本。
- 生产 UI 中使用装饰性 emoji。
- 在界面里用显性文字解释显而易见的视觉功能。

## 可访问性与响应式

- 所有交互控件都有清晰 focus 状态。
- 深色模式下文本对比度必须足够。
- 按钮点击区域至少 40px 高。
- 音频控件需要可访问名称。
- 卡片和按钮不能只依赖 hover。
- 移动端不使用 sticky 侧边栏，筛选改成顶部抽屉或折叠面板。

## 实施范围

本规格覆盖用户侧页面：

- `src/app/page.tsx`
- `src/app/templates/page.tsx`
- `src/app/templates/[id]/page.tsx`
- `src/app/studio/StudioPageClient.tsx`
- `src/app/account/creations/page.tsx`
- `src/components/Navbar.tsx`
- `src/components/Footer.tsx`
- 共享的 studio、producer、membership、template 组件
- `src/app/globals.css`

后台管理页面不在本轮范围内，除非需要共享 token 避免样式冲突。

## 技术方向

在 CSS 中建立共享设计 token：

- 颜色
- 间距
- 圆角
- 阴影
- 字体
- focus ring

将重复的 inline style 逐步收敛到 CSS class 或小型组件里。保持改动聚焦，不做无关的大型设计系统重写。

触碰用户侧文件时，需要同步修复可见的中文乱码文案。

## 测试与验收

实施后需要验证：

- `npx tsc --noEmit`
- 如触碰逻辑，运行相关 `npx vitest run`
- 手动检查桌面和移动端：
  - 首页首屏
  - 模板网格和筛选
  - Studio 生成控制
  - 我的作品/结果页
  - 空状态、加载态、错误态

视觉验收标准：

- 文本不重叠。
- 卡片 hover 不造成布局跳动。
- 中文文案可读且无乱码。
- 移动端卡片和按钮不会溢出容器。
- 主 CTA 清楚、稳定、容易点击。

## 待定但不阻塞的实施选择

这些是实施阶段的技术选择，不影响设计方向确认：

- 是先生成最终 `image2` 资产，还是先用临时占位图推进布局。
- 是否引入 `lucide-react` 作为图标库。
- 是否在 UI 改造时顺手拆分过大的 Studio 客户端组件。

推荐答案：

- 先生成一小套 `image2` 资产，用于首页主视觉和示例模板封面。
- 如果允许安装依赖，再加入 `lucide-react`。
- 只在有助于安全改造布局时拆分 Studio，不做无关重构。
