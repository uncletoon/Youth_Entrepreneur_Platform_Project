import { apiRequest } from '../auth/auth-api';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: NotificationItem[];
  unread: number;
  nextCursor: string | null;
}

const authorized = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { ...init.headers, Authorization: `Bearer ${token}` },
});

export const notificationApi = {
  list: (token: string) => apiRequest<NotificationPage>('/notifications', authorized(token)),
  read: (token: string, notificationId: string) =>
    apiRequest<NotificationItem>(
      `/notifications/${notificationId}/read`,
      authorized(token, { method: 'PATCH' }),
    ),
  readAll: (token: string) =>
    apiRequest<{ updated: number }>(
      '/notifications/read-all',
      authorized(token, { method: 'PATCH' }),
    ),
};
