import { Save, ShieldCheck, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { AdminWorkspaceShell } from '../components/AdminWorkspaceShell';
import { useAuth } from '../features/auth/AuthContext';
import { authApi } from '../features/auth/auth-api';
import { ExpertProfilePage } from './ExpertProfilePage';

export const WorkspaceProfilePage = () => {
  const { user, accessToken, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (user?.role === 'EXPERT') return <ExpertProfilePage workspace />;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const form = new FormData(event.currentTarget);
      await authApi.updateProfile(accessToken as string, String(form.get('fullName')));
      await refreshUser();
      setNotice('Your System Administrator profile was updated.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminWorkspaceShell>
      <section className="workspace-profile-heading">
        <span className="workspace-profile-heading__icon" aria-hidden="true">
          <UserRound />
        </span>
        <div>
          <span className="eyebrow">System Administrator profile</span>
          <h1>Manage your account information</h1>
          <p>Keep the name shown in reviews, assignments, and audit records accurate.</p>
        </div>
      </section>
      <form className="admin-panel workspace-profile-form" onSubmit={submit}>
        <div className="workspace-profile-summary">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>System Administrator</strong>
            <span>Platform-wide operational access</span>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Full name
            <input name="fullName" defaultValue={user?.fullName} minLength={2} required />
          </label>
          <label>
            Login contact
            <input value={user?.email ?? user?.phone ?? ''} readOnly aria-readonly="true" />
            <small>Contact changes require a verified account-recovery process.</small>
          </label>
          <label>
            Account status
            <input value={user?.status.replaceAll('_', ' ') ?? ''} readOnly aria-readonly="true" />
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
        <button className="primary-action" disabled={saving}>
          <Save aria-hidden="true" /> {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </AdminWorkspaceShell>
  );
};
