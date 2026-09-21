// Component tests for the shared form-input library. The RN primitives are
// mocked so the fields can be rendered with react-test-renderer in the node
// test environment (the project's jest testMatch only picks up *.test.ts).
const mockAnnounce = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const createMock = (name: string) =>
    React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({ focus: jest.fn(), blur: jest.fn() }), []);
      const { children, ...rest } = props;
      return React.createElement('RCTMocked', { ...rest, __component: name }, children);
    });
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { create: (o: any) => o, flatten: (x: any) => x },
    View: createMock('View'),
    Text: createMock('Text'),
    TextInput: createMock('TextInput'),
    TouchableOpacity: createMock('TouchableOpacity'),
    Pressable: createMock('Pressable'),
    ScrollView: createMock('ScrollView'),
    Modal: (props: any) =>
      props.visible
        ? React.createElement('RCTMocked', { __component: 'Modal', ...props }, props.children)
        : null,
    AccessibilityInfo: { announceForAccessibility: mockAnnounce },
  };
});

import React from 'react';
import * as TestRenderer from 'react-test-renderer';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TextField } from '@/components/ui';
import AmountField from '@/components/ui/AmountField';
import SelectField from '@/components/ui/SelectField';
import FormInput from '@/screens/Auth/components/FormInput';
import SecureInput from '@/components/wallet/SecureInput';
import MnemonicInput from '@/components/wallet/MnemonicInput';
import { inputTokens } from '@/constants/theme';

type Renderer = TestRenderer.ReactTestRenderer;

function render(element: React.ReactElement<any>): TestRenderer.ReactTestInstance {
  let renderer!: Renderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(element as any);
  });
  return renderer.root;
}

const byComponent = (name: string) => (node: TestRenderer.ReactTestInstance) =>
  node.props.__component === name;

const firstInput = (root: TestRenderer.ReactTestInstance) =>
  root.findAll(byComponent('TextInput'))[0];

const findHost = (
  root: TestRenderer.ReactTestInstance,
  testID: string,
  component?: string
): TestRenderer.ReactTestInstance =>
  root.findAll(
    (node) =>
      node.props.testID === testID && (component === undefined || node.props.__component === component)
  )[0];

const styleMatches = (style: unknown, prop: string, value: unknown): boolean => {
  const list = Array.isArray(style) ? style.flat(Infinity) : [style];
  return list.some(
    (entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>)[prop] === value
  );
};

beforeEach(() => {
  mockAnnounce.mockClear();
});

describe('TextField', () => {
  it('renders the label and exposes it as the accessibility label', () => {
    const root = render(
      React.createElement(TextField, { label: 'Email', value: '', onChangeText: () => {} })
    );
    expect(firstInput(root).props.accessibilityLabel).toBe('Email');
  });

  it('renders errors through the shared ValidationError', () => {
    const root = render(
      React.createElement(TextField, {
        label: 'Email',
        value: '',
        onChangeText: () => {},
        error: 'Email is required',
        testID: 'email',
      })
    );
    const error = findHost(root, 'email-error', 'View');
    expect(error.props.accessibilityRole).toBe('alert');
    expect(mockAnnounce).toHaveBeenCalledWith('Email is required');
  });

  it('renders helper text when there is no error', () => {
    const root = render(
      React.createElement(TextField, {
        label: 'Email',
        value: '',
        onChangeText: () => {},
        helperText: 'We never share your email',
        testID: 'email',
      })
    );
    expect(findHost(root, 'email-helper', 'Text')).toBeTruthy();
  });

  it('applies the centralised focus border colour on focus', () => {
    const root = render(
      React.createElement(TextField, { label: 'Email', value: '', onChangeText: () => {} })
    );
    TestRenderer.act(() => {
      firstInput(root).props.onFocus({});
    });
    const focused = root.findAll(
      (node) =>
        node.props.__component === 'View' &&
        styleMatches(node.props.style, 'borderColor', inputTokens.borderFocused)
    );
    expect(focused.length).toBeGreaterThan(0);
  });

  it('applies the centralised error border colour when invalid', () => {
    const root = render(
      React.createElement(TextField, {
        label: 'Email',
        value: '',
        onChangeText: () => {},
        error: 'nope',
      })
    );
    const errored = root.findAll(
      (node) =>
        node.props.__component === 'View' &&
        styleMatches(node.props.style, 'borderColor', inputTokens.borderError)
    );
    expect(errored.length).toBeGreaterThan(0);
  });
});

