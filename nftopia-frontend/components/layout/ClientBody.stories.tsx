import type { Meta, StoryObj } from "@storybook/react";
import { ClientBody, ClientBodyProps } from "./ClientBody";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof ClientBody> = {
  title: "Layout/ClientBody",
  component: ClientBody,
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof ClientBody>;

export const Default: Story = {
  args: {
    children: <div className="p-8">Main content area</div>,
    header: <div className="bg-purple-700 text-white p-4">Header</div>,
    footer: <div className="bg-gray-900 text-white p-4">Footer</div>,
    sidebar: <div className="p-4">Sidebar content</div>,
    showSidebar: true,
    loading: false,
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    loading: true,
  },
};

export const NoSidebar: Story = {
  args: {
    ...Default.args,
    showSidebar: false,
  },
};

export const NoHeaderFooter: Story = {
  args: {
    ...Default.args,
    header: undefined,
    footer: undefined,
  },
};

export const DarkMode: Story = {
  args: {
    ...Default.args,
    // Simulate dark mode by setting theme in Zustand store if needed
  },
};

export const Responsive: Story = {
  args: {
    ...Default.args,
    children: (
      <div className="p-4">
        <div className="text-lg mb-4">
          Resize the Storybook window to see responsive layout.
        </div>
        <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-lg">
          Responsive content
        </div>
      </div>
    ),
  },
};
