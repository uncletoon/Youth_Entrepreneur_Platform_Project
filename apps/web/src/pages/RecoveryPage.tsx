import { ArrowLeft, KeyRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from '../routing/router';
import { Brand } from '../components/Brand';
import { authApi } from '../features/auth/auth-api';

export const RecoveryPage = () => {
  const [token, setToken] = useState(new URLSearchParams(location.search).get('token') ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const identifier = String(new FormData(event.currentTarget).get('identifier'));
      const result = await authApi.requestPasswordReset(identifier);
      setMessage(result.message);
      if (result.developmentToken) setToken(result.developmentToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not request a reset.');
    }
  };
  const completeReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      const form = new FormData(event.currentTarget);
      const result = await authApi.resetPassword(
        String(form.get('token')),
        String(form.get('password')),
      );
      setMessage(`${result.message} You can now log in.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not reset the password.');
    }
  };
  return (
    <main className="auth-page">
      <aside className="auth-page__aside">
        <Brand />
        <div>
          <span className="eyebrow">Secure account recovery</span>
          <h1>Regain access without exposing your account.</h1>
          <p>
            Reset tokens expire after 30 minutes and existing sessions are revoked after a
            successful password change.
          </p>
        </div>
      </aside>
      <section className="auth-page__main">
        <div className="auth-card">
          <Link className="back-link" to="/login">
            <ArrowLeft /> Back to login
          </Link>
          <div className="auth-card__icon">
            <KeyRound />
          </div>
          <h2>Reset your password</h2>
          <p>First request a reset token, then choose a new password.</p>
          <form onSubmit={requestReset}>
            <label>
              Email or telephone
              <input name="identifier" required />
            </label>
            <button className="button button--full">Request reset</button>
          </form>
          <hr />
          <form onSubmit={completeReset}>
            <label>
              Reset token
              <input
                name="token"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                required
              />
            </label>
            <label>
              New password
              <input name="password" type="password" minLength={8} required />
            </label>
            <button className="button button--full">Set new password</button>
          </form>
          {error ? <div className="form-message form-message--error">{error}</div> : null}
          {message ? <div className="form-message">{message}</div> : null}
        </div>
      </section>
    </main>
  );
};
