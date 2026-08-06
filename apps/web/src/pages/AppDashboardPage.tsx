import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  UserRound,
  Lock,
  Sparkles,
  MessageSquareText,
  Lightbulb,
  ShieldCheck,
  Clock,
  TrendingUp,
  AlertCircle,
  Check,
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

  const latestResult = overview?.latestSession?.result;

  return (
    <AppShell>
      <div className="dashboard-container">
        {/* Welcome & Overview Header */}
        <header className="dashboard-hero-header">
          <div className="hero-greeting">
            <div className="security-badge">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Account Securely Created</span>
            </div>
            <h1>Welcome back, {user?.fullName || 'Entrepreneur'}</h1>
            <p>
              Track your business readiness, manage your innovations, and access expert feedback.
            </p>
          </div>

          <div className="hero-progress-card">
            <div className="progress-header">
              <span className="progress-label">Overall Readiness Progress</span>
              <span className="progress-value">{profileCompletePct}%</span>
            </div>
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill" 
                style={{ width: `${Math.min(100, Math.max(0, profileCompletePct))}%` }} 
              />
            </div>
            <p className="progress-subtext">
              {hasProfile 
                ? 'Profile fully updated. Ready for assessment.' 
                : 'Complete your profile details to unlock full features.'}
            </p>
          </div>
        </header>

        {/* Quick Stats Grid */}
        <section className="dashboard-stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrapper text-slate-700 bg-slate-100">
              <UserRound className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <span className="stat-title">Personal Profile</span>
              <div className="stat-status">
                {hasProfile ? (
                  <span className="badge badge-success">
                    <Check className="w-3 h-3" /> Completed
                  </span>
                ) : (
                  <span className="badge badge-warning">Action Required</span>
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper text-slate-700 bg-slate-100">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <span className="stat-title">Innovations / Business</span>
              <div className="stat-status">
                {hasBusiness ? (
                  <span className="badge badge-success">
                    <Check className="w-3 h-3" /> {overview?.business?.name || 'Registered'}
                  </span>
                ) : (
                  <span className="badge badge-warning">No Innovation Added</span>
                )}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrapper text-slate-700 bg-slate-100">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="stat-info">
              <span className="stat-title">Readiness Assessment</span>
              <div className="stat-status">
                {latestResult ? (
                  <span className={`badge ${latestResult.overallScore >= 70 ? 'badge-success' : 'badge-danger'}`}>
                    Score: {Math.round(latestResult.overallScore)}/100
                  </span>
                ) : canAssess ? (
                  <span className="badge badge-neutral">Ready to Take</span>
                ) : (
                  <span className="badge badge-disabled">Locked</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Main Grid Content */}
        <div className="dashboard-main-grid">
          {/* Left Column: Action Steps & Latest Results */}
          <div className="main-content-column">
            {/* Guided Checklist Steps */}
            <section className="dashboard-card-panel">
              <div className="panel-header">
                <h2>Next Action Steps</h2>
                <span className="panel-subtitle">Follow these steps to complete your profile and readiness review.</span>
              </div>

              <div className="steps-list">
                {/* Contact Verification */}
                <article className="step-card">
                  <div className="step-number-badge text-emerald-600 bg-emerald-50">
                    <BadgeCheck className="w-5 h-5" />
                  </div>
                  <div className="step-details">
                    <div className="step-tag font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Security</div>
                    <h3>Verify your contact details</h3>
                    <p>Confirm control of the email address or phone number linked to your account.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => navigate('/app/verify-contact')}
                  >
                    Verify <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </article>

                {/* Profile Completion Step */}
                <article className="step-card">
                  <div className="step-number-badge text-slate-700 bg-slate-100">
                    <UserRound className="w-5 h-5" />
                  </div>
                  <div className="step-details">
                    <div className="step-tag font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Step 1</div>
                    <h3>Complete personal profile</h3>
                    <p>Provide education, location, experience, and contact preferences.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/app/profile')}
                  >
                    {hasProfile ? 'Review Profile' : 'Complete Profile'} <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </article>

                {/* Innovation Step */}
                <article className="step-card">
                  <div className="step-number-badge text-slate-700 bg-slate-100">
                    <ClipboardCheck className="w-5 h-5" />
                  </div>
                  <div className="step-details">
                    <div className="step-tag font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Step 2</div>
                    <h3>Manage your innovations</h3>
                    <p>Add and maintain your business ideas or enterprise details.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate('/app/innovations')}
                  >
                    {hasBusiness ? 'Manage Business' : 'Add Innovation'} <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </article>

                {/* Readiness Step */}
                <article className={`step-card ${!canAssess ? 'step-locked' : ''}`}>
                  <div className="step-number-badge text-slate-700 bg-slate-100">
                    {!canAssess ? <Lock className="w-5 h-5 text-slate-400" /> : <BarChart3 className="w-5 h-5" />}
                  </div>
                  <div className="step-details">
                    <div className="step-tag font-semibold text-slate-500 uppercase tracking-wider text-[11px]">Step 3</div>
                    <h3>Take readiness assessment</h3>
                    {canAssess ? (
                      <p>Answer evidence-based questions to generate an explainable score and report.</p>
                    ) : (
                      <p className="text-amber-700 font-medium text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {!hasProfile
                          ? 'Complete your profile first to unlock assessment.'
                          : 'Add at least one innovation to unlock assessment.'}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!canAssess}
                    onClick={() => navigate('/app/assignments')}
                  >
                    Start Assessment <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </article>
              </div>
            </section>

            {/* Latest Readiness Result Card */}
            {latestResult ? (
              <section className="readiness-summary-card">
                <div className="readiness-summary-body">
                  <div className="readiness-score-display">
                    <span className="summary-label">Latest Assessment Score</span>
                    <div className="score-number-row">
                      <span className="score-big">{Math.round(latestResult.overallScore)}</span>
                      <span className="score-total">/100</span>
                    </div>
                    <div className="score-tags">
                      <span className="badge badge-dark">
                        {latestResult.readinessLevel.replaceAll('_', ' ')}
                      </span>
                      <span className={`badge ${latestResult.riskLevel === 'HIGH_RISK' ? 'badge-danger' : 'badge-neutral'}`}>
                        Risk: {latestResult.riskLevel.replaceAll('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="readiness-summary-action">
                    <p className="summary-desc">
                      Review detailed breakdown of strengths, gaps, and recommendations.
                    </p>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => navigate(`/app/results/${overview.latestSession?.id}`)}
                    >
                      View Full Results <ArrowRight className="w-4 h-4 ml-1.5" />
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>

          {/* Right Column: Feedback & Recommendations */}
          <div className="sidebar-content-column">
            {/* Administrator Feedback */}
            {overview?.feedback && overview.feedback.length > 0 ? (
              <section className="dashboard-card-panel">
                <div className="panel-header flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="w-4 h-4 text-slate-700" />
                    <h2>Admin Feedback</h2>
                  </div>
                  <span className="badge badge-neutral">{overview.feedback.length}</span>
                </div>

                <div className="feedback-timeline">
                  {overview.feedback.map((item) => (
                    <div key={item.id} className="feedback-item-card">
                      <div className="feedback-header">
                        <span className="admin-name">{item.admin.fullName}</span>
                        <span className="feedback-date">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="feedback-text">{item.message}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Recommended Actions */}
            {overview?.recommendations && overview.recommendations.length > 0 ? (
              <section className="dashboard-card-panel">
                <div className="panel-header flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <h2>Recommended Actions</h2>
                  </div>
                  <button 
                    type="button" 
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900"
                    onClick={() => navigate('/app/recommendations')}
                  >
                    View all
                  </button>
                </div>

                <div className="recommendations-list">
                  {overview.recommendations.map((item) => (
                    <article key={item.id} className="recommendation-item">
                      <div className="rec-top">
                        <h4>{item.title}</h4>
                        <span className="badge badge-outline">
                          {item.status.replaceAll('_', ' ')}
                        </span>
                      </div>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Quick Support / Guidance Card */}
            <div className="support-banner-card">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-slate-800 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900 text-sm">Need Guidance?</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Check expert feedback or update your innovation details to receive tailored support.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
