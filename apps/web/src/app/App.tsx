import { lazy, Suspense, type ReactNode } from 'react';
import { ProtectedRoute } from '../features/auth/ProtectedRoute';
import { useRouter } from '../routing/router';

const HomePage = lazy(() =>
  import('../pages/HomePage').then((module) => ({ default: module.HomePage })),
);
const AuthPage = lazy(() =>
  import('../pages/AuthPage').then((module) => ({ default: module.AuthPage })),
);
const AppEntryPage = lazy(() =>
  import('../pages/AppEntryPage').then((module) => ({ default: module.AppEntryPage })),
);
const AdminDashboardPage = lazy(() =>
  import('../pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminEntrepreneurDetailPage = lazy(() =>
  import('../pages/AdminEntrepreneurDetailPage').then((module) => ({
    default: module.AdminEntrepreneurDetailPage,
  })),
);
const AdminQuestionFormPage = lazy(() =>
  import('../pages/AdminQuestionFormPage').then((module) => ({
    default: module.AdminQuestionFormPage,
  })),
);
const ProfilePage = lazy(() =>
  import('../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const BusinessPage = lazy(() =>
  import('../pages/BusinessPage').then((module) => ({ default: module.BusinessPage })),
);
const AssessmentPage = lazy(() =>
  import('../pages/AssessmentPage').then((module) => ({ default: module.AssessmentPage })),
);
const ResultPage = lazy(() =>
  import('../pages/ResultPage').then((module) => ({ default: module.ResultPage })),
);
const RecoveryPage = lazy(() =>
  import('../pages/RecoveryPage').then((module) => ({ default: module.RecoveryPage })),
);
const ExpertProfilePage = lazy(() =>
  import('../pages/ExpertProfilePage').then((module) => ({ default: module.ExpertProfilePage })),
);
const WorkspaceProfilePage = lazy(() =>
  import('../pages/WorkspaceProfilePage').then((module) => ({
    default: module.WorkspaceProfilePage,
  })),
);
const FeedbackPage = lazy(() =>
  import('../pages/FeedbackPage').then((module) => ({ default: module.FeedbackPage })),
);
const RecommendationsPage = lazy(() =>
  import('../pages/RecommendationsPage').then((module) => ({
    default: module.RecommendationsPage,
  })),
);
const AssignmentsPage = lazy(() =>
  import('../pages/AssignmentsPage').then((module) => ({ default: module.AssignmentsPage })),
);

const protectedPage = (page: ReactNode) => <ProtectedRoute>{page}</ProtectedRoute>;
const adminPage = (page: ReactNode) => (
  <ProtectedRoute roles={['EXPERT', 'SYSTEM_ADMIN']}>{page}</ProtectedRoute>
);
const systemPage = (page: ReactNode) => (
  <ProtectedRoute roles={['SYSTEM_ADMIN']}>{page}</ProtectedRoute>
);

export const App = () => {
  const { path } = useRouter();
  let page: ReactNode = <HomePage />;

  // Public routes
  if (path === '/login') page = <AuthPage mode="login" />;
  else if (path === '/register') page = <AuthPage mode="register" />;
  else if (path === '/forgot-password') page = <RecoveryPage />;

  // Entrepreneur workspace routes
  else if (path === '/app') page = protectedPage(<AppEntryPage />);
  else if (path === '/app/onboarding/profile') page = protectedPage(<ProfilePage />);
  else if (path === '/app/onboarding/business') page = protectedPage(<BusinessPage />);
  else if (path === '/app/profile') page = protectedPage(<ProfilePage />);
  else if (path === '/app/innovations') page = protectedPage(<BusinessPage />);
  else if (path === '/app/assignments') page = protectedPage(<AssignmentsPage />);
  else if (path === '/app/feedback') page = protectedPage(<FeedbackPage />);
  else if (path === '/app/recommendations') page = protectedPage(<RecommendationsPage />);
  else if (path === '/app/assessment') page = protectedPage(<AssessmentPage />);
  // Expert/Admin routes
  else if (path === '/expert/profile')
    page = (
      <ProtectedRoute roles={['EXPERT']}>
        <ExpertProfilePage />
      </ProtectedRoute>
    );
  else if (path === '/admin') page = adminPage(<AdminDashboardPage section="overview" />);
  else if (path === '/admin/entrepreneurs')
    page = adminPage(<AdminDashboardPage section="entrepreneurs" />);
  else if (path === '/admin/reviews') page = adminPage(<AdminDashboardPage section="reviews" />);
  else if (path === '/admin/profile') page = adminPage(<WorkspaceProfilePage />);
  else if (path === '/admin/questions')
    page = adminPage(<AdminDashboardPage section="questions" />);
  else if (path === '/admin/questions/new') page = adminPage(<AdminQuestionFormPage />);
  else if (path === '/admin/configuration')
    page = systemPage(<AdminDashboardPage section="configuration" />);
  else if (path === '/admin/applications')
    page = systemPage(<AdminDashboardPage section="applications" />);
  else if (path === '/admin/assignments')
    page = systemPage(<AdminDashboardPage section="assignments" />);
  else if (path === '/admin/users') page = systemPage(<AdminDashboardPage section="users" />);
  else if (path === '/admin/audits') page = systemPage(<AdminDashboardPage section="audits" />);
  else {
    // Dynamic routes
    const resultMatch = path.match(/^\/app\/results\/([0-9a-f-]+)$/i);
    const sessionId = resultMatch?.[1];
    if (sessionId) page = protectedPage(<ResultPage sessionId={sessionId} />);

    const entrepreneurMatch = path.match(/^\/admin\/entrepreneurs\/([0-9a-f-]+)$/i);
    const entrepreneurId = entrepreneurMatch?.[1];
    if (entrepreneurId) page = adminPage(<AdminEntrepreneurDetailPage userId={entrepreneurId} />);

    const editQuestionMatch = path.match(/^\/admin\/questions\/([0-9a-f-]+)\/edit$/i);
    const editQuestionId = editQuestionMatch?.[1];
    if (editQuestionId) page = adminPage(<AdminQuestionFormPage questionId={editQuestionId} />);
  }

  return <Suspense fallback={<div className="app-loading">Loading YERSPS…</div>}>{page}</Suspense>;
};
