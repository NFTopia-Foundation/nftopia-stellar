import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { Button } from "../components/ui/button";
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from "../components/ui/dropdown";
import { EmptyState } from "../components/ui/empty-state";
import { DataTable } from "../components/ui/data-table";
import { DataGrid } from "../components/ui/data-grid";
import { DataList } from "../components/ui/data-list";

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("sets aria-disabled and disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("sets aria-pressed when pressed prop is provided", () => {
    render(<Button pressed={true}>Toggle</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("shows loading state with sr-only text and aria-busy", () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("passes aria-label through", () => {
    render(<Button aria-label="Close dialog">X</Button>);
    expect(screen.getByRole("button", { name: "Close dialog" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Dropdown
// ---------------------------------------------------------------------------
describe("Dropdown", () => {
  function TestDropdown({ onSelect }: { onSelect?: () => void }) {
    return (
      <Dropdown>
        <DropdownTrigger>Open</DropdownTrigger>
        <DropdownMenu>
          <DropdownItem onClick={onSelect}>Item 1</DropdownItem>
          <DropdownItem>Item 2</DropdownItem>
        </DropdownMenu>
      </Dropdown>
    );
  }

  it("menu is hidden initially", () => {
    render(<TestDropdown />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens menu on trigger click", () => {
    render(<TestDropdown />);
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("trigger has aria-expanded=true when open", () => {
    render(<TestDropdown />);
    const trigger = screen.getByRole("button", { name: /open/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes menu on Escape key", () => {
    render(<TestDropdown />);
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes menu when item is selected", () => {
    const onSelect = jest.fn();
    render(<TestDropdown onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /open/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: /item 1/i }));
    expect(onSelect).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------
describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No results" description="Try a different search." />);
    expect(screen.getByText("No results")).toBeInTheDocument();
    expect(screen.getByText("Try a different search.")).toBeInTheDocument();
  });

  it("renders action button and calls handler", () => {
    const onAction = jest.fn();
    render(<EmptyState title="Empty" actionLabel="Refresh" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onAction).toHaveBeenCalled();
  });

  it("has role=status for screen readers", () => {
    render(<EmptyState title="No data" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataTable
// ---------------------------------------------------------------------------
describe("DataTable", () => {
  type Row = { name: string; value: string };
  const columns: import("../components/ui/data-table").DataTableColumn<Row>[] = [
    { key: "name", header: "Name" },
    { key: "value", header: "Value" },
  ];
  const data: Row[] = [
    { name: "Alice", value: "100" },
    { name: "Bob", value: "200" },
  ];

  it("renders column headers and rows", () => {
    render(<DataTable<Row> columns={columns} data={data} rowKey={(r) => r.name} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    render(
      <DataTable<Row>
        columns={columns}
        data={[]}
        rowKey={(r) => r.name}
        emptyState={{ title: "No rows" }}
      />
    );
    expect(screen.getByText("No rows")).toBeInTheDocument();
  });

  it("shows skeleton rows when loading", () => {
    const { container } = render(
      <DataTable<Row> columns={columns} data={[]} rowKey={(r) => r.name} loading />
    );
    expect(container.querySelector("table")).toHaveAttribute("aria-busy", "true");
  });
});

// ---------------------------------------------------------------------------
// DataGrid
// ---------------------------------------------------------------------------
describe("DataGrid", () => {
  type Card = { id: string; label: string };
  const items: Card[] = [{ id: "1", label: "Card A" }, { id: "2", label: "Card B" }];

  it("renders items", () => {
    render(
      <DataGrid<Card>
        data={items}
        rowKey={(i) => i.id}
        renderItem={(i) => <div>{i.label}</div>}
      />
    );
    expect(screen.getByText("Card A")).toBeInTheDocument();
    expect(screen.getByText("Card B")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    render(
      <DataGrid<Card>
        data={[]}
        rowKey={(i) => i.id}
        renderItem={(i) => <div>{i.label}</div>}
        emptyState={{ title: "No cards" }}
      />
    );
    expect(screen.getByText("No cards")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DataList
// ---------------------------------------------------------------------------
describe("DataList", () => {
  type ListItem = { id: string; text: string };
  const items: ListItem[] = [{ id: "1", text: "Item A" }, { id: "2", text: "Item B" }];

  it("renders list items", () => {
    render(
      <DataList<ListItem>
        data={items}
        rowKey={(i) => i.id}
        renderItem={(i) => <span>{i.text}</span>}
        aria-label="Test list"
      />
    );
    expect(screen.getByRole("list", { name: "Test list" })).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
  });

  it("shows empty state when data is empty", () => {
    render(
      <DataList<ListItem>
        data={[]}
        rowKey={(i) => i.id}
        renderItem={(i) => <span>{i.text}</span>}
        emptyState={{ title: "No items found" }}
      />
    );
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });
});
