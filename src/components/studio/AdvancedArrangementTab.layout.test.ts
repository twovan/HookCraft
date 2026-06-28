import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('AdvancedArrangementTab layout', () => {
  it('stretches the two main workbench panels to the same row height', () => {
    const source = readFileSync('src/components/studio/AdvancedArrangementTab.tsx', 'utf8');

    expect(source).toContain("alignItems: 'stretch'");
    expect(source).not.toContain("alignItems: 'start'");
  });

  it('keeps the instrumental template copy aligned with the add accompaniment tab', () => {
    const source = readFileSync('src/components/studio/AdvancedArrangementTab.tsx', 'utf8');

    expect(source).toContain('添加伴奏说明');
    expect(source).toContain('添加伴奏参数');
    expect(source).toContain('创建添加伴奏任务');
    expect(source).toContain('开始添加伴奏');
  });
});
