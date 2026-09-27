import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TemplateEditPage from './TemplateEditPage';
import * as api from '@/lib/api';
import type { Template } from '@/types/api';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/api');

const makeTemplate = (builtInType: Template['builtInType']): Template => ({
  id: 'template-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: 'Template',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
  builtInType,
});

function renderTemplateEditor(template: Template) {
  vi.mocked(api.apiGet).mockResolvedValue(template as never);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/templates/template-1/edit']}>
        <Routes>
          <Route path="/admin/templates/:id/edit" element={<TemplateEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TemplateEditPage formatting controls', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides formatting controls but keeps variable insertion for plain-text message templates', async () => {
    renderTemplateEditor(makeTemplate('band_invite_message'));

    expect(await screen.findByRole('toolbar', { name: 'Template variables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert variable' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bold' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Italic' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bullet list' })).not.toBeInTheDocument();
  });

  it('keeps formatting controls for rich email templates', async () => {
    renderTemplateEditor(makeTemplate('band_invite'));

    expect(await screen.findByRole('toolbar', { name: 'Text formatting' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bold' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Insert variable' })).toBeInTheDocument();
  });
});
