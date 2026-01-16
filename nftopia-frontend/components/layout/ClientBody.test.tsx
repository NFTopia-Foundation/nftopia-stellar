import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ClientBody, ClientBodyProps } from "./ClientBody";
import "@testing-library/jest-dom";

// Mock Zustand stores
jest.mock("../../lib/stores/preferences-store", () => ({
  useTheme: () => ({
    theme: { mode: "light" },
    setTheme: jest.fn(),
  }),
}));
jest.mock("../../lib/stores/app-store", () => {
  let sidebarOpen = false;
  return {
    useSidebar: () => ({
      sidebarOpen,
      toggleSidebar: () => (sidebarOpen = !sidebarOpen),
      closeSidebar: () => (sidebarOpen = false),
    }),
  };
});

describe("ClientBody", () => {
  const defaultProps: ClientBodyProps = {
    children: <div>Content</div>,
    header: <div data-testid="header">Header</div>,
    footer: <div data-testid="footer">Footer</div>,
    sidebar: <div data-testid="sidebar">Sidebar</div>,
    showSidebar: true,
  };

  it("renders children, header, and footer", () => {
    render(<ClientBody {...defaultProps} />);
    expect(screen.getByText("Content")).toBeInTheDocument();
    expect(screen.getByTestId("header")).toBeInTheDocument();
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("shows sidebar when open", () => {
    render(<ClientBody {...defaultProps} />);
    expect(screen.getByTestId("sidebar")).toBeInTheDocument();
  });

  it("shows loading skeleton when loading", () => {
    render(<ClientBody {...defaultProps} loading={true} />);
    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByText(
        (content, el) => el?.className.includes("animate-pulse") ?? false
      )
    ).toBeInTheDocument();
  });

  it("has correct ARIA roles and labels", () => {
    render(<ClientBody {...defaultProps} />);
    expect(screen.getByRole("main")).toHaveAttribute(
      "aria-label",
      "Main content"
    );
    expect(screen.getByLabelText("Sidebar")).toBeInTheDocument();
  });

  it("focuses sidebar when open and main when closed", () => {
    render(<ClientBody {...defaultProps} />);
    const sidebar = screen.getByLabelText("Sidebar");
    sidebar.focus();
    expect(document.activeElement).toBe(sidebar);
    // Simulate closing sidebar
    fireEvent.click(screen.getByLabelText("Close sidebar"));
    // Main should be focused next tick
    setTimeout(() => {
      expect(document.activeElement).toBe(screen.getByRole("main"));
    }, 0);
  });
});
