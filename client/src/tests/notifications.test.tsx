import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import NotificationBell from '../components/NotificationBell';
import * as notificationsApi from '../services/notificationsApi';

vi.mock('../services/notificationsApi');

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an unread badge count from the API', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      notifications: [
        { id: 'n1', business_id: 'b1', user_id: 'u1', type: 'lead_assigned', title: 'New lead assigned to you', message: 'Ahmed Khan was assigned to you.', link: '/leads/lead-1', is_read: false, created_at: '' },
      ],
      unreadCount: 1,
    });

    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(await screen.findByText('1')).toBeInTheDocument();
  });

  it('opens the dropdown and marks a notification as read when clicked', async () => {
    vi.mocked(notificationsApi.listNotifications).mockResolvedValue({
      notifications: [
        { id: 'n1', business_id: 'b1', user_id: 'u1', type: 'lead_assigned', title: 'New lead assigned to you', message: 'Ahmed Khan was assigned to you.', link: null, is_read: false, created_at: '' },
      ],
      unreadCount: 1,
    });
    vi.mocked(notificationsApi.markNotificationRead).mockResolvedValue({
      notification: { id: 'n1', business_id: 'b1', user_id: 'u1', type: 'lead_assigned', title: 'New lead assigned to you', message: 'Ahmed Khan was assigned to you.', link: null, is_read: true, created_at: '' },
    });

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    await waitFor(() => expect(notificationsApi.listNotifications).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /notifications/i }));
    await user.click(await screen.findByText('New lead assigned to you'));

    await waitFor(() => {
      expect(notificationsApi.markNotificationRead).toHaveBeenCalledWith('n1');
    });
  });
});
