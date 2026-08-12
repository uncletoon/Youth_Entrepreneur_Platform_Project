import type { EntrepreneurProfileInput } from '@yersps/contracts';
import {
  CheckCircle2,
  Download,
  GraduationCap,
  MapPin,
  Smartphone,
  ShieldOff,
  User,
  Wrench,
} from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { authApi } from '../features/auth/auth-api';
import { entrepreneurApi } from '../features/entrepreneur/entrepreneur-api';
import { useNavigate } from '../routing/router';

interface FieldConfig {
  key: keyof EntrepreneurProfileInput;
  label: string;
  type?: 'select';
  options?: string[];
  placeholder?: string;
}

const AGE_GROUPS = ['Under 18', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];
const EDUCATION_LEVELS = [
  'No formal education',
  'Primary education',
  'Secondary education',
  'Vocational / technical',
  "Bachelor's degree",
  "Master's degree",
  'Doctorate (PhD)',
  'Professional certification',
];
const EMPLOYMENT_STATUSES = [
  'Employed (full-time)',
  'Employed (part-time)',
  'Self-employed',
  'Student',
  'Unemployed',
  'Retired',
];
const EXPERIENCE_LEVELS = [
  'None – first time',
  'Some experience (1-2 ventures)',
  'Moderate experience (3-5 ventures)',
  'Extensive experience (5+ ventures)',
];
const DIGITAL_ACCESS_OPTIONS = [
  'None',
  'Basic (feature phone)',
  'Smartphone only',
  'Smartphone + computer',
  'Reliable broadband',
];
const LANGUAGES = ['Kinyarwanda', 'English', 'French', 'Swahili', 'Other'];

const PROVINCES = [
  'Kigali City',
  'Eastern Province',
  'Northern Province',
  'Southern Province',
  'Western Province',
];

const FIELDS: FieldConfig[] = [
  { key: 'ageGroup', label: 'Age group', type: 'select', options: AGE_GROUPS },
  { key: 'gender', label: 'Gender', type: 'select', options: GENDERS },
  { key: 'province', label: 'Province', type: 'select', options: PROVINCES },
  { key: 'district', label: 'District', placeholder: 'e.g. Gasabo, Musanze…' },
  { key: 'sectorLocation', label: 'Sector / locality', placeholder: 'e.g. Kimironko, Musanze…' },
  {
    key: 'educationLevel',
    label: 'Highest education level',
    type: 'select',
    options: EDUCATION_LEVELS,
  },
  {
    key: 'employmentStatus',
    label: 'Current employment status',
    type: 'select',
    options: EMPLOYMENT_STATUSES,
  },
  {
    key: 'entrepreneurshipExperience',
    label: 'Entrepreneurship experience',
    type: 'select',
    options: EXPERIENCE_LEVELS,
  },
  {
    key: 'previousBusinessExperience',
    label: 'Previous business experience',
    placeholder: 'Describe any previous ventures or business roles',
  },
  {
    key: 'relevantTraining',
    label: 'Relevant training or courses',
    placeholder: 'e.g. business management, digital marketing…',
  },
  {
    key: 'digitalAccess',
    label: 'Digital access',
    type: 'select',
    options: DIGITAL_ACCESS_OPTIONS,
  },
  {
    key: 'preferredLanguage',
    label: 'Preferred language',
    type: 'select',
    options: LANGUAGES,
  },
];

const SECTION_GROUPS: {
  label: string;
  icon: typeof User;
  keys: (keyof EntrepreneurProfileInput)[];
}[] = [
  {
    label: 'Personal information',
    icon: User,
    keys: ['ageGroup', 'gender', 'preferredLanguage'],
  },
  {
    label: 'Location',
    icon: MapPin,
    keys: ['province', 'district', 'sectorLocation'],
  },
  {
    label: 'Education & employment',
    icon: GraduationCap,
    keys: ['educationLevel', 'employmentStatus'],
  },
  {
    label: 'Business background',
    icon: Wrench,
    keys: ['entrepreneurshipExperience', 'previousBusinessExperience', 'relevantTraining'],
  },
  {
    label: 'Digital access & language',
    icon: Smartphone,
    keys: ['digitalAccess'],
  },
];

export const ProfilePage = () => {
  const { accessToken, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState<Partial<EntrepreneurProfileInput> | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (accessToken)
      entrepreneurApi
        .profile(accessToken)
        .then((p) => {
          setProfile(p);
        })
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
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as EntrepreneurProfileInput;
    try {
      await entrepreneurApi.saveProfile(accessToken as string, values);
      await refreshUser();
      setProfile(values);
      setNotice('Your personal profile has been saved successfully.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  const filledCount = profile
    ? FIELDS.filter((f) => profile[f.key] && String(profile[f.key]).trim()).length
    : 0;
  const completionPercent = Math.round((filledCount / FIELDS.length) * 100);

  return (
    <AppShell title="Personal profile">
      <div className="profile-page-intro">
        <div className="profile-completion-ring">
          <div
            className="profile-completion-fill"
            style={{ '--pct': `${completionPercent}%` } as React.CSSProperties}
          >
            <span>{completionPercent}%</span>
          </div>
          <small>Profile complete</small>
        </div>
        <div>
          <p className="profile-intro-text">
            Keep your personal, location, education, and background information current. This helps
            YERSPS provide more relevant assessments and guidance.
          </p>
          {profile && (
            <span className="profile-status-badge">
              <CheckCircle2 />
              {filledCount} of {FIELDS.length} fields completed
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="workflow-card profile-loading-state">
          <div className="assessment-loading-spinner" />
          <p>Loading your profile…</p>
        </div>
      ) : (
        <form
          key={profile ? 'loaded' : 'empty'}
          className="workflow-card workflow-form profile-form"
          onSubmit={submit}
        >
          {SECTION_GROUPS.map(({ label, icon: Icon, keys }) => {
            const sectionFields = FIELDS.filter((f) => keys.includes(f.key));
            return (
              <section key={label} className="profile-section">
                <h3 className="profile-section-heading">
                  <span className="profile-section-icon">
                    <Icon />
                  </span>
                  {label}
                </h3>
                <div className="form-grid">
                  {sectionFields.map((field) =>
                    field.type === 'select' ? (
                      <label key={field.key}>
                        {field.label}
                        <select name={field.key} defaultValue={profile?.[field.key] ?? ''}>
                          <option value="" disabled>
                            Select…
                          </option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <label key={field.key}>
                        {field.label}
                        <input
                          name={field.key}
                          defaultValue={profile?.[field.key] ?? ''}
                          placeholder={field.placeholder}
                          required
                        />
                      </label>
                    ),
                  )}
                </div>
              </section>
            );
          })}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="form-message">{notice}</p> : null}
          <button className="primary-action" disabled={saving}>
            {saving ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}
      <section className="workflow-card privacy-controls">
        <div>
          <span className="eyebrow">Privacy and account</span>
          <h2>Control your YERSPS data</h2>
          <p>Download a portable copy of your records or deactivate access to your account.</p>
        </div>
        <button type="button" onClick={() => void authApi.exportAccount(accessToken as string)}>
          <Download aria-hidden="true" /> Download my data
        </button>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const password = String(form.get('password'));
            if (!window.confirm('Deactivate your account and end all active sessions?')) return;
            await authApi.deactivateAccount(accessToken as string, password);
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <label>
            Password confirmation
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button type="submit" className="danger-button">
            <ShieldOff aria-hidden="true" /> Deactivate account
          </button>
        </form>
      </section>
    </AppShell>
  );
};
