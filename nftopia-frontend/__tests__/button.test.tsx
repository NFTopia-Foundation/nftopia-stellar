import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button } from "../components/ui/button";

describe("Button component", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("applies default variant classes", () => {
    render(<Button>Default</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-gradient-to-br/);
  });

  it("applies wallet variant classes", () => {
    render(<Button variant="wallet">Connect</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/from-\[#4e3bff\]/);
  });

  it("applies wallet-outline variant classes", () => {
    render(<Button variant="wallet-outline">Connected</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/bg-\[#4e3bff\]\/20/);
  });

  it("applies danger-ghost variant classes", () => {
    render(<Button variant="danger-ghost">Disconnect</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/text-red-400/);
  });

  it("shows loading spinner and sets aria-busy when loading", () => {
    render(<Button loading>Submit</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn.querySelector("svg")).toBeInTheDocument();
  });

  it("shows loadingText when loading and loadingText is provided", () => {
    render(<Button loading loadingText="Saving...">Save</Button>);
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onClick when clicked", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const handleClick = jest.fn();
    render(<Button disabled onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("renders as child element when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    expect(screen.getByRole("link", { name: "Link Button" })).toBeInTheDocument();
  });

  it("applies pill size classes", () => {
    render(<Button size="pill">Pill</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/rounded-full/);
  });

  it("merges custom className with variant classes", () => {
    render(<Button className="my-custom-class">Custom</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toMatch(/my-custom-class/);
  });
});
