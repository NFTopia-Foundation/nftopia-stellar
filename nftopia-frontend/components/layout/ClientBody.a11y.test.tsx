import React from "react";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { ClientBody, ClientBodyProps } from "./ClientBody";

expect.extend(toHaveNoViolations);

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

describe("ClientBody accessibility", () => {
  const baseProps: ClientBodyProps = {
    children: <div>Content</div>,
    header: <div>Header</div>,
    footer: <div>Footer</div>,
    sidebar: <div>Sidebar</div>,
    showSidebar: true,
  };

  it("has no accessibility violations (default)", async () => {
    const { container } = render(<ClientBody {...baseProps} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations (loading)", async () => {
    const { container } = render(<ClientBody {...baseProps} loading={true} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations (no sidebar)", async () => {
    const { container } = render(
      <ClientBody {...baseProps} showSidebar={false} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no accessibility violations (no header/footer)", async () => {
    const { container } = render(
      <ClientBody {...baseProps} header={undefined} footer={undefined} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
