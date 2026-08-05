import type { ReactNode } from 'react';
import {
  BarChart3,
  Home,
  Lightbulb,
  LogOut,
  MessageSquareText,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate, useRouter } from '../routing/router';
import { useAuth } from '../features/auth/AuthContext';
import { Brand } from './Brand';

const workspaceLinks: { to: string; label: string; Icon: LucideIcon }[] = [
  { to: '/app', label: 'Dashboard', Icon: Home },
  { to: '/app/profile', label: 'Profile', Icon: UserRound },
  { to: '/app/innovations', label: 'Innovations', Icon: Lightbulb },
  { to: '/app/assignments', label: 'Assessments', Icon: BarChart3 },
  { to: '/app/feedback', label: 'Expert feedback', Icon: MessageSquareText },
  { to: '/app/recommendations', label: 'Recommendations', Icon: Sparkles },
];

export const AppShell = ({ title, children }: { title?: string; children: ReactNode }) => {
  const navigate = useNavigate();
  const { path } = useRouter();
  const { user, logout } = useAuth();

  const isActive = (to: string) =>
    to === '/app' ? path === to : path === to || path.startsWith(`${to}/`);

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Brand />
        <div>
          <span className="workspace-user-badge">{user?.fullName ?? user?.email ?? user?.phone}</span>
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
      <nav className="workspace-nav" aria-label="Entrepreneur workspace">
        {workspaceLinks.map(({ to, label, Icon }) => (
          <Link key={to} to={to} className={isActive(to) ? 'active' : ''}>
            <Icon /> {label}
          </Link>
        ))}
      </nav>
      {title ? (
        <section className="workflow-heading">
          <h1>{title}</h1>
        </section>
      ) : null}
      {children}
    </main>
  );
};
