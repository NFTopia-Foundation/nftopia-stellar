import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import SecureInput from '@/components/wallet/SecureInput';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('SecureInput (#468 — composes TextField)', () => {
  it('renders the label and hides the value by default', () => {
    const renderer = render(
      <SecureInput label="Secret Key" placeholder="Enter secret key" value="SABC123" onChangeText={jest.fn()} />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Secret Key');
    expect(texts).toContain('Show');

    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.value).toBe('SABC123');
  });

  it('toggles secureTextEntry and the button label when the toggle is pressed', () => {
    const renderer = render(
      <SecureInput label="Secret Key" placeholder="x" value="SABC123" onChangeText={jest.fn()} />,
    );
    const toggle = renderer.root.findByType(TouchableOpacity as never);

    act(() => {
      (toggle.props as { onPress: () => void }).onPress();
    });

    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.secureTextEntry).toBe(false);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Hide');
  });

  it('renders the error message when given', () => {
    const renderer = render(
      <SecureInput label="Secret Key" placeholder="x" value="" onChangeText={jest.fn()} error="Invalid key" />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Invalid key');
  });

  it('calls onChangeText with the typed value', () => {
    const onChangeText = jest.fn();
    const renderer = render(
      <SecureInput label="Secret Key" placeholder="x" value="" onChangeText={onChangeText} />,
    );
    const input = renderer.root.findByType(TextInput as never);
    act(() => {
      (input.props as { onChangeText: (t: string) => void }).onChangeText('S123');
    });
    expect(onChangeText).toHaveBeenCalledWith('S123');
  });
});
