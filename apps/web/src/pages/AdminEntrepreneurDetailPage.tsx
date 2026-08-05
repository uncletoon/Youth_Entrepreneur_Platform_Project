import {
  ArrowLeft,
  BarChart3,
  Building2,
  MessageSquareText,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AdminWorkspaceShell } from '../components/AdminWorkspaceShell';
import { adminApi, type EntrepreneurDetail } from '../features/admin/admin-api';
import { useAuth } from '../features/auth/AuthContext';
import { Link } from '../routing/router';

type DetailTab = 'profile' | 'innovations' | 'assessments' | 'guidance';

const TAB_ITEMS: { value: DetailTab; label: string; Icon: typeof UserRound }[] = [
  { value: 'profile', label: 'Profile', Icon: UserRound },
  { value: 'innovations', label: 'Innovations', Icon: Building2 },
  { value: 'assessments', label: 'Assessments', Icon: BarChart3 },
  { value: 'guidance', label: 'Guidance', Icon: MessageSquareText },
];

export const AdminEntrepreneurDetailPage = ({ userId }: { userId: string }) => {
  const { accessToken } = useAuth();
  const [data, setData] = useState<EntrepreneurDetail | null>(null);
  const [tab, setTab] = useState<DetailTab>('profile');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');

  const load = async () => {
    if (!accessToken) return;
    try {
      const loaded = await adminApi.entrepreneur(accessToken, userId);
      setData(loaded);
      setSelectedBusinessId((current) => current || loaded.businesses[0]?.id || '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load entrepreneur details.');
    }
  };
  useEffect(() => { void load(); }, [accessToken, userId]);

  const selectedBusiness = useMemo(
    () => data?.businesses.find((item) => item.id === selectedBusinessId),
    [data, selectedBusinessId],
  );

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The action could not be completed.');
    }
  };

  const submitFeedback = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void run(
      () =>
        adminApi.feedback(
          accessToken as string,
          userId,
          String(values.get('businessId')),
          String(values.get('message')),
        ),
      'Expert feedback saved.',
    ).then(() => form.reset());
  };

  const submitRecommendation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    void run(
      () =>
        adminApi.recommendation(accessToken as string, userId, {
          businessId: String(values.get('businessId')),
          title: String(values.get('title')),
          description: String(values.get('description')),
          category: String(values.get('category')),
          priority: String(values.get('priority')),
          actionSteps: String(values.get('actionSteps'))
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      'Recommendation sent to the entrepreneur.',
    ).then(() => form.reset());
  };

  return (
    <AdminWorkspaceShell>
      <Link className="back-link" to="/admin/entrepreneurs">
        <ArrowLeft /> Back to entrepreneurs
      </Link>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="form-message admin-notice">{notice}</p> : null}

      {!data ? (
        <div className="admin-panel" style={{ textAlign: 'center', padding: '50px' }}>
          <div className="assessment-loading-spinner" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '16px', color: 'var(--muted)' }}>Loading entrepreneur profile…</p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="entrepreneur-detail-header">
            <div>
              <span className="eyebrow">Entrepreneur review</span>
              <h1>{data.fullName}</h1>
              <p>
                {data.email ?? data.phone} · Member since{' '}
                {new Date(data.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="detail-header-stats">
              <span>
                <strong>{data.businesses.length}</strong>
                Innovations
              </span>
              <span>
                <strong>{data.assessmentSessions.length}</strong>
                Assessments
              </span>
              <span>
                <strong>{data.recommendations.length}</strong>
                Recommendations
              </span>
            </div>
          </div>

          {/* Tab navigation */}
          <nav className="detail-tabs" aria-label="Entrepreneur details">
            {TAB_ITEMS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={tab === value ? 'active' : ''}
                onClick={() => setTab(value)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </nav>

          {/* Profile tab */}
          {tab === 'profile' ? (
            <section className="admin-panel profile-review-panel">
              <h2>Personal and readiness profile</h2>
              {data.entrepreneurProfile ? (
                <dl className="profile-data-grid">
                  {Object.entries(data.entrepreneurProfile)
                    .filter(([key]) => !['id', 'userId', 'createdAt', 'updatedAt'].includes(key))
                    .map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replace(/([A-Z])/g, ' $1').trim()}</dt>
                        <dd>{String(value ?? 'Not provided')}</dd>
                      </div>
                    ))}
                </dl>
              ) : (
                <p>No personal profile has been completed yet.</p>
              )}
            </section>
          ) : null}

          {/* Innovations tab */}
          {tab === 'innovations' ? (
            <section className="expert-innovation-list">
              {data.businesses.length === 0 ? (
                <div className="admin-panel" style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px' }}>
                  No innovations have been registered yet.
                </div>
              ) : (
                data.businesses.map((business) => (
                  <article
                    key={business.id}
                    className={selectedBusinessId === business.id ? 'selected' : ''}
                    onClick={() => setSelectedBusinessId(business.id)}
                  >
                    <header>
                      <span>
                        <Building2 />
                      </span>
                      <div>
                        <small>
                          {business.sector?.name ?? 'Sector pending'} · {business.stage}
                        </small>
                        <h2>{business.name}</h2>
                      </div>
                    </header>
                    <p>{business.description}</p>
                    <dl>
                      <div>
                        <dt>Problem</dt>
                        <dd>{business.problemSolved ?? 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt>Offer</dt>
                        <dd>{business.productOrService}</dd>
                      </div>
                      <div>
                        <dt>Customers</dt>
                        <dd>{business.targetCustomers ?? 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt>Revenue model</dt>
                        <dd>{business.revenueModel ?? 'Not specified'}</dd>
                      </div>
                    </dl>
                    {business.classifications[0] ? (
                      <div className="classification-note">
                        <strong>
                          Classification: {business.classifications[0].status}
                        </strong>
                        <span>
                          {Math.round(business.classifications[0].confidence * 100)}% confidence
                        </span>
                        <p>{business.classifications[0].explanation}</p>
                      </div>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          ) : null}

          {/* Assessments tab */}
          {tab === 'assessments' ? (
            <>
              <section className="admin-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Innovation</th>
                    <th>Submitted</th>
                    <th>Score</th>
                    <th>Readiness</th>
                    <th>Risk</th>
                    <th>Review state</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assessmentSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="table-empty">
                        No assessments submitted yet.
                      </td>
                    </tr>
                  ) : (
                    data.assessmentSessions.map((session) => (
                      <tr 
                        key={session.id} 
                        onClick={() => setSelectedSessionId(session.id)}
                        style={{ cursor: 'pointer', background: selectedSessionId === session.id ? 'var(--background)' : 'transparent' }}
                      >
                        <td>
                          {data.businesses.find((b) => b.id === session.businessId)?.name ??
                            'Innovation'}
                        </td>
                        <td>
                          {session.submittedAt
                            ? new Date(session.submittedAt).toLocaleDateString()
                            : 'In progress'}
                        </td>
                        <td>
                          {session.result ? `${Math.round(session.result.overallScore)}/100` : 'Pending'}
                        </td>
                        <td>
                          {session.result?.readinessLevel.replaceAll('_', ' ') ?? 'Pending'}
                        </td>
                        <td>
                          {session.result?.riskLevel.replaceAll('_', ' ') ?? 'Pending'}
                        </td>
                        <td>
                          <select
                            value={session.status}
                            className="status-select"
                            disabled={!session.result}
                            onChange={(event) =>
                              void run(
                                () =>
                                  adminApi.review(
                                    accessToken as string,
                                    session.id,
                                    event.target.value,
                                  ),
                                'Assessment review status updated.',
                              )
                            }
                          >
                            <option value="DRAFT">Draft</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="SUBMITTED">Submitted</option>
                            <option value="UNDER_REVIEW">Under review</option>
                            <option value="REVIEWED">Reviewed</option>
                            <option value="ARCHIVED">Archived</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
            
            {selectedSessionId && data.assessmentSessions.find(s => s.id === selectedSessionId)?.responses ? (
              <section className="admin-panel" style={{ marginTop: '24px' }}>
                <h2>Assessment answers</h2>
                <div className="responses-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                  {data.assessmentSessions.find(s => s.id === selectedSessionId)?.responses.map((response) => (
                    <article key={response.id} style={{ padding: '16px', background: 'var(--background)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <strong style={{ display: 'block', marginBottom: '8px' }}>{response.question.prompt}</strong>
                      <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                        {response.question.type === 'FILE_EVIDENCE' ? (
                          <a href={String(response.answer)} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)' }}>View attached evidence</a>
                        ) : response.question.type === 'LIKERT' ? (
                          <span>Score: {String(response.answer)} / 5</span>
                        ) : typeof response.answer === 'object' ? (
                          <pre style={{ margin: 0, fontFamily: 'inherit' }}>{JSON.stringify(response.answer, null, 2)}</pre>
                        ) : (
                          <span>{String(response.answer)}</span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
            </>
          ) : null}

          {/* Guidance tab */}
          {tab === 'guidance' ? (
            <div className="guidance-layout">
              <div>
                <form className="admin-panel guidance-form" onSubmit={submitFeedback}>
                  <h2>
                    <MessageSquareText /> Send expert feedback
                  </h2>
                  <label>
                    Innovation
                    <select
                      name="businessId"
                      value={selectedBusinessId}
                      onChange={(event) => setSelectedBusinessId(event.target.value)}
                      required
                    >
                      {data.businesses.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Feedback
                    <textarea
                      name="message"
                      minLength={5}
                      required
                      placeholder="Write clear, actionable observations about this innovation."
                    />
                  </label>
                  <button className="primary-action" type="submit" disabled={!selectedBusiness}>
                    Save feedback
                  </button>
                </form>

                <form className="admin-panel guidance-form" style={{ marginTop: '16px' }} onSubmit={submitRecommendation}>
                  <h2>
                    <Sparkles /> Add recommendation
                  </h2>
                  <input type="hidden" name="businessId" value={selectedBusinessId} />
                  <label>
                    Title
                    <input name="title" minLength={5} required placeholder="Recommendation title…" />
                  </label>
                  <div className="form-grid compact" style={{ gridTemplateColumns: '1fr 1fr', margin: 0, gap: '10px' }}>
                    <label>
                      Category
                      <input name="category" defaultValue="Expert guidance" required />
                    </label>
                    <label>
                      Priority
                      <select name="priority">
                        <option value="HIGH">High</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="LOW">Low</option>
                      </select>
                    </label>
                  </div>
                  <label>
                    Description
                    <textarea name="description" minLength={10} required placeholder="Describe the recommendation in detail." />
                  </label>
                  <label>
                    Action steps
                    <textarea
                      name="actionSteps"
                      required
                      placeholder={'One action per line:\nValidate prices with five customers\nUpdate the cash-flow plan'}
                    />
                  </label>
                  <button className="primary-action" type="submit" disabled={!selectedBusiness}>
                    Send recommendation
                  </button>
                </form>
              </div>

              <div>
                <section className="admin-panel guidance-history">
                  <h2>Guidance history</h2>
                  {[...data.adminFeedbackReceived, ...data.recommendations].length === 0 ? (
                    <p>No guidance has been sent yet.</p>
                  ) : null}
                  {data.adminFeedbackReceived.map((item) => (
                    <article key={item.id}>
                      <small>
                        {item.business?.name ?? 'General'} ·{' '}
                        {new Date(item.createdAt).toLocaleDateString()}
                      </small>
                      <strong>Feedback from {item.admin.fullName}</strong>
                      <p>{item.message}</p>
                    </article>
                  ))}
                  {data.recommendations.map((item) => (
                    <article key={item.id}>
                      <small>
                        {item.business?.name ?? 'General'} · {item.priority} priority
                      </small>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </article>
                  ))}
                </section>
              </div>
            </div>
          ) : null}
        </>
      )}
    </AdminWorkspaceShell>
  );
};
