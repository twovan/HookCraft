-- 为 sensitive_words 表添加改写缓存列
-- cached_rewrite 存储 Gemini 改写结果，避免重复调用 API
-- 格式: { "rewrittenPrompt": "...", "styleTags": ["..."], "styleTagsCn": ["..."] }

ALTER TABLE sensitive_words
ADD COLUMN IF NOT EXISTS cached_rewrite jsonb DEFAULT NULL;

COMMENT ON COLUMN sensitive_words.cached_rewrite IS '缓存的 Gemini 改写结果（含 rewrittenPrompt, styleTags, styleTagsCn），避免重复 API 调用';