describe('AmountField', () => {
  it('forwards a sanitised value to onChangeText', () => {
    const onChangeText = jest.fn();
    const root = render(
      React.createElement(AmountField, { label: 'Amount', value: '', onChangeText })
    );
    TestRenderer.act(() => {
      firstInput(root).props.onChangeText('1a2.3.4x');
    });
    expect(onChangeText).toHaveBeenCalledWith('12.34');
  });

  it('uses a numeric keyboard', () => {
    const root = render(
      React.createElement(AmountField, { label: 'Amount', value: '', onChangeText: () => {} })
    );
    expect(firstInput(root).props.keyboardType).toBe('decimal-pad');
  });

  it('renders a currency suffix when provided', () => {
    const root = render(
      React.createElement(AmountField, {
        label: 'Amount',
        value: '',
        onChangeText: () => {},
        currency: 'XLM',
      })
    );
    expect(findHost(root, 'amount-suffix-XLM', 'Text')).toBeTruthy();
  });
});

describe('SelectField', () => {
  const options = [
    { label: 'XLM', value: 'XLM' },
    { label: 'USDC', value: 'USDC' },
  ];

  it('opens the option list and marks the selected option', () => {
    const root = render(
      React.createElement(SelectField, {
        label: 'Currency',
        options,
        value: 'XLM',
        onChange: () => {},
        testID: 'currency',
      })
    );
    const trigger = findHost(root, 'currency', 'Pressable');
    expect(trigger.props.accessibilityState.expanded).toBe(false);

    TestRenderer.act(() => {
      trigger.props.onPress();
    });

    const selected = findHost(root, 'currency-option-XLM', 'Pressable');
    expect(selected.props.accessibilityRole).toBe('radio');
    expect(selected.props.accessibilityState.checked).toBe(true);
  });

  it('fires onChange when an option is chosen', () => {
    const onChange = jest.fn();
    const root = render(
      React.createElement(SelectField, {
        label: 'Currency',
        options,
        value: 'XLM',
        onChange,
        testID: 'currency',
      })
    );
    TestRenderer.act(() => {
      findHost(root, 'currency', 'Pressable').props.onPress();
    });
    TestRenderer.act(() => {
      findHost(root, 'currency-option-USDC', 'Pressable').props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('USDC', options[1]);
  });

  it('wires up keyboard navigation on the option list', () => {
    const root = render(
      React.createElement(SelectField, {
        label: 'Currency',
        options,
        value: 'XLM',
        onChange: () => {},
        testID: 'currency',
      })
    );
    TestRenderer.act(() => {
      findHost(root, 'currency', 'Pressable').props.onPress();
    });
    const menu = root.findByProps({ accessibilityRole: 'menu' });
    expect(typeof menu.props.onKeyDown).toBe('function');
  });
});

describe('legacy input adapters', () => {
  it('FormInput composes TextField and forwards changes', () => {
    const onChangeText = jest.fn();
    const root = render(
      React.createElement(FormInput, {
        label: 'Email',
        placeholder: 'Enter email',
        value: '',
        onChangeText,
        testID: 'email',
      })
    );
    expect(findHost(root, 'email', 'TextInput')).toBeTruthy();
    TestRenderer.act(() => {
      firstInput(root).props.onChangeText('hello@example.com');
    });
    expect(onChangeText).toHaveBeenCalledWith('hello@example.com');
  });

  it('SecureInput toggles secure text entry via its accessory', () => {
    const root = render(
      React.createElement(SecureInput, {
        label: 'Secret Key',
        placeholder: 'Secret',
        value: '',
        onChangeText: () => {},
        testID: 'secret',
      })
    );
    expect(firstInput(root).props.secureTextEntry).toBe(true);

    const toggle = root.findAll(byComponent('TouchableOpacity'))[0];
    TestRenderer.act(() => {
      toggle.props.onPress();
    });
    expect(firstInput(root).props.secureTextEntry).toBe(false);
  });

  it('MnemonicInput renders a shared paste field and switches to word slots', () => {
    const root = render(
      React.createElement(MnemonicInput, {
        value: '',
        onChangeText: () => {},
        testID: 'mnemonic',
      })
    );
    expect(findHost(root, 'mnemonic', 'TextInput')).toBeTruthy();
    expect(firstInput(root).props.accessibilityLabel).toBe('Recovery phrase');

    const switchButton = root.findAll(byComponent('TouchableOpacity'))[0];
    TestRenderer.act(() => {
      switchButton.props.onPress();
    });
    expect(findHost(root, 'mnemonic-word-0', 'TextInput')).toBeTruthy();
  });
});
