import { CheckCircle2, ListChecks, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  entrepreneurApi,
  type RecommendationItem,
} from '../features/entrepreneur/entrepreneur-api';

export const RecommendationsPage = () => {
  const { accessToken } = useAuth();
  const [items, setItems] = useState<RecommendationItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (accessToken)
      entrepreneurApi
        .recommendations(accessToken)
        .then(setItems)
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : 'Could not load recommendations.'),
        );
  }, [accessToken]);
  return (
    <AppShell title="Recommendations">
      <section className="workspace-section-heading">
        <div>
          <span className="eyebrow">Next best actions</span>
          <h2>Turn readiness gaps into practical progress</h2>
          <p>
            Recommendations are generated from assessment evidence and may be reinforced by an
            approved expert.
          </p>
        </div>
      </section>
      {error ? <p className="form-error workspace-notice">{error}</p> : null}
      <div className="recommendation-grid">
        {items.map((item) => (
          <article key={item.id}>
            <header>
              <span>
                <Sparkles />
              </span>
              <div>
                <small>
                  {item.category} · {item.priority} priority
                </small>
                <h3>{item.title}</h3>
              </div>
            </header>
            <p>{item.description}</p>
            {item.actionSteps.length ? (
              <div className="action-step-list">
                <strong>
                  <ListChecks /> Suggested steps
                </strong>
                {item.actionSteps.map((step) => (
                  <span key={step}>
                    <CheckCircle2 /> {step}
                  </span>
                ))}
              </div>
            ) : null}
            <footer>
              <label className="recommendation-status-control">
                <span className="sr-only">Update status for {item.title}</span>
                <select
                  value={item.status}
                  onChange={async (event) => {
                    const updated = await entrepreneurApi.updateRecommendationStatus(
                      accessToken as string,
                      item.id,
                      event.target.value,
                    );
                    setItems((current) =>
                      current.map((entry) => (entry.id === item.id ? updated : entry)),
                    );
                  }}
                >
                  <option value="NEW">New</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </label>
              <time>{new Date(item.createdAt).toLocaleDateString()}</time>
            </footer>
          </article>
        ))}
        {!items.length ? (
          <div className="empty-workspace-state">
            <Sparkles />
            <h3>No recommendations yet</h3>
            <p>Complete an assessment to receive readiness recommendations.</p>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
};
