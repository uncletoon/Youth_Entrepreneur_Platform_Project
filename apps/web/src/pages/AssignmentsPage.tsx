import { ArrowRight, BarChart3, Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  entrepreneurApi,
  type AssessmentSummary,
  type BusinessSummary,
} from '../features/entrepreneur/entrepreneur-api';
import { useNavigate } from '../routing/router';

export const AssignmentsPage = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState<AssessmentSummary[]>([]);
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    Promise.all([entrepreneurApi.assessments(accessToken), entrepreneurApi.businesses(accessToken)])
      .then(([assessmentRows, businessRows]) => {
        setAssessments(assessmentRows);
        setBusinesses(businessRows);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not load assessments.'),
      );
  }, [accessToken]);

  return (
    <AppShell title="Assessments and assignments">
      {error ? <p className="form-error workspace-notice">{error}</p> : null}
      <section className="workspace-section-heading">
        <div>
          <span className="eyebrow">Readiness work</span>
          <h2>Choose an innovation to assess</h2>
          <p>
            Every assessment is attached to one business or innovation, so progress remains clear.
          </p>
        </div>
      </section>
      <div className="assignment-business-list">
        {businesses.map((business) => (
          <article key={business.id}>
            <div>
              <BarChart3 />
              <span>
                <strong>{business.name}</strong>
                <small>{business.sector?.name ?? 'Sector pending'}</small>
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/app/assessment?businessId=${business.id}`)}
            >
              Start assessment <ArrowRight />
            </button>
          </article>
        ))}
        {!businesses.length ? <p>Add an innovation before starting an assessment.</p> : null}
      </div>
      <section className="workspace-section-heading workspace-section-heading--compact">
        <div>
          <span className="eyebrow">History</span>
          <h2>Your submitted and active assessments</h2>
        </div>
      </section>
      <div className="history-list">
        {assessments.map((item) => (
          <article key={item.id}>
            <Clock3 />
            <div>
              <strong>{item.business.name}</strong>
              <small>
                {new Date(item.createdAt).toLocaleDateString()} · {item.status.replaceAll('_', ' ')}
              </small>
            </div>
            {item.result ? (
              <b>{Math.round(item.result.overallScore)}/100</b>
            ) : (
              <span className="status-pill">In progress</span>
            )}
            {item.result ? (
              <button type="button" onClick={() => navigate(`/app/results/${item.id}`)}>
                View result
              </button>
            ) : null}
          </article>
        ))}
        {!assessments.length ? <p>No assessments have been started yet.</p> : null}
      </div>
    </AppShell>
  );
};
