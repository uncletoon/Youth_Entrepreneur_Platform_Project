import { useState, type FormEvent } from 'react';
import { AppShell } from '../components/AppShell';
import { authApi } from '../features/auth/auth-api';
import { useAuth } from '../features/auth/AuthContext';

export const VerificationPage = () => {
  const { accessToken } = useAuth();
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const request = async () => {
    try {
      const result = await authApi.requestVerification(accessToken as string);
      setMessage(result.message);
      if (result.developmentToken) setToken(result.developmentToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not request verification.');
    }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const result = await authApi.verifyContact(token);
      setMessage(result.message);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not verify contact.');
    }
  };
  return (
    <AppShell title="Verify your contact">
      <form className="workflow-card workflow-form verification-form" onSubmit={verify}>
        <p>
          Verification confirms that you control the email address or telephone number attached to
          the account.
        </p>
        <button type="button" onClick={() => void request()}>
          Request verification token
        </button>
        <label>
          Verification token
          <input value={token} onChange={(event) => setToken(event.target.value)} required />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-message">{message}</p> : null}
        <button className="primary-action">Verify contact</button>
      </form>
    </AppShell>
  );
};
