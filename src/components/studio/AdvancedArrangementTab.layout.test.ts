import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

describe('AdvancedArrangementTab layout', () => {
  it('stretches the two main workbench panels to the same row height', () => {
    const source = readFileSync('src/components/studio/AdvancedArrangementTab.tsx', 'utf8');

    expect(source).toContain("alignItems: 'stretch'");
    expect(source).not.toContain("alignItems: 'start'");
  });
});
