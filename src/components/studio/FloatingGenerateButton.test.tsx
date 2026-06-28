import { describe, expect, it } from 'vitest';
import FloatingGenerateButton from './FloatingGenerateButton';

function getButton(element: any) {
  return Array.isArray(element.props.children)
    ? element.props.children.find((child: any) => child.type === 'button')
    : element.props.children;
}

describe('FloatingGenerateButton', () => {
  it('renders as a fixed wide pill with the credit cost visible', () => {
    const element = FloatingGenerateButton({
      children: '开始生成',
      creditLabel: '20 积分',
      disabled: false,
      onClick: () => undefined,
    }) as any;
    const button = getButton(element);

    expect(element.props.style.position).toBe('fixed');
    expect(element.props.style.bottom).toBe(24);
    expect(button.props.style.borderRadius).toBe(999);
    expect(button.props.children[1].props.children).toContain('20 积分');
  });

  it('uses an opaque disabled background', () => {
    const element = FloatingGenerateButton({
      children: '开始生成',
      creditLabel: '20 积分',
      disabled: true,
      onClick: () => undefined,
    }) as any;
    const button = getButton(element);

    expect(button.props.style.background).toBe('#26272b');
  });

  it('animates the enabled button without animating disabled state', () => {
    const enabled = FloatingGenerateButton({
      children: '开始生成',
      creditLabel: '20 积分',
      disabled: false,
      onClick: () => undefined,
    }) as any;
    const disabled = FloatingGenerateButton({
      children: '开始生成',
      creditLabel: '20 积分',
      disabled: true,
      onClick: () => undefined,
    }) as any;
    const enabledButton = getButton(enabled);
    const disabledButton = getButton(disabled);

    expect(enabledButton.props.style.animation).toContain('studioGenerateGlow');
    expect(enabledButton.props.style.backgroundSize).toBe('220% 100%');
    expect(disabledButton.props.style.animation).toBe('none');
  });
});
