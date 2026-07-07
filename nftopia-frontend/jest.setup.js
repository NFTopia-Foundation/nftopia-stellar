require("@testing-library/jest-dom");

const { TextEncoder, TextDecoder } = require("util");

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}

if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/en",
  useSearchParams: () => new URLSearchParams(),
}));

// 💡 Fixed next/link mock to prevent nested <a> tags, merge click handlers, and drop legacyBehavior props safely
jest.mock("next/link", () => {
  const React = require("react");

  return React.forwardRef(({ href, children, legacyBehavior, ...props }, ref) => {
    const mergeHandlers = (childProps) => {
      return (e) => {
        if (props.onClick) props.onClick(e);
        if (childProps && childProps.onClick) childProps.onClick(e);
      };
    };

    // If the child element is already a native link tag (<a>), flatten the tree
    if (React.isValidElement(children) && children.type === "a") {
      // Destructure legacyBehavior to prevent it from bleeding down into the cloneElement
      const { legacyBehavior: _childLegacy, ...cleanedChildProps } = children.props;

      return React.cloneElement(children, {
        ref,
        href,
        ...props,
        ...cleanedChildProps,
        onClick: mergeHandlers(children.props),
      });
    }

    // Otherwise, fallback to creating a clean single anchor wrapper
    return React.createElement("a", { ref, href, ...props, onClick: mergeHandlers() }, children);
  });
});

// Mock window.matchMedia for all tests (jsdom does not implement it by default)
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = function (query) {
    return {
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
    };
  };
}
