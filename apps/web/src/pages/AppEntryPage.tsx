import { Redirect } from '../routing/router';
import { useAuth } from '../features/auth/AuthContext';
import { AppDashboardPage } from './AppDashboardPage';

export const AppEntryPage = () => {
  const { user } = useAuth();
  if (user?.role === 'SYSTEM_ADMIN') return <Redirect to="/admin" />;
  if (user?.role === 'ADMIN')
    return (
      <Redirect to={user.expertApprovalStatus === 'APPROVED' ? '/admin' : '/expert/profile'} />
    );
  return <AppDashboardPage />;
};
