require("@testing-library/jest-dom");

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
