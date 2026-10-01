import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import MnemonicInput from '@/components/wallet/MnemonicInput';

function render(ui: React.ReactElement) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(ui as never);
  });
  return renderer;
}

describe('MnemonicInput (#468 — paste mode composes TextField)', () => {
  it('starts in paste mode with a multiline field', () => {
    const renderer = render(<MnemonicInput value="" onChangeText={jest.fn()} />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Recovery Phrase');
    expect(texts).toContain('Enter word-by-word');

    const input = renderer.root.findByType(TextInput as never);
    expect(input.props.multiline).toBe(true);
  });

  it('calls onChangeText with the pasted text', () => {
    const onChangeText = jest.fn();
    const renderer = render(<MnemonicInput value="" onChangeText={onChangeText} />);
    const input = renderer.root.findByType(TextInput as never);
    act(() => {
      (input.props as { onChangeText: (t: string) => void }).onChangeText('one two three');
    });
    expect(onChangeText).toHaveBeenCalledWith('one two three');
  });

  it('shows a valid word count without a warning for 12 words', () => {
    const words = Array(12).fill('word').join(' ');
    const renderer = render(<MnemonicInput value={words} onChangeText={jest.fn()} />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    const countText = texts.find((t) => Array.isArray(t) && t[0] === 12);
    expect(countText).toBeTruthy();
  });

  it('flags an invalid word count', () => {
    const words = Array(13).fill('word').join(' ');
    const renderer = render(<MnemonicInput value={words} onChangeText={jest.fn()} />);
    const flat = renderer.root
      .findAllByType(Text as never)
      .flatMap((n) => (Array.isArray(n.props.children) ? n.props.children : [n.props.children]));
    expect(flat.join('')).toContain('expected 12, 15, 18, 21, or 24');
  });

  it('renders the error message', () => {
    const renderer = render(<MnemonicInput value="" onChangeText={jest.fn()} error="Invalid phrase" />);
    const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
    expect(texts).toContain('Invalid phrase');
  });

  describe('word-by-word mode', () => {
    it('switches to a 24-slot word grid', () => {
      const renderer = render(<MnemonicInput value="" onChangeText={jest.fn()} />);
      const switchLink = renderer.root.findByProps({ children: 'Enter word-by-word' });
      act(() => {
        (switchLink.parent!.props as { onPress: () => void }).onPress();
      });

      const wordInputs = renderer.root.findAllByType(TextInput as never);
      expect(wordInputs).toHaveLength(24);
    });

    it('joins entered words into a single phrase via onChangeText', () => {
      const onChangeText = jest.fn();
      const renderer = render(<MnemonicInput value="" onChangeText={onChangeText} />);
      const switchLink = renderer.root.findByProps({ children: 'Enter word-by-word' });
      act(() => {
        (switchLink.parent!.props as { onPress: () => void }).onPress();
      });

      const wordInputs = renderer.root.findAllByType(TextInput as never);
      act(() => {
        (wordInputs[0].props as { onChangeText: (t: string) => void }).onChangeText('legal');
      });
      expect(onChangeText).toHaveBeenCalledWith('legal');
    });

    it('switches back to paste mode, preserving entered words', () => {
      const onChangeText = jest.fn();
      const renderer = render(<MnemonicInput value="" onChangeText={onChangeText} />);
      const toWords = renderer.root.findByProps({ children: 'Enter word-by-word' });
      act(() => {
        (toWords.parent!.props as { onPress: () => void }).onPress();
      });

      const wordInputs = renderer.root.findAllByType(TextInput as never);
      act(() => {
        (wordInputs[0].props as { onChangeText: (t: string) => void }).onChangeText('legal');
      });

      const toPaste = renderer.root.findByProps({ children: 'Paste instead' });
      act(() => {
        (toPaste.parent!.props as { onPress: () => void }).onPress();
      });

      expect(onChangeText).toHaveBeenLastCalledWith('legal');
      const texts = renderer.root.findAllByType(Text as never).map((n) => n.props.children);
      expect(texts).toContain('Enter word-by-word');
      expect(renderer.root.findByType(TextInput as never).props.multiline).toBe(true);
    });
  });
});
