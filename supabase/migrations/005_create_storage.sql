-- 005_create_storage.sql
-- 创建 Storage 存储桶并配置访问策略

-- ============================================================
-- 1. 创建存储桶
-- ============================================================

-- audio-files 桶：存储 AI 生成的音频文件（私有，仅文件所有者可访问）
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-files', 'audio-files', false)
ON CONFLICT (id) DO NOTHING;

-- template-assets 桶：存储模板封面图片和参考音频
-- 设置为 public 以便封面图片可公开访问，参考音频通过 RLS 策略限制
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-assets', 'template-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 2. audio-files 桶访问策略（仅文件所有者可访问）
-- ============================================================

-- 文件所有者可上传音频文件（路径以 user_id 开头）
CREATE POLICY "用户可上传自己的音频文件"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'audio-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 文件所有者可读取自己的音频文件
CREATE POLICY "用户可读取自己的音频文件"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'audio-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 文件所有者可更新自己的音频文件
CREATE POLICY "用户可更新自己的音频文件"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'audio-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 文件所有者可删除自己的音频文件
CREATE POLICY "用户可删除自己的音频文件"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'audio-files'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 3. template-assets 桶访问策略
-- ============================================================

-- 所有人可读取模板封面图片（公开访问）
CREATE POLICY "所有人可读取模板封面图片"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'template-assets'
  AND (storage.foldername(name))[1] = 'templates'
  AND (storage.foldername(name))[3] = 'cover'
);

-- 仅管理员可读取模板参考音频
CREATE POLICY "仅管理员可读取模板参考音频"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'template-assets'
  AND (storage.foldername(name))[1] = 'templates'
  AND (storage.foldername(name))[3] = 'reference-audio'
  AND (auth.jwt() ->> 'role') = 'admin'
);

-- 仅管理员可上传模板资源（封面和参考音频）
CREATE POLICY "仅管理员可上传模板资源"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'template-assets'
  AND (auth.jwt() ->> 'role') = 'admin'
);

-- 仅管理员可更新模板资源
CREATE POLICY "仅管理员可更新模板资源"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'template-assets'
  AND (auth.jwt() ->> 'role') = 'admin'
);

-- 仅管理员可删除模板资源
CREATE POLICY "仅管理员可删除模板资源"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'template-assets'
  AND (auth.jwt() ->> 'role') = 'admin'
);
