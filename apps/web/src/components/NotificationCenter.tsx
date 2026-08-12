import { Bell, CheckCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { notificationApi, type NotificationItem } from '../features/notifications/notification-api';
import { useNavigate } from '../routing/router';

export const NotificationCenter = ({ accessToken }: { accessToken: string | null }) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    if (!accessToken) return;
    try {
      const page = await notificationApi.list(accessToken);
      setItems(page.items);
      setUnread(page.unread);
    } catch {
      // Authentication and network errors are handled by the surrounding workspace.
    }
  };

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(interval);
  }, [accessToken]);

  const openItem = async (item: NotificationItem) => {
    if (accessToken && !item.readAt) {
      await notificationApi.read(accessToken, item.id);
      setUnread((current) => Math.max(0, current - 1));
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      );
    }
    setOpen(false);
    if (item.href) navigate(item.href);
  };

  return (
    <div className="notification-center">
      <button
        type="button"
        className="notification-center__trigger"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-controls="notification-center-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Bell aria-hidden="true" />
        {unread ? <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span> : null}
      </button>
      {open ? (
        <section
          id="notification-center-panel"
          className="notification-center__panel"
          aria-label="Recent notifications"
        >
          <header>
            <div>
              <strong>Notifications</strong>
              <small>{unread ? `${unread} unread` : 'You are up to date'}</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close notifications">
              <X aria-hidden="true" />
            </button>
          </header>
          {unread ? (
            <button
              type="button"
              className="notification-center__read-all"
              onClick={async () => {
                if (!accessToken) return;
                await notificationApi.readAll(accessToken);
                setUnread(0);
                setItems((current) =>
                  current.map((item) => ({
                    ...item,
                    readAt: item.readAt ?? new Date().toISOString(),
                  })),
                );
              }}
            >
              <CheckCheck aria-hidden="true" /> Mark all as read
            </button>
          ) : null}
          <div className="notification-center__list">
            {items.map((item) => (
              <button
                type="button"
                key={item.id}
                className={item.readAt ? '' : 'unread'}
                onClick={() => void openItem(item)}
              >
                <span aria-hidden="true" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.message}</p>
                  <time>{new Date(item.createdAt).toLocaleString()}</time>
                </div>
              </button>
            ))}
            {!items.length ? (
              <p className="notification-center__empty">No notifications yet.</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
};
