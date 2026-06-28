import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

function readSource(path: string) {
  return readFileSync(path, 'utf8');
}

describe('studio generate button copy', () => {
  it('uses one primary generate label across studio tabs', () => {
    const sources = [
      readSource('src/components/studio/SimpleGenerationTab.tsx'),
      readSource('src/components/studio/AdvancedArrangementTab.tsx'),
      readSource('src/components/studio/AudioUploadTab.tsx'),
      readSource('src/app/studio/StudioPageClient.tsx'),
    ].join('\n');

    expect(sources).toContain('开始创作');
    expect(sources).not.toContain('开始生成');
    expect(sources).not.toContain('开始添加伴奏');
    expect(sources).not.toContain('开始 AI 创作');
    expect(sources).not.toContain('开始高级编曲');
    expect(sources).not.toContain(": '生成音乐'");
  });

  it('shows missing-step hints in disabled button labels', () => {
    const sources = [
      readSource('src/components/studio/SimpleGenerationTab.tsx'),
      readSource('src/components/studio/AdvancedArrangementTab.tsx'),
      readSource('src/components/studio/AudioUploadTab.tsx'),
      readSource('src/app/studio/StudioPageClient.tsx'),
    ].join('\n');

    expect(sources).toContain('请填写生成描述');
    expect(sources).toContain('请上传参考音频');
    expect(sources).toContain('请填写歌曲名称');
    expect(sources).toContain('请填写歌词');
    expect(sources).toContain('请选择模板');
    expect(sources).toContain('请等待创作配置加载');
  });
});
