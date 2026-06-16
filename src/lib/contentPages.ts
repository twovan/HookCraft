export const CONTENT_PAGE_SLUGS = ['terms', 'privacy', 'copyright', 'help', 'contact', 'faq'] as const;

export type ContentPageSlug = (typeof CONTENT_PAGE_SLUGS)[number];

export interface ContentPageEntry {
  slug: ContentPageSlug;
  group: 'legal' | 'support';
  navTitle: string;
  eyebrow: string;
  title: string;
  summary: string;
  updatedAt: string;
  body: string;
}

export type ContentPagesSettings = Record<ContentPageSlug, ContentPageEntry>;

export const CONTENT_PAGE_META: Record<ContentPageSlug, Pick<ContentPageEntry, 'slug' | 'group' | 'navTitle'>> = {
  terms: { slug: 'terms', group: 'legal', navTitle: '服务条款' },
  privacy: { slug: 'privacy', group: 'legal', navTitle: '隐私政策' },
  copyright: { slug: 'copyright', group: 'legal', navTitle: '版权声明' },
  help: { slug: 'help', group: 'support', navTitle: '帮助中心' },
  contact: { slug: 'contact', group: 'support', navTitle: '联系我们' },
  faq: { slug: 'faq', group: 'support', navTitle: '常见问题' },
};

