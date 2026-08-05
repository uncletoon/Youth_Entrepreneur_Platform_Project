import { MessageSquareText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { entrepreneurApi, type FeedbackItem } from '../features/entrepreneur/entrepreneur-api';

export const FeedbackPage = () => {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (accessToken)
      entrepreneurApi
        .feedback(accessToken)
        .then(setItems)
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : 'Could not load feedback.'),
        );
  }, [accessToken]);
  return (
    <AppShell title="Expert feedback">
      <section className="workspace-section-heading">
        <div>
          <span className="eyebrow">Professional guidance</span>
          <h2>Feedback on your ideas and readiness</h2>
          <p>
            Comments are recorded by approved experts and remain available for your follow-up work.
          </p>
        </div>
      </section>
      {error ? <p className="form-error workspace-notice">{error}</p> : null}
      <div className="feedback-timeline">
        {items.map((item) => (
          <article key={item.id}>
            <span>
              <MessageSquareText />
            </span>
            <div>
              <header>
                <div>
                  <strong>{item.admin.fullName}</strong>
                  <small>
                    {item.admin.expertProfile?.expertiseField ?? 'Approved YERSPS expert'}
                  </small>
                  <small>
                    {item.business ? `Innovation: ${item.business.name}` : 'General guidance'}
                  </small>
                </div>
                <time>{new Date(item.createdAt).toLocaleDateString()}</time>
              </header>
              <p>{item.message}</p>
            </div>
          </article>
        ))}
        {!items.length ? (
          <div className="empty-workspace-state">
            <MessageSquareText />
            <h3>No expert feedback yet</h3>
            <p>Feedback will appear here after an approved expert reviews your submitted work.</p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
};
