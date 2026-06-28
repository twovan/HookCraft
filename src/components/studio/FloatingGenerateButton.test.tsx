import { describe, expect, it } from 'vitest';
import FloatingGenerateButton from './FloatingGenerateButton';

function getButton(element: any) {
  return Array.isArray(element.props.children)
    ? element.props.children.find((child: any) => child.type === 'button')
    : element.props.children;
}

describe('FloatingGenerateButton', () => {
  it('renders as a sticky wide button with the credit cost visible', () => {
    const element = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      disabled: false,
      onClick: () => undefined,
    }) as any;
    const button = getButton(element);

    expect(element.props.style.position).toBe('sticky');
    expect(element.props.style.bottom).toBe(24);
    expect(element.props.style.width).toBe('100%');
    expect(button.props.style.borderRadius).toBe(16);
    expect(button.props.children[1].props.children).toContain('20 积分');
  });

  it('allows callers to place it across a parent grid', () => {
    const element = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      containerStyle: { gridColumn: '1 / -1' },
      onClick: () => undefined,
    }) as any;

    expect(element.props.style.gridColumn).toBe('1 / -1');
  });

  it('uses an opaque disabled background', () => {
    const element = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      disabled: true,
      onClick: () => undefined,
    }) as any;
    const button = getButton(element);

    expect(button.props.style.background).toBe('#26272b');
  });

  it('animates the enabled button without animating disabled state', () => {
    const enabled = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      disabled: false,
      onClick: () => undefined,
    }) as any;
    const disabled = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      disabled: true,
      onClick: () => undefined,
    }) as any;
    const enabledButton = getButton(enabled);
    const disabledButton = getButton(disabled);

    expect(enabledButton.props.style.animation).toContain('studioGenerateGradient');
    expect(enabledButton.props.style.animation).not.toContain('studioGenerateGlow');
    expect(enabledButton.props.style.backgroundSize).toBe('220% 100%');
    expect(disabledButton.props.style.animation).toBe('none');
  });

  it('uses the site lime and cyan palette for the enabled state', () => {
    const element = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      disabled: false,
      onClick: () => undefined,
    }) as any;
    const button = getButton(element);

    expect(button.props.style.background).toBe('linear-gradient(90deg, var(--hc-lime), var(--hc-cyan))');
    expect(button.props.style.background).not.toContain('#e9086f');
  });

  it('restores hover transform immediately on mouse leave', () => {
    const element = FloatingGenerateButton({
      children: '开始创作',
      creditLabel: '20 积分',
      onClick: () => undefined,
    }) as any;
    const button = getButton(element);
    const target = { style: { transform: '', boxShadow: '' } };

    button.props.onMouseEnter({ currentTarget: target });
    expect(target.style.transform).toBe('translateY(-3px)');

    button.props.onMouseLeave({ currentTarget: target });
    expect(target.style.transform).toBe('translateY(0)');
  });
});
