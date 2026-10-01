import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import TextField from '@/components/ui/TextField';

// react-test-renderer ships its own nested @types/react — see
// EmptyState.test.tsx (#472) for why this cast is needed.
function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('TextField (#468)', () => {
  it('renders the label and forwards value/onChangeText to the input', () => {
    const onChangeText = jest.fn();
    const renderer = render(
      <TextField label="Email" value="a@b.com" onChangeText={onChangeText} testID="email" />,
    );

    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Email');

    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.value).toBe('a@b.com');

    act(() => {
      (input.props as { onChangeText: (t: string) => void }).onChangeText('new@b.com');
    });
    expect(onChangeText).toHaveBeenCalledWith('new@b.com');
  });

  it('renders no label when one is not given', () => {
    const renderer = render(<TextField value="" onChangeText={jest.fn()} />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).not.toContain('Email');
  });

  describe('error and helper text', () => {
    it('renders the error message and hides helperText when error is set', () => {
      const renderer = render(
        <TextField
          value=""
          onChangeText={jest.fn()}
          error="This field is required"
          helperText="We never share this"
        />,
      );
      const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
      expect(texts).toContain('This field is required');
      expect(texts).not.toContain('We never share this');
    });

    it('renders helperText when there is no error', () => {
      const renderer = render(
        <TextField value="" onChangeText={jest.fn()} helperText="We never share this" />,
      );
      const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
      expect(texts).toContain('We never share this');
    });

    it('renders neither when neither is given', () => {
      const renderer = render(<TextField value="" onChangeText={jest.fn()} />);
      const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
      expect(texts).not.toContain('We never share this');
    });
  });

  describe('accessibility', () => {
    it('defaults accessibilityLabel to the label', () => {
      const renderer = render(<TextField label="Email" value="" onChangeText={jest.fn()} />);
      const input = renderer.root.findByType(TextInput as never);
      expect(input.props.accessibilityLabel).toBe('Email');
    });

    it('honors an explicit accessibilityLabel over the label', () => {
      const renderer = render(
        <TextField label="Email" accessibilityLabel="Email address" value="" onChangeText={jest.fn()} />,
      );
      const input = renderer.root.findByType(TextInput as never);
      expect(input.props.accessibilityLabel).toBe('Email address');
    });

    it('reflects the disabled state via accessibilityState and editable', () => {
      const renderer = render(<TextField value="" onChangeText={jest.fn()} editable={false} />);
      const input = renderer.root.findByType(TextInput as never);
      expect(input.props.editable).toBe(false);
      expect(input.props.accessibilityState).toEqual({ disabled: true });
    });

    it('uses the error message as the accessibilityHint when no explicit hint is given', () => {
      const renderer = render(<TextField value="" onChangeText={jest.fn()} error="Invalid" />);
      const input = renderer.root.findByType(TextInput as never);
      expect(input.props.accessibilityHint).toBe('Invalid');
    });
  });

  describe('slots', () => {
    it('renders a rightAccessory', () => {
      const renderer = render(
        <TextField
          value=""
          onChangeText={jest.fn()}
          rightAccessory={<Text>Show</Text>}
        />,
      );
      const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
      expect(texts).toContain('Show');
    });

    it('renders statusText regardless of error state', () => {
      const renderer = render(
        <TextField
          value=""
          onChangeText={jest.fn()}
          error="Invalid"
          statusText={<Text>3 words</Text>}
        />,
      );
      const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
      expect(texts).toContain('3 words');
      expect(texts).toContain('Invalid');
    });
  });

  it('passes testID to the input and derives the error testID from it', () => {
    const renderer = render(
      <TextField value="" onChangeText={jest.fn()} error="Invalid" testID="amount" />,
    );
    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.testID).toBe('amount');
    expect(renderer.root.findByProps({ testID: 'amount-error' })).toBeTruthy();
  });
});