export const DEFAULT_CONTENT_PAGES: ContentPagesSettings = {
  terms: {
    ...CONTENT_PAGE_META.terms,
    eyebrow: 'LEGAL',
    title: 'HookCraft 服务条款',
    summary: '使用 HookCraft 的模板市场、AI Demo 工作流、账户与会员服务前，请先了解这些基础规则。',
    updatedAt: '2026年6月16日',
    body: `## 1. 服务范围
HookCraft 提供 AI 音乐 Demo 创作、正版模板浏览与使用、账户额度、会员订阅、作品历史和相关辅助工具。具体功能可能会根据产品规划、技术能力、合规要求或第三方服务状态进行调整。

## 2. 账户与使用责任
- 你需要确保注册信息真实、有效，并妥善保管账户登录方式。
- 你应对账户下发起的生成、上传、购买、下载、编辑和发布行为负责。
- 不得使用 HookCraft 生成、上传、传播违法、侵权、欺诈、骚扰、仇恨、成人或其他不适当内容。

## 3. 模板与生成内容
- 平台展示的模板、音频、封面、描述和标签可能来自平台、合作制作人或授权方。
- 使用模板生成 Demo 不代表自动取得商业发行、公开传播或改编授权，具体权利以对应模板页面、订单、授权说明或双方另行协议为准。
- 你上传的参考音频、歌词、旋律或其他素材，应确保拥有合法权利或已获得必要授权。

## 4. 费用、额度与会员
会员权益、生成额度、充值包和模板价格以页面展示及后台配置为准。部分权益可能存在有效期、使用范围、次数限制或不可转让限制。

## 5. 服务变更与中止
为保障系统安全、版权合规、模型稳定和服务体验，HookCraft 可对异常账户、违规内容、风险订单或疑似侵权素材采取限制、下架、冻结、审核或终止服务等措施。

## 6. 免责声明
AI 生成结果具有不确定性。HookCraft 会努力提供稳定服务，但不保证每次生成结果均满足特定商业、审美、版权或技术预期。`,
  },
  privacy: {
    ...CONTENT_PAGE_META.privacy,
    eyebrow: 'PRIVACY',
    title: 'HookCraft 隐私政策',
    summary: '我们只收集提供服务所必需的信息，并尽量让数据使用方式清晰、可控、可追溯。',
    updatedAt: '2026年6月16日',
    body: `## 1. 我们收集的信息
为提供账户、创作、支付、审核和客服服务，我们可能收集邮箱、用户名、头像、会员状态、额度记录、订单记录、生成历史、上传文件、模板使用记录、设备与日志信息。

## 2. 信息使用目的
- 创建和维护你的账户、会员与额度。
- 完成模板购买、AI 生成、音频处理、下载和订单查询。
- 进行内容安全、版权风险、反滥用和系统稳定性检查。
- 响应客服、故障排查、产品改进和必要的运营通知。

## 3. 文件与生成数据
你上传的音频、歌词、描述、封面或生成结果可能会被用于完成当前任务、保存创作历史、展示处理进度、排查错误和执行合规审核。未经授权，我们不会将你的私有素材公开展示给其他用户。

## 4. 第三方服务
HookCraft 可能使用 Supabase、支付服务、AI 模型服务、存储服务、邮件服务或分析服务来完成必要功能。我们会尽量只向第三方传递完成服务所需的信息。

## 5. 数据安全
我们会采取访问控制、日志审计、权限隔离和存储策略来降低数据泄露、误用或未授权访问风险。但互联网服务无法保证绝对安全，请避免上传你无权处理或极度敏感的素材。

## 6. 你的权利
你可以通过账户页面或联系我们，查询、更正或删除部分账户信息。对于因合规、财务、风控或争议处理需要保留的数据，我们会按照适用规则继续保存必要期限。`,
  },
  copyright: {
    ...CONTENT_PAGE_META.copyright,
    eyebrow: 'COPYRIGHT',
    title: '版权声明',
    summary: 'HookCraft 面向正版模板与合规 AI 创作场景，鼓励用户尊重音乐作品、录音、词曲、表演和素材权利。',
    updatedAt: '2026年6月16日',
    body: `## 1. 平台内容权利
HookCraft 网站、品牌、界面、文案、图形、交互设计、系统能力和自有素材归 HookCraft 或相关权利人所有。未经许可，不得复制、改编、反向工程、批量抓取或用于竞争性服务。

## 2. 模板与制作人内容
平台上的音乐模板、音频片段、封面、描述、风格标签和制作人信息可能受版权、邻接权、商标权、姓名权或其他权益保护。购买或使用模板时，请遵守对应授权范围。

## 3. 用户上传内容
你上传的参考音频、歌词、旋律、采样、封面或其他素材，应确保为原创、已授权或符合法律允许使用的内容。若因上传内容产生权利争议，由上传者承担相应责任。

## 4. AI 生成内容
AI 生成结果可能受到输入素材、模板授权、模型能力和第三方规则影响。将生成内容用于商业发行、广告、影视、游戏、公开传播或再授权前，请自行确认所需权利。

## 5. 侵权通知
如果你认为 HookCraft 上的内容侵犯了你的合法权益，请提供权利证明、被投诉内容链接、联系方式和具体说明。我们会在收到完整材料后进行核验，并采取必要处理。`,
  },
  help: {
    ...CONTENT_PAGE_META.help,
    eyebrow: 'SUPPORT',
    title: '帮助中心',
    summary: '从模板选择、AI 创作、额度使用到作品管理，快速找到 HookCraft 的常用操作说明。',
    updatedAt: '2026年6月16日',
    body: `## 快速开始
- 浏览模板市场，选择适合的流派、情绪或制作人模板。
- 进入 Studio，选择模板或输入创作描述，填写必要的歌词、风格和时长。
- 生成后在版本列表中试听、选择、下载或进入编辑器继续处理。

## 模板使用
免费模板可直接尝试；付费模板、会员模板或商业授权模板可能需要购买、订阅或满足会员等级后使用。模板页面会展示价格、标签、制作人和授权信息。

## 额度与会员
AI 生成、音频处理、Stem 编辑或高级导出可能消耗额度。账户页可以查看月度额度、购买余额和使用记录。升级会员后，权益通常会即时生效。

## 上传参考音频
建议上传清晰、合法、你拥有权利的 MP3/WAV 文件。上传音频会影响旋律、情绪、结构或声线方向，具体取决于当前创作模式。

## 常见排查
- 生成失败：检查额度、网络、敏感词提示和输入内容。
- 音频无法上传：确认格式、大小、时长和文件是否损坏。
- 订单未生效：刷新账户页，或保留支付凭证联系我们。`,
  },
  contact: {
    ...CONTENT_PAGE_META.contact,
    eyebrow: 'CONTACT',
    title: '联系我们',
    summary: '遇到订单、授权、生成失败、合作入驻或版权反馈，可以通过以下方式联系 HookCraft 团队。',
    updatedAt: '2026年6月16日',
    body: `## 客服支持
邮箱：support@hookcraft.io
适用场景：账户、会员、额度、生成失败、下载、订单和一般使用问题。

## 商务合作
邮箱：business@hookcraft.io
适用场景：制作人入驻、模板合作、品牌 Demo、企业授权和 API 合作。

## 版权与合规
邮箱：copyright@hookcraft.io
适用场景：侵权投诉、授权确认、下架请求、权利证明提交和合规沟通。

## 提交问题时建议包含
- 你的账户邮箱或订单号。
- 出现问题的页面链接、模板名称或任务时间。
- 错误截图、浏览器信息、上传文件类型和你希望我们协助处理的目标。`,
  },
  faq: {
    ...CONTENT_PAGE_META.faq,
    eyebrow: 'FAQ',
    title: '常见问题',
    summary: '整理 HookCraft 用户最常问的账户、模板、版权、额度和生成问题。',
    updatedAt: '2026年6月16日',
    body: `## Q：HookCraft 生成的 Demo 可以商用吗？
是否可以商用取决于你使用的模板授权、会员权益、订单说明、输入素材权利和具体使用场景。正式发行或商业投放前，请确认对应授权范围。

## Q：模板购买后可以无限使用吗？
不同模板可能有不同使用范围。一般情况下，购买后可在账户内继续使用该模板，但下载、商用、转授权或公开传播可能受授权条款限制。

## Q：为什么生成失败还会提示额度？
系统通常会在任务创建、排队、处理或成功时记录额度状态。若任务失败且符合退还规则，额度会自动回滚或由客服核验处理。

## Q：上传参考音频安全吗？
参考音频用于完成当前创作任务、保存历史和必要审核。请不要上传你无权处理、包含敏感信息或不希望被系统处理的文件。

## Q：可以成为合作制作人吗？
可以。请通过联系我们页面提交代表作品、擅长风格、授权方式和合作诉求，团队会评估后回复。

## Q：如何删除账户或作品？
你可以先在账户或作品页面处理可见内容。如需进一步删除账户资料或历史记录，请通过客服邮箱联系我们。`,
  },
};

