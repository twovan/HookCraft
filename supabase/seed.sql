-- seed.sql
-- 种子数据：模板 + 管理配置
-- 使用 ON CONFLICT DO NOTHING 确保幂等性

-- ============================================================
-- 模板数据（与 TemplateService SAMPLE_TEMPLATES 一致）
-- 3 个 free_template + 3 个 paid_template
-- ============================================================
INSERT INTO templates (id, name, description, category, genre, preview_url, cover_url, analysis_status)
VALUES
  (
    'tpl-free-pop',
    '流行节拍',
    '轻快的流行风格模板，适合日常创作',
    'free_template',
    'pop',
    '/audio/templates/free-pop-preview.mp3',
    '/images/templates/free-pop.jpg',
    'pending'
  ),
  (
    'tpl-free-lofi',
    'Lo-Fi 放松',
    '舒缓的 Lo-Fi 风格，适合背景音乐',
    'free_template',
    'lofi',
    '/audio/templates/free-lofi-preview.mp3',
    NULL,
    'pending'
  ),
  (
    'tpl-free-rock',
    '摇滚入门',
    '基础摇滚风格模板',
    'free_template',
    'rock',
    NULL,
    NULL,
    'pending'
  ),
  (
    'tpl-paid-edm',
    'EDM 电子舞曲',
    '高能量电子舞曲模板，专业级制作',
    'paid_template',
    'edm',
    '/audio/templates/paid-edm-preview.mp3',
    '/images/templates/paid-edm.jpg',
    'pending'
  ),
  (
    'tpl-paid-jazz',
    '爵士即兴',
    '经典爵士风格，丰富的和声编排',
    'paid_template',
    'jazz',
    NULL,
    '/images/templates/paid-jazz.jpg',
    'pending'
  ),
  (
    'tpl-paid-cinematic',
    '电影配乐',
    '史诗级电影配乐模板，适合影视项目',
    'paid_template',
    'cinematic',
    '/audio/templates/paid-cinematic-preview.mp3',
    '/images/templates/paid-cinematic.jpg',
    'pending'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 管理配置数据（与 AdminConfigService 默认配置一致）
-- 4 条记录：credit_quota、cost_rule、pricing、credits_pack
-- ============================================================

-- credit_quota: 等级 Credits 配额
INSERT INTO admin_config (config_type, config_data)
VALUES (
  'credit_quota',
  '[
    {"tier": "free", "monthlyCredits": 3},
    {"tier": "pro", "monthlyCredits": 100},
    {"tier": "business", "monthlyCredits": 300}
  ]'::jsonb
)
ON CONFLICT ON CONSTRAINT admin_config_type_unique DO NOTHING;

-- cost_rule: Credits 消耗规则
INSERT INTO admin_config (config_type, config_data)
VALUES (
  'cost_rule',
  '[
    {"operation": "preview", "cost": 1, "description": "Preview 预览试听（30 秒）"},
    {"operation": "full_demo_short", "cost": 10, "description": "完整 Demo（短版）"},
    {"operation": "full_demo_long", "cost": 20, "description": "完整 Demo（长版）"},
    {"operation": "premium_singer", "cost": 5, "description": "高级歌手声模（额外消耗）"},
    {"operation": "export_wav", "cost": 3, "description": "WAV 高品质导出"},
    {"operation": "export_stems", "cost": 10, "description": "分轨导出"}
  ]'::jsonb
)
ON CONFLICT ON CONSTRAINT admin_config_type_unique DO NOTHING;

-- pricing: 会员价格配置
INSERT INTO admin_config (config_type, config_data)
VALUES (
  'pricing',
  '[
    {"tier": "pro", "monthlyPrice": 19900, "yearlyPrice": 191040},
    {"tier": "business", "monthlyPrice": 49900, "yearlyPrice": 479040}
  ]'::jsonb
)
ON CONFLICT ON CONSTRAINT admin_config_type_unique DO NOTHING;

-- credits_pack: Credits 充值包配置
INSERT INTO admin_config (config_type, config_data)
VALUES (
  'credits_pack',
  '[
    {"id": "pack-10", "credits": 10, "price": 2900, "businessDiscount": 0.8},
    {"id": "pack-50", "credits": 50, "price": 12900, "businessDiscount": 0.8},
    {"id": "pack-100", "credits": 100, "price": 22900, "businessDiscount": 0.8}
  ]'::jsonb
)
ON CONFLICT ON CONSTRAINT admin_config_type_unique DO NOTHING;
