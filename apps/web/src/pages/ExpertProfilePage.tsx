import type { ExpertProfileInput } from '@yersps/contracts';
import { Clock3, FileCheck2, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Brand } from '../components/Brand';
import { useAuth } from '../features/auth/AuthContext';
import { expertApi, type ExpertProfile } from '../features/expert/expert-api';
import { Redirect, useNavigate } from '../routing/router';

export const ExpertProfilePage = () => {
  const { user, accessToken, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      setNotice('Your professional profile was submitted for System Administrator review.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not submit your profile.');
    } finally {
      setSaving(false);
    }
  };

  const status = profile?.approvalStatus ?? user?.expertApprovalStatus ?? 'DRAFT';
  if (status === 'APPROVED') return <Redirect to="/admin" />;

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
      <section className="expert-application-layout">
        <aside className="expert-application-intro">
          <span className="eyebrow eyebrow--light">Admin verification</span>
          <h1>Show the experience behind your guidance.</h1>
          <p>
            Admin access protects entrepreneur information. Provide enough professional evidence
            for a System Administrator to review your application responsibly.
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
        <form
          key={profile?.id ?? 'new-application'}
          className="expert-application-form"
          onSubmit={submit}
        >
          <div>
            <span className="auth-card__icon">
              <ShieldCheck />
            </span>
            <h2>Professional profile</h2>
            <p>
              All required information is reviewed before entrepreneur records become available.
            </p>
          </div>
          {loading ? <p>Loading your application...</p> : null}
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
          {error ? <p className="form-error">{error}</p> : null}
          {notice ? <p className="form-message">{notice}</p> : null}
          <button className="primary-action" disabled={saving || loading}>
            {saving
              ? 'Submitting...'
              : status === 'PENDING'
                ? 'Update and resubmit'
                : 'Submit for review'}
          </button>
        </form>
      </section>
    </main>
  );
};
