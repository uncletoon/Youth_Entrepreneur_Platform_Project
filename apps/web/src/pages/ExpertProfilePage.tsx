import type { ExpertProfileInput } from '@yersps/contracts';
import { Clock3, FileCheck2, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { AdminWorkspaceShell } from '../components/AdminWorkspaceShell';
import { useAuth } from '../features/auth/AuthContext';
import { authApi } from '../features/auth/auth-api';
import { expertApi, type ExpertProfile } from '../features/expert/expert-api';
import { useNavigate } from '../routing/router';

export const ExpertProfilePage = ({ workspace = false }: { workspace?: boolean }) => {
  const { user, accessToken, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    expertApi
      .profile(accessToken)
      .then(setProfile)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Could not load profile.'),
      )
      .finally(() => setLoading(false));
  }, [accessToken]);

  const status = profile?.approvalStatus ?? user?.expertApprovalStatus ?? 'DRAFT';

  const checkReviewStatus = async () => {
    if (!accessToken) return;
    setCheckingStatus(true);
    setError('');
    try {
      const latest = await expertApi.profile(accessToken);
      setProfile(latest);
      const latestUser = await refreshUser();
      if (
        latest?.approvalStatus === 'APPROVED' ||
        latestUser?.expertApprovalStatus === 'APPROVED'
      ) {
        navigate('/admin', { replace: true });
      } else if (latest?.approvalStatus === 'REJECTED') {
        setNotice('The System Administrator returned your application for revision.');
      } else {
        setNotice('Your application is still under System Administrator review.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not check the review status.');
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!accessToken || status !== 'PENDING') return;
    const interval = window.setInterval(() => void checkReviewStatus(), 15_000);
    return () => window.clearInterval(interval);
  }, [accessToken, status]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    const input: ExpertProfileInput = {
      expertiseField: String(form.get('expertiseField')),
      proficiencyLevel: String(form.get('proficiencyLevel')),
      yearsOfExperience: Number(form.get('yearsOfExperience')),
      employmentStatus: String(form.get('employmentStatus')),
      workplace: String(form.get('workplace')),
      position: String(form.get('position')),
      highestQualification: String(form.get('highestQualification')),
      institution: String(form.get('institution')),
      certifications: String(form.get('certifications')),
      professionalSummary: String(form.get('professionalSummary')),
      evidenceUrl: String(form.get('evidenceUrl')),
    };
    try {
      const saved = await expertApi.saveProfile(accessToken as string, input);
      setProfile(saved);
      await refreshUser();
      setNotice(
        saved.approvalStatus === 'APPROVED'
          ? 'Your professional profile was updated.'
          : 'Your professional profile was submitted for System Administrator review.',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your profile.');
    } finally {
      setSaving(false);
    }
  };

  const profileContent = (
    <>
      <form
        className="account-profile-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setSavingAccount(true);
          setError('');
          try {
            const form = new FormData(event.currentTarget);
            await authApi.updateProfile(accessToken as string, String(form.get('fullName')));
            await refreshUser();
            setNotice('Your account profile was updated.');
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Could not update your account.');
          } finally {
            setSavingAccount(false);
          }
        }}
      >
        <div>
          <span className="eyebrow">Account profile</span>
          <h2>Your identity</h2>
          <p>Update the name shown to Entrepreneurs and System Administrators.</p>
        </div>
        <label>
          Full name
          <input name="fullName" defaultValue={user?.fullName} minLength={2} required />
        </label>
        <label>
          Login contact
          <input value={user?.email ?? user?.phone ?? ''} readOnly aria-readonly="true" />
        </label>
        <button className="primary-action" disabled={savingAccount}>
          {savingAccount ? 'Saving...' : 'Save account profile'}
        </button>
      </form>
      <section className="expert-application-layout">
        <aside className="expert-application-intro">
          <span className="eyebrow eyebrow--light">
            {status === 'APPROVED'
              ? 'Professional profile'
              : status === 'PENDING'
                ? 'Application under review'
                : 'Expert application'}
          </span>
          <h1>
            {status === 'APPROVED'
              ? 'Keep your expertise and experience current.'
              : status === 'PENDING'
                ? 'Your Expert application is now under review.'
                : status === 'REJECTED'
                  ? 'Update your information and submit it again.'
                  : 'Show the experience behind your guidance.'}
          </h1>
          <p>
            {status === 'APPROVED'
              ? 'Entrepreneurs use this information to understand the experience behind your guidance.'
              : status === 'PENDING'
                ? 'A System Administrator has been notified. You can review the information you submitted while you wait for a decision.'
                : 'Provide enough professional evidence for a System Administrator to review your application responsibly.'}
          </p>
          <div className="application-status">
            {status === 'PENDING' ? <Clock3 /> : <FileCheck2 />}
            <div>
              <small>Application status</small>
              <strong>{status.replaceAll('_', ' ')}</strong>
            </div>
          </div>
          {profile?.reviewNote ? (
            <p className="review-note">Review note: {profile.reviewNote}</p>
          ) : null}
        </aside>
        {status === 'PENDING' && profile ? (
          <section className="expert-application-form expert-application-summary">
            <div>
              <span className="auth-card__icon">
                <Clock3 />
              </span>
              <h2>Information submitted for review</h2>
              <p>These are the professional details the System Administrator will review.</p>
            </div>
            <div className="pending-review-banner" role="status">
              <Clock3 aria-hidden="true" />
              <div>
                <strong>Your application is under review</strong>
                <span>
                  Submitted{' '}
                  {profile.submittedAt
                    ? new Date(profile.submittedAt).toLocaleString()
                    : 'recently'}
                  . You will be notified after a decision.
                </span>
              </div>
            </div>
            <dl className="expert-evidence-grid expert-submission-grid">
              <div>
                <dt>Field of expertise</dt>
                <dd>{profile.expertiseField}</dd>
              </div>
              <div>
                <dt>Proficiency</dt>
                <dd>{profile.proficiencyLevel}</dd>
              </div>
              <div>
                <dt>Experience</dt>
                <dd>{profile.yearsOfExperience} years</dd>
              </div>
              <div>
                <dt>Employment status</dt>
                <dd>{profile.employmentStatus}</dd>
              </div>
              <div>
                <dt>Current work</dt>
                <dd>
                  {[profile.position, profile.workplace].filter(Boolean).join(' at ') ||
                    'Not provided'}
                </dd>
              </div>
              <div>
                <dt>Qualification</dt>
                <dd>
                  {profile.highestQualification}, {profile.institution}
                </dd>
              </div>
            </dl>
            <div className="expert-summary">
              <strong>Certifications or memberships</strong>
              <p>{profile.certifications || 'Not provided'}</p>
            </div>
            <div className="expert-summary">
              <strong>Professional summary</strong>
              <p>{profile.professionalSummary}</p>
              {profile.evidenceUrl ? (
                <a href={profile.evidenceUrl} target="_blank" rel="noreferrer">
                  Open supporting evidence
                </a>
              ) : null}
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="form-message" role="status">
                {notice}
              </p>
            ) : null}
            <button
              className="primary-action"
              type="button"
              disabled={checkingStatus}
              onClick={() => void checkReviewStatus()}
            >
              <RefreshCw aria-hidden="true" />
              {checkingStatus ? 'Checking...' : 'Check review status'}
            </button>
          </section>
        ) : (
          <form
            key={profile?.id ?? 'new-application'}
            className="expert-application-form"
            onSubmit={submit}
          >
            <div>
              <span className="auth-card__icon">
                <ShieldCheck />
              </span>
              <h2>Professional information</h2>
              <p>Keep your qualifications, work, and specialist experience accurate.</p>
            </div>
            {loading ? <p>Loading your profile...</p> : null}
            <div className="form-grid">
              <label>
                Field of expertise
                <input name="expertiseField" defaultValue={profile?.expertiseField} required />
              </label>
              <label>
                Proficiency level
                <select
                  name="proficiencyLevel"
                  defaultValue={profile?.proficiencyLevel || 'Advanced'}
                >
                  <option>Intermediate</option>
                  <option>Advanced</option>
                  <option>Expert</option>
                </select>
              </label>
              <label>
                Years of experience
                <input
                  name="yearsOfExperience"
                  type="number"
                  min="0"
                  max="70"
                  defaultValue={profile?.yearsOfExperience ?? 0}
                  required
                />
              </label>
              <label>
                Employment status
                <select
                  name="employmentStatus"
                  defaultValue={profile?.employmentStatus || 'Employed'}
                >
                  <option>Employed</option>
                  <option>Self-employed</option>
                  <option>Independent consultant</option>
                  <option>Not currently employed</option>
                </select>
              </label>
              <label>
                Workplace or organization
                <input name="workplace" defaultValue={profile?.workplace} />
              </label>
              <label>
                Current position
                <input name="position" defaultValue={profile?.position} />
              </label>
              <label>
                Highest qualification
                <input
                  name="highestQualification"
                  defaultValue={profile?.highestQualification}
                  required
                />
              </label>
              <label>
                Awarding institution
                <input name="institution" defaultValue={profile?.institution} required />
              </label>
              <label className="wide">
                Certifications or professional memberships
                <input name="certifications" defaultValue={profile?.certifications} />
              </label>
              <label className="wide">
                Professional summary
                <textarea
                  name="professionalSummary"
                  minLength={50}
                  defaultValue={profile?.professionalSummary}
                  required
                />
                <small>
                  Describe relevant projects, advisory work, achievements, and sector experience.
                </small>
              </label>
              <label className="wide">
                Evidence link
                <input
                  name="evidenceUrl"
                  type="url"
                  defaultValue={profile?.evidenceUrl}
                  placeholder="https://linkedin.com/in/... or portfolio URL"
                />
              </label>
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="form-message" role="status">
                {notice}
              </p>
            ) : null}
            <button className="primary-action" disabled={saving || loading}>
              {saving
                ? 'Saving...'
                : status === 'APPROVED'
                  ? 'Save professional profile'
                  : status === 'REJECTED'
                    ? 'Update and resubmit for review'
                    : 'Submit for review'}
            </button>
          </form>
        )}
      </section>
    </>
  );

  if (workspace) return <AdminWorkspaceShell>{profileContent}</AdminWorkspaceShell>;

  return (
    <main className="expert-application-page">
      <header className="dashboard-header">
        <Brand />
        <div>
          <span>{user?.email ?? user?.phone}</span>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
          >
            <LogOut /> Log out
          </button>
        </div>
      </header>
      {profileContent}
    </main>
  );
};
