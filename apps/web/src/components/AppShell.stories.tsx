import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppShell from './AppShell';

function AppShellWithRoute() {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/*" element={<AppShell />}>
          <Route index element={<div className="p-6">Dashboard content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

const meta = {
  component: AppShellWithRoute,
  tags: ['ai-generated'],
} satisfies Meta<typeof AppShellWithRoute>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // AppShell renders nav links in both desktop sidebar and mobile tab bar
    const links = canvas.getAllByRole('link', { name: /dashboard/i });
    await expect(links[0]).toBeVisible();
  },
};
