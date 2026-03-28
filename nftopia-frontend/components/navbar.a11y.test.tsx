import React from "react";
import { render } from "@testing-library/react";
import { Navbar } from "./navbar";
import "@testing-library/jest-dom";

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

describe("Navbar minimal test (ESM)", () => {
  it("renders without crashing", () => {
    render(<Navbar />);
  });
});
