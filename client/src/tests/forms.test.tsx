import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FormsPage from '../pages/FormsPage';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../hooks/useToast';
import * as formsApi from '../services/formsApi';

vi.mock('../services/formsApi');

describe('FormsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows an empty state when there are no forms', async () => {
    vi.mocked(formsApi.listForms).mockResolvedValue({ forms: [] });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <FormsPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText(/no forms yet/i)).toBeInTheDocument();
  });

  it('lists existing forms with their status', async () => {
    vi.mocked(formsApi.listForms).mockResolvedValue({
      forms: [
        {
          id: 'form-1', business_id: 'biz-1', name: 'Contact Us', slug: 'contact-us',
          description: null, status: 'Active', thank_you_message: 'Thanks!',
          created_at: '', updated_at: '', fields: [],
        },
      ],
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <ToastProvider>
            <FormsPage />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Contact Us')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });
});
