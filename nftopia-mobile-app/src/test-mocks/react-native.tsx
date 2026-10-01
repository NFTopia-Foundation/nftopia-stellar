// Minimal React Native primitive mocks for component tests run under
// react-test-renderer (see jest.config.components.json). Real react-native
// ships Flow-typed source that this repo's ts-jest-only transform can't
// parse (`import typeof X from ...`), and adding a full RN/Expo jest
// preset just for this would touch the existing, passing logic-test
// config — so components under test render against these lightweight
// string-typed host-component stand-ins instead. react-test-renderer
// accepts any string as a host component type and reflects it verbatim in
// the rendered JSON tree, which is all these tests need to assert on.
export const View = 'RNView';
export const Text = 'RNText';
export const TouchableOpacity = 'RNTouchableOpacity';
export const Pressable = 'RNPressable';
export const ActivityIndicator = 'RNActivityIndicator';
export const TextInput = 'RNTextInput';
export const Modal = 'RNModal';
export const ScrollView = 'RNScrollView';

/** Minimal stand-in: no actual animation, `.start()` fires its callback synchronously so tests don't need fake timers. */
export const Animated = {
  Value: class AnimatedValueMock {
    constructor(_initial: number) {}
  },
  spring: (
    _value: unknown,
    _config: { toValue: number },
  ): { start: (cb?: () => void) => void } => ({
    start: (cb?: () => void) => cb?.(),
  }),
  View: 'RNAnimatedView',
};

export const StyleSheet = {
  create: <T extends Record<string, unknown>>(styles: T): T => styles,
  flatten: (style: unknown) => style,
};

export const AccessibilityInfo = {
  announceForAccessibility: jest.fn(),
  setAccessibilityFocus: jest.fn(),
};

export const Platform = {
  OS: 'ios' as const,
  select: <T,>(spec: { ios?: T; android?: T; default?: T }): T | undefined =>
    spec.ios ?? spec.default,
};

/** Runs the callback synchronously — no real "interactions" concept exists under react-test-renderer, and tests don't need fake timers to observe the effect. */
export const InteractionManager = {
  runAfterInteractions: (callback: () => void): void => {
    callback();
  },
};

/** Returns a fake, stable numeric handle for any truthy ref value — react-test-renderer instances have no real native view tag to return. */
export function findNodeHandle(ref: unknown): number | null {
  return ref ? 1 : null;
}
