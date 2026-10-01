// @gorhom/bottom-sheet is built on react-native-reanimated worklets and
// react-native-gesture-handler's native gesture recognizers — neither can
// run under react-test-renderer's lightweight, no-native-bindings
// environment (see src/test-mocks/react-native.tsx for why this repo
// doesn't use a full RN/Expo jest preset). Component tests exercise this
// repo's OWN integration code (components/ui/BottomSheet.tsx — what
// props it computes and passes down, its focus-management logic) against
// this mock, trusting the third-party library's own internals (gesture
// handling, animation, actual backdrop-press-to-close wiring) are already
// covered by its own test suite upstream.
import React from 'react';
import { View } from 'react-native';

/** Records every prop set the mocked BottomSheet was rendered with — inspect via mockBottomSheetRender.mock.calls. Reset by the usual jest.clearAllMocks() in each test file's beforeEach. */
export const mockBottomSheetRender = jest.fn();

const BottomSheet = React.forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
  mockBottomSheetRender(props);
  React.useImperativeHandle(ref, () => ({
    expand: jest.fn(),
    close: jest.fn(),
    collapse: jest.fn(),
    snapToIndex: jest.fn(),
    snapToPosition: jest.fn(),
    forceClose: jest.fn(),
  }));
  // Real @gorhom/bottom-sheet keeps children mounted even when closed
  // (index === -1) — content is meant to stay alive, just visually
  // collapsed — so this mock does too, letting tests inspect content
  // regardless of the current `visible`/`index` state.
  return <View>{(props as { children?: React.ReactNode }).children}</View>;
});
BottomSheet.displayName = 'MockGorhomBottomSheet';

export const BottomSheetView = ({
  children,
  ...rest
}: { children?: React.ReactNode } & Record<string, unknown>) => <View {...rest}>{children}</View>;

/** Renders nothing itself (the real component is purely presentational chrome) — components/ui/BottomSheet.tsx's own tests verify *whether* this gets rendered at all (enableBackdropDismiss), which is the integration behavior that's actually this repo's own code. */
export const BottomSheetBackdrop = (props: Record<string, unknown>) => (
  <View testID="mock-bottom-sheet-backdrop" {...props} />
);

export default BottomSheet;
