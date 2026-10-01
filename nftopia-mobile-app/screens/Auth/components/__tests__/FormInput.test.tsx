import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import FormInput from '@/screens/Auth/components/FormInput';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('FormInput (#468 — composes TextField)', () => {
  it('renders the label, placeholder, and value', () => {
    const renderer = render(
      <FormInput label="Email" placeholder="Enter your email" value="a@b.com" onChangeText={jest.fn()} />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Email');

    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.placeholder).toBe('Enter your email');
    expect(input.props.value).toBe('a@b.com');
  });

  it('forwards keyboardType, secureTextEntry, and autoCapitalize', () => {
    const renderer = render(
      <FormInput
        label="Password"
        placeholder="Enter your password"
        value=""
        onChangeText={jest.fn()}
        secureTextEntry
        keyboardType="email-address"
        autoCapitalize="none"
      />,
    );
    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.secureTextEntry).toBe(true);
    expect(input.props.keyboardType).toBe('email-address');
    expect(input.props.autoCapitalize).toBe('none');
  });

  it('renders the error message when given', () => {
    const renderer = render(
      <FormInput
        label="Email"
        placeholder="Enter your email"
        value=""
        onChangeText={jest.fn()}
        error="Enter a valid email"
      />,
    );
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Enter a valid email');
  });

  it('disables the input when editable is false', () => {
    const renderer = render(
      <FormInput label="Email" placeholder="x" value="" onChangeText={jest.fn()} editable={false} />,
    );
    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.editable).toBe(false);
  });
});
