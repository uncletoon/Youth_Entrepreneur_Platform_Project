import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  UserRound,
  Lock,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from '../routing/router';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import {
  entrepreneurApi,
  type EntrepreneurOverview,
} from '../features/entrepreneur/entrepreneur-api';

export const AppDashboardPage = () => {
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<EntrepreneurOverview | null>(null);

  useEffect(() => {
    if (accessToken)
      entrepreneurApi
        .overview(accessToken)
        .then(setOverview)
        .catch(() => undefined);
  }, [accessToken]);

  const profileCompletePct = overview?.profile?.completionPercent ?? user?.profileCompletion ?? 0;
  const hasProfile = profileCompletePct >= 100;
  const hasBusiness = !!overview?.business;

  const canAssess = hasProfile && hasBusiness;

  return (
    <AppShell>
      <section className="dashboard-hero">
        <div>
          <span className="eyebrow">
            <CheckCircle2 /> Account securely created
          </span>
          <h1>Welcome, {user?.fullName}.</h1>
          <p>
            Your account is stored securely. Follow the steps below to begin your readiness journey.
          </p>
        </div>
        <div className="completion-card">
          <span>Profile completion</span>
          <strong>{profileCompletePct}%</strong>
          <div>
            <i style={{ width: `${profileCompletePct}%` }} />
          </div>
        </div>
      </section>
      
      <section className="dashboard-content">
        <h2>Your next steps</h2>
        <div className="dashboard-actions">
          <article>
            <span>
              <BadgeCheck />
            </span>
            <div>
              <small>Account security</small>
              <h3>Verify your contact</h3>
              <p>Confirm control of the email address or telephone number used for this account.</p>
            </div>
            <button type="button" onClick={() => navigate('/app/verify-contact')}>
              Verify <ArrowRight />
            </button>
          </article>
          
          <article>
            <span>
              <UserRound />
            </span>
            <div>
              <small>Step 1</small>
              <h3>Complete your personal profile</h3>
              <p>Add your location, education, experience, and preferred language.</p>
            </div>
            <button type="button" onClick={() => navigate('/app/profile')}>
              {hasProfile ? 'Review' : 'Continue'} <ArrowRight />
            </button>
          </article>
          
          <article>
            <span>
              <ClipboardCheck />
            </span>
            <div>
              <small>Step 2</small>
              <h3>Manage your innovations</h3>
              <p>Add one or more ideas or businesses before classification and assessment.</p>
            </div>
            <button type="button" onClick={() => navigate('/app/innovations')}>
              {hasBusiness ? 'Manage' : 'Continue'} <ArrowRight />
            </button>
          </article>
          
          <article className={!canAssess ? 'disabled-step' : ''}>
            <span>
              {!canAssess ? <Lock /> : <BarChart3 />}
            </span>
            <div>
              <small>Step 3</small>
              <h3>Take the readiness assessment</h3>
              {canAssess ? (
                <p>
                  Choose an innovation, complete its evidence-based questions, and receive an
                  explainable score.
                </p>
              ) : (
                <p style={{ color: '#b45309', fontWeight: 600 }}>
                  {!hasProfile
                    ? 'Please complete your personal profile first.'
                    : 'Please add an innovation first.'}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canAssess}
              onClick={() => navigate('/app/assignments')}
            >
              Start <ArrowRight />
            </button>
          </article>
        </div>

        {overview?.latestSession?.result ? (
          <section className="dashboard-summary">
            <div>
              <span className="eyebrow">Latest readiness result</span>
              <strong>{overview.latestSession.result.overallScore}/100</strong>
              <h3>{overview.latestSession.result.readinessLevel.replaceAll('_', ' ')}</h3>
              <p>Risk level: {overview.latestSession.result.riskLevel.replaceAll('_', ' ')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/app/results/${overview.latestSession?.id}`)}
            >
              View full result <ArrowRight />
            </button>
          </section>
        ) : null}

        {overview?.feedback && overview.feedback.length > 0 ? (
          <section className="dashboard-feed">
            <h2>Administrator feedback</h2>
            {overview.feedback.map((item) => (
              <article key={item.id}>
                <strong>{item.admin.fullName}</strong>
                <small>{new Date(item.createdAt).toLocaleDateString()}</small>
                <p>{item.message}</p>
              </article>
            ))}
          </section>
        ) : null}

        {overview?.recommendations && overview.recommendations.length > 0 ? (
          <section className="dashboard-feed">
            <h2>Recommended actions</h2>
            {overview.recommendations.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <span className="status-pill">{item.status.replaceAll('_', ' ')}</span>
                <p>{item.description}</p>
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </AppShell>
  );
};
