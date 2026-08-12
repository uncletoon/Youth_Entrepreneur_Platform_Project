import { loginSchema, registerSchema } from '@yersps/contracts';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  Lightbulb,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from '../routing/router';
import { Brand } from '../components/Brand';
import { ApiRequestError } from '../features/auth/auth-api';
import { useAuth } from '../features/auth/AuthContext';

export const AuthPage = ({ mode }: { mode: 'login' | 'register' }) => {
  const isRegister = mode === 'register';
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage('');
    setIsError(false);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const input = isRegister ? { ...values, consent: values.consent === 'on' } : values;
    const result = (isRegister ? registerSchema : loginSchema).safeParse(input);
    if (!result.success) {
      setIsError(true);
      setMessage(result.error.issues[0]?.message ?? 'Check the form.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await auth.register(registerSchema.parse(input));
        navigate('/app', { replace: true });
      } else {
        await auth.login(loginSchema.parse(input));
        navigate('/app', { replace: true });
      }
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof ApiRequestError
          ? error.message
          : 'Unable to reach YERSPS. Check that the API is running.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-page__aside">
        <Brand light />
        <div>
          <span className="eyebrow eyebrow--light">A clear place to begin</span>
          <h1>
            {isRegister
              ? 'Build your readiness profile, one step at a time.'
              : 'Welcome back to your readiness journey.'}
          </h1>
          <ul>
            <li>
              <CheckCircle2 /> Simple account registration
            </li>
            <li>
              <CheckCircle2 /> Save and continue later
            </li>
            <li>
              <ShieldCheck /> Private, role-based access
            </li>
          </ul>
        </div>
        <p>YERSPS never presents readiness as a guarantee of business success.</p>
      </section>
      <section className="auth-page__main">
        <div className="auth-card">
          <Link className="back-link" to="/">
            <ArrowLeft /> Back to home
          </Link>
          <span className="auth-card__icon">
            <LockKeyhole />
          </span>
          <h2>{isRegister ? 'Create your account' : 'Log in to YERSPS'}</h2>
          <p>
            {isRegister
              ? 'Only the essentials now. Your full profile comes next.'
              : 'Continue your assessment or review your progress.'}
          </p>
          <form onSubmit={submit} noValidate>
            {isRegister && (
              <>
                <fieldset className="role-picker">
                  <legend>I am joining as</legend>
                  <label>
                    <input type="radio" name="role" value="ENTREPRENEUR" defaultChecked />
                    <span>
                      <Lightbulb />
                      <strong>Entrepreneur</strong>
                      <small>Build and assess one or more business ideas.</small>
                    </span>
                  </label>
                  <label>
                    <input type="radio" name="role" value="EXPERT" />
                    <span>
                      <BriefcaseBusiness />
                      <strong>Expert</strong>
                      <small>Apply to review entrepreneurs and provide guidance.</small>
                    </span>
                  </label>
                </fieldset>
                <label>
                  Full name
                  <input name="fullName" autoComplete="name" placeholder="Your full name" />
                </label>
              </>
            )}
            <label>
              Email or telephone
              <input name="identifier" autoComplete="username" placeholder="you@example.com" />
            </label>
            <label>
              Password
              <span className="input-with-icon">
                <input
                  name="password"
                  type="password"
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  placeholder="Your password"
                />
                <Eye aria-hidden="true" />
              </span>
            </label>
            {isRegister && (
              <label>
                Confirm password
                <input
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                />
              </label>
            )}
            {isRegister ? (
              <label className="check-label">
                <input name="consent" type="checkbox" />{' '}
                <span>
                  I agree to the privacy notice and consent to the use of my information for
                  readiness assessment.
                </span>
              </label>
            ) : (
              <Link className="forgot-link" to="/forgot-password">
                Forgot password?
              </Link>
            )}
            {message && (
              <div className={`form-message ${isError ? 'form-message--error' : ''}`} role="alert">
                {message}
              </div>
            )}
            <button className="button button--full" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}{' '}
              <ArrowRight />
            </button>
          </form>
          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : 'New to YERSPS?'}{' '}
            <Link to={isRegister ? '/login' : '/register'}>
              {isRegister ? 'Log in' : 'Create an account'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
};
