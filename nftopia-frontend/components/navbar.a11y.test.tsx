import React from "react";
import { render } from "@testing-library/react";
import { Navbar } from "./navbar";
import "@testing-library/jest-dom";

describe("Navbar minimal test (ESM)", () => {
  it("renders without crashing", () => {
    render(<Navbar />);
  });
});
