import React from 'react';

const host = (name: string) => {
  const Component = (props: any) => React.createElement(name, props, props.children);
  Component.displayName = name;
  return Component;
};

const mockReactNative = {
  View: host('View'),
  Text: host('Text'),
  TouchableOpacity: host('TouchableOpacity'),
  ActivityIndicator: host('ActivityIndicator'),
  StyleSheet: {
    create: (styles: unknown) => styles,
    flatten: (style: unknown) => style,
    absoluteFill: {},
    hairlineWidth: 1,
  },
  AccessibilityInfo: {
    announceForAccessibility: jest.fn(),
    isScreenReaderEnabled: jest.fn().mockResolvedValue(true),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: {
    OS: 'ios',
    select: (options: any) => options.ios ?? options.default,
  },
};

export default mockReactNative;