export function normalizeContentPagesSettings(value: unknown): ContentPagesSettings {
  const source = value && typeof value === 'object' ? value as Record<string, Partial<ContentPageEntry>> : {};

  return CONTENT_PAGE_SLUGS.reduce((settings, slug) => {
    const current = source[slug] || {};
    const fallback = DEFAULT_CONTENT_PAGES[slug];
    settings[slug] = {
      ...fallback,
      ...current,
      ...CONTENT_PAGE_META[slug],
      eyebrow: typeof current.eyebrow === 'string' && current.eyebrow.trim() ? current.eyebrow : fallback.eyebrow,
      title: typeof current.title === 'string' && current.title.trim() ? current.title : fallback.title,
      summary: typeof current.summary === 'string' && current.summary.trim() ? current.summary : fallback.summary,
      updatedAt: typeof current.updatedAt === 'string' && current.updatedAt.trim() ? current.updatedAt : fallback.updatedAt,
      body: typeof current.body === 'string' && current.body.trim() ? current.body : fallback.body,
    };
    return settings;
  }, {} as ContentPagesSettings);
}

export function getContentPage(settings: ContentPagesSettings, slug: string) {
  if (!CONTENT_PAGE_SLUGS.includes(slug as ContentPageSlug)) return null;
  return settings[slug as ContentPageSlug];
}
