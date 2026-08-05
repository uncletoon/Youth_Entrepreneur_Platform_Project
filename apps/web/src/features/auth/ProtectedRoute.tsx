import type { UserRole } from '@yersps/contracts';
import type { ReactNode } from 'react';
import { Redirect } from '../../routing/router';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: UserRole[];
}) => {
  const { user, initializing } = useAuth();

  if (initializing) return <div className="app-loading">Restoring your secure session…</div>;
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to="/app" />;
  return children;
};
