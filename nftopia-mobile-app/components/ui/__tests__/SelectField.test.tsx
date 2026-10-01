import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import SelectField from '@/components/ui/SelectField';
import { mockBottomSheetRender } from '@/src/test-mocks/gorhom-bottom-sheet';

const OPTIONS = [
  { label: 'English', value: 'en' },
  { label: 'French', value: 'fr' },
  { label: 'Spanish', value: 'es' },
];

// createNodeMock is required here because SelectField holds a real ref to
// its trigger View (for BottomSheet's restoreFocusRef) — see
// BottomSheet.test.tsx (#469) for why react-test-renderer needs this.
function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never, { createNodeMock: () => ({}) });
  });
  return renderer;
}

// findByProps({ testID }) also matches SelectField's own root component
// instance (testID is one of its own props too), so the trigger — the host
// TouchableOpacity carrying the same testID — is picked out by role instead.
function findTrigger(renderer: TestRenderer.ReactTestRenderer) {
  return renderer.root
    .findAllByType(TouchableOpacity as never)
    .find((n) => n.props.accessibilityRole === 'button')!;
}

describe('SelectField (#468)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the placeholder when no value is selected', () => {
    const renderer = render(
      <SelectField placeholder="Choose a language" value={null} options={OPTIONS} onValueChange={jest.fn()} />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Choose a language');
  });

  it("shows the selected option's label instead of the placeholder", () => {
    const renderer = render(
      <SelectField placeholder="Choose a language" value="fr" options={OPTIONS} onValueChange={jest.fn()} />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('French');
    expect(texts).not.toContain('Choose a language');
  });

  it('opens the sheet (index >= 0) when the trigger is pressed', () => {
    const renderer = render(
      <SelectField value={null} options={OPTIONS} onValueChange={jest.fn()} testID="lang" />,
    );
    const trigger = findTrigger(renderer);

    act(() => {
      (trigger.props as { onPress: () => void }).onPress();
    });

    const lastCall = mockBottomSheetRender.mock.calls[mockBottomSheetRender.mock.calls.length - 1][0];
    expect(lastCall.index).toBeGreaterThanOrEqual(0);
  });

  it('does not open when editable is false', () => {
    const renderer = render(
      <SelectField value={null} options={OPTIONS} onValueChange={jest.fn()} editable={false} testID="lang" />,
    );
    const trigger = findTrigger(renderer);
    expect(trigger.props.disabled).toBe(true);
    expect(trigger.props.accessibilityState).toEqual({ disabled: true });
  });

  it('calls onValueChange and closes the sheet when an option is selected', () => {
    const onValueChange = jest.fn();
    const renderer = render(
      <SelectField value={null} options={OPTIONS} onValueChange={onValueChange} testID="lang" />,
    );
    const trigger = findTrigger(renderer);
    act(() => {
      (trigger.props as { onPress: () => void }).onPress();
    });

    const option = renderer.root.findByProps({ testID: 'lang-option-es' });
    act(() => {
      (option.props as { onPress: () => void }).onPress();
    });

    expect(onValueChange).toHaveBeenCalledWith('es');
    const lastCall = mockBottomSheetRender.mock.calls[mockBottomSheetRender.mock.calls.length - 1][0];
    expect(lastCall.index).toBe(-1);
  });

  it('renders every option as a menuitem with the correct selected state', () => {
    const renderer = render(
      <SelectField value="fr" options={OPTIONS} onValueChange={jest.fn()} />,
    );
    const menuItems = renderer.root
      .findAllByType(TouchableOpacity as never)
      .filter((n) => n.props.accessibilityRole === 'menuitem');
    expect(menuItems).toHaveLength(3);

    const frenchItem = menuItems.find((n) => n.props.accessibilityLabel === 'French');
    expect(frenchItem?.props.accessibilityState).toEqual({ selected: true });

    const spanishItem = menuItems.find((n) => n.props.accessibilityLabel === 'Spanish');
    expect(spanishItem?.props.accessibilityState).toEqual({ selected: false });
  });

  it('renders an error message when given', () => {
    const renderer = render(
      <SelectField value={null} options={OPTIONS} onValueChange={jest.fn()} error="Required" />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Required');
  });

  it('exposes an accessible button role and label on the trigger', () => {
    const renderer = render(
      <SelectField label="Language" value={null} options={OPTIONS} onValueChange={jest.fn()} testID="lang" />,
    );
    const trigger = findTrigger(renderer);
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.accessibilityLabel).toBe('Language');
  });
});
