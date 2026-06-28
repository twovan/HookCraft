import { describe, expect, it } from 'vitest';
import FloatingGenerateButton from './FloatingGenerateButton';

describe('FloatingGenerateButton', () => {
  it('renders as a fixed wide pill with the credit cost visible', () => {
    const element = FloatingGenerateButton({
      children: '开始生成',
      creditLabel: '20 积分',
      disabled: false,
      onClick: () => undefined,
    }) as any;

    expect(element.props.style.position).toBe('fixed');
    expect(element.props.style.bottom).toBe(24);
    expect(element.props.children.props.style.borderRadius).toBe(999);
    expect(element.props.children.props.children[1].props.children).toContain('20 积分');
  });

  it('uses an opaque disabled background', () => {
    const element = FloatingGenerateButton({
      children: '开始生成',
      creditLabel: '20 积分',
      disabled: true,
      onClick: () => undefined,
    }) as any;

    expect(element.props.children.props.style.background).toBe('#26272b');
  });
});
