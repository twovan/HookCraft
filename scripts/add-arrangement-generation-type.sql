-- 扩展 generation_tasks 表以支持 arrangement（编曲）生成类型
-- 此迁移脚本是幂等的，可安全重复执行

-- Step 1: 为 generation_type 枚举添加 'arrangement' 值
-- PostgreSQL 9.1+ 支持 IF NOT EXISTS 语法
ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'arrangement';

-- Step 2: 添加 cover_feature_id 列（MiniMax 预处理返回的音频特征 ID）
ALTER TABLE generation_tasks
ADD COLUMN IF NOT EXISTS cover_feature_id TEXT DEFAULT NULL;

-- Step 3: 添加 source_audio_duration 列（上传音频的时长，单位：秒）
ALTER TABLE generation_tasks
ADD COLUMN IF NOT EXISTS source_audio_duration NUMERIC DEFAULT NULL;

-- 添加列注释
COMMENT ON COLUMN generation_tasks.cover_feature_id IS 'MiniMax 预处理 API 返回的音频特征标识符，用于 music-cover 模型生成';
COMMENT ON COLUMN generation_tasks.source_audio_duration IS '用户上传的源音频时长（秒），用于编曲生成记录';
