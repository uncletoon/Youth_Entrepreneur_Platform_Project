import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Redirect, useNavigate } from '../routing/router';
import { Brand } from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';
import {
  adminApi,
  type AdminConfiguration,
  type AdminOverview,
  type AssessmentRow,
  type AuditRow,
  type DomainRow,
  type EntrepreneurRow,
  type ExpertApplicationRow,
  type QuestionRow,
  type SectorRow,
  type SystemUserRow,
} from '../features/admin/admin-api';

export type AdminSection =
  | 'overview'
  | 'entrepreneurs'
  | 'reviews'
  | 'questions'
  | 'configuration'
  | 'applications'
  | 'users'
  | 'audits';

type ConfigurationEditor =
  | { kind: 'domain'; item: DomainRow }
  | { kind: 'sector'; item: SectorRow }
  | null;

const NAV_ITEMS: { section: AdminSection; to: string; label: string; Icon: typeof LayoutDashboard }[] = [
  { section: 'overview', to: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { section: 'entrepreneurs', to: '/admin/entrepreneurs', label: 'Entrepreneurs', Icon: Users },
  { section: 'reviews', to: '/admin/reviews', label: 'Assessment Reviews', Icon: ClipboardList },
  { section: 'questions', to: '/admin/questions', label: 'Question Bank', Icon: FileText },
  { section: 'configuration', to: '/admin/configuration', label: 'Configuration', Icon: Settings },
];

const SYSTEM_NAV_ITEMS: { section: AdminSection; to: string; label: string; Icon: typeof LayoutDashboard }[] = [
  { section: 'applications', to: '/admin/applications', label: 'Expert Applications', Icon: ShieldCheck },
  { section: 'users', to: '/admin/users', label: 'Users & Roles', Icon: Users },
  { section: 'audits', to: '/admin/audits', label: 'Audit Logs', Icon: ClipboardList },
];

export const AdminDashboardPage = ({ section = 'overview' }: { section?: AdminSection }) => {
  const { user, accessToken, logout } = useAuth();
  const navigate = useNavigate();
  const isSystem = user?.role === 'SYSTEM_ADMIN';
  const tab = section;

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [entrepreneurs, setEntrepreneurs] = useState<EntrepreneurRow[]>([]);
  const [assessments, setAssessments] = useState<AssessmentRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionDomain, setQuestionDomain] = useState('ALL');
  const [questionPendingDelete, setQuestionPendingDelete] = useState<QuestionRow | null>(null);
  const [configuration, setConfiguration] = useState<AdminConfiguration>({ sectors: [], domains: [] });
  const [users, setUsers] = useState<SystemUserRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [applications, setApplications] = useState<ExpertApplicationRow[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [reviewNote, setReviewNote] = useState('');
  const [configurationEditor, setConfigurationEditor] = useState<ConfigurationEditor>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!accessToken) return;
    setError('');
    setLoading(true);
    try {
      const [summary, people, queue, bank, config] = await Promise.all([
        adminApi.overview(accessToken),
        adminApi.entrepreneurs(accessToken),
        adminApi.assessments(accessToken),
        adminApi.questions(accessToken),
        adminApi.configuration(accessToken),
      ]);
      setOverview(summary);
      setEntrepreneurs(people);
      setAssessments(queue);
      setQuestions(bank);
      setConfiguration(config);
      if (isSystem) {
        const [allUsers, auditRows, expertRows] = await Promise.all([
          adminApi.users(accessToken),
          adminApi.audits(accessToken),
          adminApi.expertApplications(accessToken),
        ]);
        setUsers(allUsers);
        setAudits(auditRows);
        setApplications(expertRows);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load administration data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSystem || user?.expertApprovalStatus === 'APPROVED') void load();
  }, [accessToken, isSystem, user?.expertApprovalStatus]);

  if (!isSystem && user?.expertApprovalStatus !== 'APPROVED')
    return <Redirect to="/expert/profile" />;

  const run = async (action: () => Promise<unknown>, message: string) => {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The operation failed.');
    }
  };

  const filteredQuestions = questions.filter((question) => {
    const matchesDomain = questionDomain === 'ALL' || question.domain.id === questionDomain;
    const search = questionSearch.trim().toLowerCase();
    const matchesSearch =
      !search ||
      question.code.toLowerCase().includes(search) ||
      question.prompt.toLowerCase().includes(search);
    return matchesDomain && matchesSearch;
  });

  // Domain question counts by domain for overview
  const domainHealth = configuration.domains.map((domain) => ({
    ...domain,
    activeCount: questions.filter((q) => q.domain.id === domain.id && q.active).length,
  }));

  return (
    <main className="admin-page">
      <header className="dashboard-header admin-dashboard-header">
        <Brand />
        <div className="admin-header-right">
          <div className="admin-header-badge">
            <ShieldCheck />
            <span>{isSystem ? 'System Administrator' : 'Expert Administrator'}</span>
          </div>
          <button
            className="admin-header-btn"
            onClick={() => void load()}
            title="Refresh data"
            disabled={loading}
          >
            <RefreshCw className={loading ? 'spinning' : ''} />
            <span>Refresh</span>
          </button>
          <button
            className="admin-header-btn admin-header-btn--danger"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut />
            <span>Log out</span>
          </button>
        </div>
      </header>

      <div className="admin-layout">
        {/* Sidebar Navigation */}
        <aside className="admin-nav">
          <div className="admin-nav__brand">
            <h2>Administration</h2>
            <small>{user?.fullName ?? user?.email}</small>
          </div>
          <nav className="admin-nav__links">
            {NAV_ITEMS.map(({ section: sec, to, label, Icon }) => (
              <Link
                key={sec}
                to={to}
                className={`admin-nav__link ${tab === sec ? 'active' : ''}`}
              >
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {isSystem && (
            <>
              <div className="admin-nav__section-label">System</div>
              <nav className="admin-nav__links">
                {SYSTEM_NAV_ITEMS.map(({ section: sec, to, label, Icon }) => (
                  <Link
                    key={sec}
                    to={to}
                    className={`admin-nav__link ${tab === sec ? 'active' : ''}`}
                  >
                    <Icon />
                    <span>{label}</span>
                    {sec === 'applications' && applications.filter((a) => a.approvalStatus === 'PENDING').length > 0 && (
                      <span className="admin-nav__badge">
                        {applications.filter((a) => a.approvalStatus === 'PENDING').length}
                      </span>
                    )}
                  </Link>
                ))}
              </nav>
            </>
          )}
        </aside>

        {/* Main Content */}
        <section className="admin-main">
          {error ? (
            <div className="admin-alert admin-alert--error">
              <AlertCircle />
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}><XCircle /></button>
            </div>
          ) : null}
          {notice ? (
            <div className="admin-alert admin-alert--success">
              <CheckCircle2 />
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice('')}><XCircle /></button>
            </div>
          ) : null}

          {/* ── OVERVIEW ── */}
          {tab === 'overview' ? (
            <>
              <div className="admin-title">
                <div>
                  <span className="eyebrow">Operational overview</span>
                  <h1>YERSPS Administration</h1>
                  <p>Monitor platform activity, entrepreneur progress, and domain health.</p>
                </div>
                <button
                  className="primary-action admin-export-btn"
                  onClick={() => void adminApi.downloadReport(accessToken as string)}
                >
                  <Download /> Export CSV
                </button>
              </div>

              <div className="admin-stat-grid">
                <StatCard
                  label="Active entrepreneurs"
                  value={overview?.entrepreneurs ?? 0}
                  Icon={Users}
                  color="green"
                />
                <StatCard
                  label="Businesses registered"
                  value={overview?.businesses ?? 0}
                  Icon={Building2}
                  color="blue"
                />
                <StatCard
                  label="Awaiting review"
                  value={overview?.submitted ?? 0}
                  Icon={ClipboardList}
                  color="amber"
                />
                <StatCard
                  label="Average score"
                  value={`${overview?.averageScore ?? 0}/100`}
                  Icon={BarChart3}
                  color="purple"
                />
              </div>

              <div className="admin-overview-grid">
                <section className="admin-panel">
                  <h2>Review activity</h2>
                  <p>
                    <strong>{overview?.reviewed ?? 0}</strong> assessments have been reviewed.
                    Use the review queue to inspect submitted results and update their status.
                  </p>
                  <Link to="/admin/reviews" className="admin-panel-link">
                    Open review queue →
                  </Link>
                </section>
                <section className="admin-panel">
                  <h2>Domain health</h2>
                  <div className="domain-health-list">
                    {domainHealth.slice(0, 5).map((domain) => (
                      <div key={domain.id} className="domain-health-item">
                        <div className="domain-health-info">
                          <strong>{domain.name}</strong>
                          <span className={domain.activeCount >= 5 ? 'count-good' : 'count-warning'}>
                            {domain.activeCount} active questions{domain.activeCount < 5 ? ' ⚠' : ''}
                          </span>
                        </div>
                        <div className="domain-health-bar">
                          <div
                            className="domain-health-fill"
                            style={{
                              width: `${Math.min((domain.activeCount / 10) * 100, 100)}%`,
                              background: domain.activeCount >= 5 ? 'var(--green-500)' : '#f59e0b',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link to="/admin/questions" className="admin-panel-link">
                    Manage questions →
                  </Link>
                </section>
              </div>
            </>
          ) : null}

          {/* ── ENTREPRENEURS ── */}
          {tab === 'entrepreneurs' ? (
            <>
              <Heading
                title="Entrepreneurs & feedback"
                subtitle="Review profiles, latest businesses, assessment results, and send expert guidance."
              />
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Entrepreneur</th>
                      <th>Business</th>
                      <th>Profile</th>
                      <th>Latest result</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entrepreneurs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          No entrepreneurs registered yet.
                        </td>
                      </tr>
                    ) : (
                      entrepreneurs.map((person) => (
                        <tr key={person.id}>
                          <td>
                            <strong>{person.fullName}</strong>
                            <small>{person.email ?? person.phone}</small>
                          </td>
                          <td>
                            {person.businesses[0]?.name ?? (
                              <span className="text-muted">Not added</span>
                            )}
                            <small>{person.businesses[0]?.sector?.name}</small>
                          </td>
                          <td>
                            <div className="table-progress">
                              <div
                                className="table-progress-bar"
                                style={{
                                  width: `${person.entrepreneurProfile?.completionPercent ?? 0}%`,
                                }}
                              />
                              <span>{person.entrepreneurProfile?.completionPercent ?? 0}%</span>
                            </div>
                          </td>
                          <td>
                            {person.assessmentSessions[0]?.result ? (
                              <>
                                <strong>
                                  {person.assessmentSessions[0].result.overallScore}/100
                                </strong>
                                <small>
                                  {person.assessmentSessions[0].result.readinessLevel.replaceAll(
                                    '_',
                                    ' ',
                                  )}
                                </small>
                              </>
                            ) : (
                              <span className="text-muted">Not submitted</span>
                            )}
                          </td>
                          <td>
                            <Link
                              className="table-action-link"
                              to={`/admin/entrepreneurs/${person.id}`}
                            >
                              Open profile
                            </Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {/* ── REVIEWS ── */}
          {tab === 'reviews' ? (
            <>
              <Heading
                title="Assessment review queue"
                subtitle="Track submitted assessments through review and archival."
              />
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Entrepreneur</th>
                      <th>Business</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Update status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="table-empty">
                          No assessments awaiting review.
                        </td>
                      </tr>
                    ) : (
                      assessments.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <Link to={`/admin/entrepreneurs/${item.user.id}`} style={{ fontWeight: 600, color: 'var(--brand)', textDecoration: 'none' }}>
                              {item.user.fullName}
                            </Link>
                            <small style={{ display: 'block' }}>{item.user.email ?? item.user.phone}</small>
                          </td>
                          <td>
                            {item.business.name}
                            <small>{item.business.sector?.name}</small>
                          </td>
                          <td>
                            {item.result ? (
                              <>
                                <strong>{item.result.overallScore}/100</strong>
                                <small>{item.result.riskLevel.replaceAll('_', ' ')}</small>
                              </>
                            ) : (
                              'Pending'
                            )}
                          </td>
                          <td>
                            <span className={`status-pill status-pill--${item.status.toLowerCase()}`}>
                              {item.status.replaceAll('_', ' ')}
                            </span>
                          </td>
                          <td>
                            <select
                              value={item.status}
                              className="status-select"
                              onChange={(event) =>
                                void run(
                                  () =>
                                    adminApi.review(
                                      accessToken as string,
                                      item.id,
                                      event.target.value,
                                    ),
                                  'Review status updated.',
                                )
                              }
                            >
                              <option value="SUBMITTED" disabled>
                                Submitted
                              </option>
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
              </div>
            </>
          ) : null}

          {/* ── QUESTIONS ── */}
          {tab === 'questions' ? (
            <>
              <div className="admin-title">
                <div>
                  <span className="eyebrow">Assessment content</span>
                  <h1>Question bank</h1>
                  <p>
                    Browse, filter, edit, archive, or delete assessment questions. Every domain
                    must maintain at least five active core questions.
                  </p>
                </div>
                <Link className="primary-action admin-export-btn" to="/admin/questions/new">
                  <Plus /> Add question
                </Link>
              </div>

              <div className="question-bank-summary">
                <article>
                  <span>Total questions</span>
                  <strong>{questions.length}</strong>
                </article>
                <article>
                  <span>Active</span>
                  <strong>{questions.filter((q) => q.active).length}</strong>
                </article>
                <article>
                  <span>Core scope</span>
                  <strong>{questions.filter((q) => q.scope === 'CORE').length}</strong>
                </article>
                <article>
                  <span>Domains</span>
                  <strong>{configuration.domains.length}</strong>
                </article>
                <article>
                  <span>Archived</span>
                  <strong>{questions.filter((q) => !q.active).length}</strong>
                </article>
              </div>

              <div className="question-toolbar">
                <label>
                  <span className="sr-only">Search questions</span>
                  <input
                    value={questionSearch}
                    onChange={(event) => setQuestionSearch(event.target.value)}
                    placeholder="Search by code or question text…"
                  />
                </label>
                <label>
                  <span className="sr-only">Filter by domain</span>
                  <select
                    value={questionDomain}
                    onChange={(event) => setQuestionDomain(event.target.value)}
                  >
                    <option value="ALL">All domains</option>
                    {configuration.domains.map((domain) => (
                      <option key={domain.id} value={domain.id}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="question-count-badge">{filteredQuestions.length} shown</span>
              </div>

              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Question</th>
                      <th>Domain</th>
                      <th>Scope</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQuestions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="table-empty">
                          No questions match your search.
                        </td>
                      </tr>
                    ) : (
                      filteredQuestions.map((question) => (
                        <tr key={question.id}>
                          <td>
                            <strong>{question.code}</strong>
                            <small>Order {question.displayOrder}</small>
                          </td>
                          <td className="question-prompt-cell">{question.prompt}</td>
                          <td>{question.domain.name}</td>
                          <td>
                            <span className="scope-badge">{question.scope}</span>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${question.active ? 'status-pill--success' : ''}`}
                            >
                              {question.active ? 'Active' : 'Archived'}
                            </span>
                          </td>
                          <td className="table-actions">
                            <Link to={`/admin/questions/${question.id}/edit`} className="table-action-icon">
                              <Edit3 /> Edit
                            </Link>
                            <button
                              type="button"
                              className="table-action-icon danger-action"
                              onClick={() => setQuestionPendingDelete(question)}
                            >
                              <Trash2 /> Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Delete confirmation modal */}
              {questionPendingDelete ? (
                <div className="modal-backdrop" role="presentation">
                  <section
                    className="admin-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-question-title"
                  >
                    <span className="modal-icon modal-icon--danger">
                      <Trash2 />
                    </span>
                    <h2 id="delete-question-title">Remove this question?</h2>
                    <p>
                      <strong>{questionPendingDelete.code}</strong>:{' '}
                      {questionPendingDelete.prompt}
                    </p>
                    <p className="modal-note">
                      If this question has historical responses, YERSPS will archive it instead
                      of permanently deleting those records.
                    </p>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setQuestionPendingDelete(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => {
                          const item = questionPendingDelete;
                          setQuestionPendingDelete(null);
                          void run(
                            () => adminApi.deleteQuestion(accessToken as string, item.id),
                            'Question removed from future assessments.',
                          );
                        }}
                      >
                        Remove question
                      </button>
                    </div>
                  </section>
                </div>
              ) : null}
            </>
          ) : null}

          {/* ── CONFIGURATION ── */}
          {tab === 'configuration' ? (
            <>
              <Heading
                title="Sector & scoring configuration"
                subtitle="Review the current setup, then click Modify to open a focused editor for any item."
              />

              <section className="configuration-section">
                <div className="configuration-section-header">
                  <div>
                    <h2>Readiness domains</h2>
                    <p>
                      Weights influence the final readiness score. Each domain must keep at least
                      five active core questions.
                    </p>
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Domain</th>
                        <th>Weight</th>
                        <th>Active questions</th>
                        <th>Description</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configuration.domains.map((domain) => (
                        <tr key={domain.id}>
                          <td>{domain.displayOrder}</td>
                          <td>
                            <strong>{domain.name}</strong>
                            <small>{domain.code}</small>
                          </td>
                          <td>
                            <span className="weight-badge">{domain.weight}%</span>
                          </td>
                          <td>
                            <span
                              className={
                                domain._count.questions >= 5 ? 'count-good' : 'count-warning'
                              }
                            >
                              {domain._count.questions} questions
                              {domain._count.questions < 5 && ' ⚠ Minimum not met'}
                            </span>
                          </td>
                          <td>{domain.description}</td>
                          <td>
                            <button
                              type="button"
                              className="modify-btn"
                              onClick={() =>
                                setConfigurationEditor({ kind: 'domain', item: domain })
                              }
                            >
                              <Edit3 /> Modify
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="configuration-section">
                <div className="configuration-section-header">
                  <div>
                    <h2>Business sectors</h2>
                    <p>
                      Sector keywords support business classification and sector-specific question
                      routing.
                    </p>
                  </div>
                </div>
                <div className="admin-table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Sector</th>
                        <th>Keywords</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {configuration.sectors.map((sector) => (
                        <tr key={sector.id}>
                          <td>
                            <span className="scope-badge">{sector.code}</span>
                          </td>
                          <td>
                            <strong>{sector.name}</strong>
                            <small>{sector.description}</small>
                          </td>
                          <td>
                            <div className="keyword-chips">
                              {sector.keywords.slice(0, 4).map((kw) => (
                                <span key={kw} className="keyword-chip">
                                  {kw}
                                </span>
                              ))}
                              {sector.keywords.length > 4 && (
                                <span className="keyword-chip keyword-chip--more">
                                  +{sector.keywords.length - 4}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`status-pill ${sector.active ? 'status-pill--success' : ''}`}
                            >
                              {sector.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="modify-btn"
                              onClick={() =>
                                setConfigurationEditor({ kind: 'sector', item: sector })
                              }
                            >
                              <Edit3 /> Modify
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Configuration editor modal */}
              {configurationEditor ? (
                <div className="modal-backdrop" role="presentation">
                  <form
                    className="admin-modal configuration-modal"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const data = new FormData(event.currentTarget);
                      const editor = configurationEditor;
                      setConfigurationEditor(null);
                      if (editor.kind === 'domain') {
                        void run(
                          () =>
                            adminApi.updateDomain(accessToken as string, editor.item.id, {
                              name: String(data.get('name')),
                              weight: Number(data.get('weight')),
                              displayOrder: Number(data.get('displayOrder')),
                              description: String(data.get('description')),
                            }),
                          'Domain configuration updated.',
                        );
                      } else {
                        void run(
                          () =>
                            adminApi.updateSector(accessToken as string, editor.item.id, {
                              name: String(data.get('name')),
                              description: String(data.get('description')),
                              keywords: String(data.get('keywords'))
                                .split(',')
                                .map((v) => v.trim())
                                .filter(Boolean),
                              active: data.get('active') === 'on',
                            }),
                          'Sector configuration updated.',
                        );
                      }
                    }}
                    role="dialog"
                    aria-modal="true"
                  >
                    <div className="modal-header">
                      <div>
                        <span className="eyebrow">
                          Modify {configurationEditor.kind}
                        </span>
                        <h2>{configurationEditor.item.name}</h2>
                      </div>
                      <button
                        type="button"
                        className="modal-close-btn"
                        onClick={() => setConfigurationEditor(null)}
                      >
                        <XCircle />
                      </button>
                    </div>
                    <div className="modal-form-grid">
                      <label>
                        Name
                        <input
                          name="name"
                          defaultValue={configurationEditor.item.name}
                          required
                        />
                      </label>
                      {configurationEditor.kind === 'domain' ? (
                        <>
                          <label>
                            Weight (%)
                            <input
                              name="weight"
                              type="number"
                              min="1"
                              max="100"
                              defaultValue={configurationEditor.item.weight}
                              required
                            />
                          </label>
                          <label>
                            Display order
                            <input
                              name="displayOrder"
                              type="number"
                              min="1"
                              defaultValue={configurationEditor.item.displayOrder}
                              required
                            />
                          </label>
                        </>
                      ) : null}
                      <label className="wide">
                        Description
                        <textarea
                          name="description"
                          defaultValue={configurationEditor.item.description}
                          minLength={5}
                          required
                        />
                      </label>
                      {configurationEditor.kind === 'sector' ? (
                        <>
                          <label className="wide">
                            Classification keywords (comma-separated)
                            <input
                              name="keywords"
                              defaultValue={configurationEditor.item.keywords.join(', ')}
                              required
                            />
                          </label>
                          <label className="inline-check">
                            <input
                              name="active"
                              type="checkbox"
                              defaultChecked={configurationEditor.item.active}
                            />
                            Active sector
                          </label>
                        </>
                      ) : null}
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setConfigurationEditor(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="primary-action">
                        Save changes
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </>
          ) : null}

          {/* ── USERS ── */}
          {tab === 'users' && isSystem ? (
            <>
              <Heading
                title="Users, roles & access"
                subtitle="System-administrator changes require a reason and are written to the audit log."
              />
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Verified</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.fullName}</strong>
                          <small>{item.email ?? item.phone}</small>
                        </td>
                        <td>
                          <select
                            value={item.role}
                            className="status-select"
                            onChange={(event) =>
                              void run(
                                () =>
                                  adminApi.updateUser(accessToken as string, item.id, {
                                    role: event.target.value,
                                    reason: 'Role updated through system administration.',
                                  }),
                                'User role updated.',
                              )
                            }
                          >
                            <option value="ENTREPRENEUR">Entrepreneur</option>
                            <option value="ADMIN">Administrator</option>
                            <option value="SYSTEM_ADMIN">System administrator</option>
                          </select>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${item.status === 'ACTIVE' ? 'status-pill--success' : ''}`}
                          >
                            {item.status.replaceAll('_', ' ')}
                          </span>
                        </td>
                        <td>{item.contactVerifiedAt ? '✓ Yes' : '✗ No'}</td>
                        <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        <td>
                          <button
                            disabled={item.id === user?.id}
                            className="modify-btn"
                            onClick={() =>
                              void run(
                                () =>
                                  adminApi.updateUser(accessToken as string, item.id, {
                                    status:
                                      item.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED',
                                    reason:
                                      'Account status updated through system administration.',
                                  }),
                                'User status updated.',
                              )
                            }
                          >
                            {item.status === 'DISABLED' ? 'Enable' : 'Disable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {/* ── APPLICATIONS ── */}
          {tab === 'applications' && isSystem ? (
            <>
              <Heading
                title="Expert applications"
                subtitle="Review professional evidence before granting access to entrepreneur and business information."
              />
              <div className="admin-stat-grid expert-review-stats">
                <StatCard
                  label="Awaiting review"
                  value={applications.filter((a) => a.approvalStatus === 'PENDING').length}
                  Icon={ClipboardList}
                  color="amber"
                />
                <StatCard
                  label="Approved experts"
                  value={applications.filter((a) => a.approvalStatus === 'APPROVED').length}
                  Icon={CheckCircle2}
                  color="green"
                />
                <StatCard
                  label="Rejected"
                  value={applications.filter((a) => a.approvalStatus === 'REJECTED').length}
                  Icon={XCircle}
                  color="red"
                />
              </div>
              <div className="admin-table-wrap expert-applications-table">
                <table>
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Expertise</th>
                      <th>Experience</th>
                      <th>Employment</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.user.fullName}</strong>
                          <small>{item.user.email ?? item.user.phone}</small>
                        </td>
                        <td>
                          {item.expertiseField}
                          <small>{item.proficiencyLevel}</small>
                        </td>
                        <td>
                          {item.yearsOfExperience} years
                          <small>{item.highestQualification}</small>
                        </td>
                        <td>
                          {item.employmentStatus}
                          <small>{item.position ?? item.workplace ?? '—'}</small>
                        </td>
                        <td>
                          <span
                            className={`status-pill ${item.approvalStatus === 'APPROVED' ? 'status-pill--success' : item.approvalStatus === 'REJECTED' ? 'status-pill--danger' : ''}`}
                          >
                            {item.approvalStatus}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="table-action-link"
                            onClick={() => {
                              setSelectedApplication(item.id);
                              setReviewNote(item.reviewNote ?? '');
                            }}
                          >
                            View application
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedApplication
                ? (() => {
                    const application = applications.find((a) => a.id === selectedApplication);
                    if (!application) return null;
                    return (
                      <section className="admin-panel expert-review-panel">
                        <div className="expert-review-header">
                          <div>
                            <span className="eyebrow">Professional evidence</span>
                            <h2>{application.user.fullName}</h2>
                            <p>
                              Applied{' '}
                              {application.submittedAt
                                ? new Date(application.submittedAt).toLocaleDateString()
                                : 'date unknown'}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="modify-btn"
                            onClick={() => setSelectedApplication('')}
                          >
                            Close panel
                          </button>
                        </div>
                        <dl className="expert-evidence-grid">
                          <div>
                            <dt>Field</dt>
                            <dd>{application.expertiseField}</dd>
                          </div>
                          <div>
                            <dt>Proficiency</dt>
                            <dd>{application.proficiencyLevel}</dd>
                          </div>
                          <div>
                            <dt>Experience</dt>
                            <dd>{application.yearsOfExperience} years</dd>
                          </div>
                          <div>
                            <dt>Current work</dt>
                            <dd>
                              {[application.position, application.workplace]
                                .filter(Boolean)
                                .join(' at ') || application.employmentStatus}
                            </dd>
                          </div>
                          <div>
                            <dt>Qualification</dt>
                            <dd>
                              {application.highestQualification}, {application.institution}
                            </dd>
                          </div>
                          <div>
                            <dt>Certifications</dt>
                            <dd>{application.certifications || 'Not provided'}</dd>
                          </div>
                        </dl>
                        <div className="expert-summary">
                          <strong>Professional summary</strong>
                          <p>{application.professionalSummary}</p>
                          {application.evidenceUrl ? (
                            <a href={application.evidenceUrl} target="_blank" rel="noreferrer">
                              Open supporting evidence →
                            </a>
                          ) : null}
                        </div>
                        <label className="review-note-field">
                          Decision note
                          <textarea
                            value={reviewNote}
                            onChange={(event) => setReviewNote(event.target.value)}
                            minLength={5}
                            placeholder="Record why this application is approved or rejected."
                          />
                        </label>
                        <div className="expert-review-actions">
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() =>
                              void run(
                                () =>
                                  adminApi.reviewExpert(
                                    accessToken as string,
                                    application.id,
                                    'REJECTED',
                                    reviewNote,
                                  ),
                                'Expert application rejected.',
                              )
                            }
                          >
                            Reject application
                          </button>
                          <button
                            className="primary-action"
                            type="button"
                            onClick={() =>
                              void run(
                                () =>
                                  adminApi.reviewExpert(
                                    accessToken as string,
                                    application.id,
                                    'APPROVED',
                                    reviewNote,
                                  ),
                                'Expert application approved.',
                              )
                            }
                          >
                            Approve expert
                          </button>
                        </div>
                      </section>
                    );
                  })()
                : null}
            </>
          ) : null}

          {/* ── AUDITS ── */}
          {tab === 'audits' && isSystem ? (
            <>
              <Heading
                title="Audit log"
                subtitle="Recent security, configuration, review, and account-management events."
              />
              <div className="admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Entity</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <small>{new Date(item.createdAt).toLocaleString()}</small>
                        </td>
                        <td>
                          {item.actor?.fullName ?? 'System'}
                          <small>{item.actor?.role}</small>
                        </td>
                        <td>
                          <span className="scope-badge">{item.action}</span>
                        </td>
                        <td>
                          {item.entityType}
                          <small>{item.entityId}</small>
                        </td>
                        <td>{item.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
};

// ── Sub-components ──

const StatCard = ({
  label,
  value,
  Icon,
  color,
}: {
  label: string;
  value: string | number;
  Icon: typeof LayoutDashboard;
  color: 'green' | 'blue' | 'amber' | 'purple' | 'red';
}) => (
  <article className={`admin-stat-card admin-stat-card--${color}`}>
    <div className="admin-stat-card__icon">
      <Icon />
    </div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  </article>
);

const Heading = ({ title, subtitle }: { title: string; subtitle: string }) => (
  <div className="admin-title">
    <div>
      <span className="eyebrow">YERSPS operations</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  </div>
);
