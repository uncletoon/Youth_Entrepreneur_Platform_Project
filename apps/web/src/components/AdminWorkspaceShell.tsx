import {
  BarChart3,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { Link, Redirect, useNavigate, useRouter } from '../routing/router';
import { Brand } from './Brand';

const expertLinks: { to: string; label: string; Icon: typeof LayoutDashboard }[] = [
  { to: '/admin', label: 'Overview', Icon: LayoutDashboard },
  { to: '/admin/entrepreneurs', label: 'Entrepreneurs', Icon: Users },
  { to: '/admin/reviews', label: 'Assessment Reviews', Icon: ClipboardList },
  { to: '/admin/questions', label: 'Question Bank', Icon: FileText },
  { to: '/admin/configuration', label: 'Configuration', Icon: Settings },
];

const systemLinks: { to: string; label: string; Icon: typeof LayoutDashboard }[] = [
  { to: '/admin/applications', label: 'Expert Applications', Icon: ShieldCheck },
  { to: '/admin/users', label: 'Users & Roles', Icon: Users },
  { to: '/admin/audits', label: 'Audit Logs', Icon: BarChart3 },
];

export const AdminWorkspaceShell = ({ children }: { children: ReactNode }) => {
  const { user, logout } = useAuth();
  const { path } = useRouter();
  const navigate = useNavigate();
  const isSystem = user?.role === 'SYSTEM_ADMIN';
  if (!isSystem && user?.expertApprovalStatus !== 'APPROVED')
    return <Redirect to="/expert/profile" />;

  const isActive = (to: string) =>
    to === '/admin' ? path === to : path === to || path.startsWith(`${to}/`);

  return (
    <main className="admin-page">
      <header className="dashboard-header admin-dashboard-header">
        <Brand />
        <div className="admin-header-right">
          <div className="admin-header-badge">
            <ShieldCheck />
            <span>{isSystem ? 'System Administrator' : 'Approved Expert'}</span>
          </div>
          <button
            type="button"
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
        <aside className="admin-nav">
          <div className="admin-nav__brand">
            <h2>Expert workspace</h2>
            <small>{user?.fullName ?? user?.email}</small>
          </div>
          <nav className="admin-nav__links">
            {expertLinks.map(({ to, label, Icon }) => (
              <Link key={to} to={to} className={`admin-nav__link ${isActive(to) ? 'active' : ''}`}>
                <Icon />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          {isSystem ? (
            <>
              <div className="admin-nav__section-label">System</div>
              <nav className="admin-nav__links">
                {systemLinks.map(({ to, label, Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`admin-nav__link ${isActive(to) ? 'active' : ''}`}
                  >
                    <Icon />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            </>
          ) : null}
        </aside>
        <section className="admin-main">{children}</section>
      </div>
    </main>
  );
};
