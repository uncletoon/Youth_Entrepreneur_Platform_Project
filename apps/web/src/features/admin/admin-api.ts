import type { UserRole } from '@yersps/contracts';
import { apiRequest, apiRequestWithMeta } from '../auth/auth-api';

export interface AdminOverview {
  entrepreneurs: number;
  businesses: number;
  submitted: number;
  reviewed: number;
  averageScore: number;
}
export interface EntrepreneurRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  entrepreneurProfile: { completionPercent: number } | null;
  businesses: { id: string; name: string; sector: { name: string } | null }[];
  assessmentSessions: {
    id: string;
    status: string;
    result: { overallScore: number; readinessLevel: string } | null;
  }[];
}
export interface AssessmentRow {
  id: string;
  status: string;
  submittedAt: string | null;
  user: { id: string; fullName: string; email: string | null; phone: string | null };
  business: { name: string; sector: { name: string } | null };
  result: { overallScore: number; readinessLevel: string; riskLevel: string } | null;
}
export interface QuestionRow {
  id: string;
  code: string;
  prompt: string;
  helpText: string | null;
  scope: string;
  source: 'SYSTEM_MANDATORY' | 'EXPERT_SUPPLEMENTAL' | 'LEGACY_ARCHIVED';
  createdById: string | null;
  expertiseField: string | null;
  type: string;
  active: boolean;
  required: boolean;
  weight: number;
  stage: string | null;
  displayOrder: number;
  domain: {
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    active: boolean;
    source: 'SYSTEM_MANDATORY' | 'EXPERT_SUPPLEMENTAL' | 'LEGACY_ARCHIVED';
  };
  sector: { id: string; name: string } | null;
  sectors: { sector: { id: string; name: string } }[];
  createdBy: { id: string; fullName: string } | null;
}
export interface SectorRow {
  id: string;
  code: string;
  name: string;
  description: string;
  keywords: string[];
  active: boolean;
}
export interface DomainRow {
  id: string;
  code: string;
  name: string;
  description: string;
  weight: number;
  displayOrder: number;
  active: boolean;
  source: 'SYSTEM_MANDATORY' | 'EXPERT_SUPPLEMENTAL' | 'LEGACY_ARCHIVED';
  createdById: string | null;
  expertiseField: string | null;
  createdBy: { id: string; fullName: string } | null;
  _count: { questions: number };
}
export interface AdminConfiguration {
  sectors: SectorRow[];
  domains: DomainRow[];
}
export interface SystemUserRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  status: 'ACTIVE' | 'DISABLED';
  lastLoginAt: string | null;
  createdAt: string;
  expertProfile: { approvalStatus: string } | null;
}
export interface ExpertApplicationRow {
  id: string;
  expertiseField: string;
  proficiencyLevel: string;
  yearsOfExperience: number;
  employmentStatus: string;
  workplace: string | null;
  position: string | null;
  highestQualification: string;
  institution: string;
  certifications: string | null;
  professionalSummary: string;
  evidenceUrl: string | null;
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    createdAt: string;
  };
  reviewedBy: { fullName: string } | null;
}
export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
  createdAt: string;
  actor: { fullName: string; email: string | null; role: UserRole } | null;
}
export interface ExpertAssignmentRow {
  id: string;
  active: boolean;
  createdAt: string;
  expert: {
    id: string;
    fullName: string;
    email: string | null;
    expertProfile: { expertiseField: string; approvalStatus: string } | null;
  };
  entrepreneur: { id: string; fullName: string; email: string | null; phone: string | null };
  assignedBy: { fullName: string } | null;
}
export interface ExpertAssignmentData {
  assignments: ExpertAssignmentRow[];
  experts: { id: string; fullName: string; email: string | null }[];
  entrepreneurs: { id: string; fullName: string; email: string | null; phone: string | null }[];
}
export interface EntrepreneurDetail {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  entrepreneurProfile: Record<string, string | number | null> | null;
  businesses: {
    id: string;
    name: string;
    description: string;
    problemSolved: string | null;
    productOrService: string;
    targetCustomers: string | null;
    supportingDocumentName: string | null;
    supportingDocumentUrl: string | null;
    location: string | null;
    stage: string;
    revenueModel: string | null;
    estimatedStartupCapital: string | number | null;
    availableCapital: string | number | null;
    teamSize: number;
    registrationStatus: string | null;
    salesChannel: string | null;
    mainRisks: string | null;
    createdAt: string;
    sector: { name: string } | null;
    classifications: { confidence: number; explanation: string; status: string }[];
  }[];
  assessmentSessions: {
    id: string;
    businessId: string;
    status: string;
    submittedAt: string | null;
    result: {
      overallScore: number;
      readinessLevel: string;
      riskLevel: string;
      strengths: string[];
      gaps: string[];
    } | null;
    responses: {
      id: string;
      answer: unknown;
      rawScore: number | null;
      question: { prompt: string; type: string };
    }[];
  }[];
  recommendations: {
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    actionSteps: string[];
    createdAt: string;
    business: { id: string; name: string } | null;
  }[];
  adminFeedbackReceived: {
    id: string;
    message: string;
    createdAt: string;
    admin: { fullName: string };
    business: { id: string; name: string } | null;
    replies: {
      id: string;
      message: string;
      createdAt: string;
      author: { id: string; fullName: string; role: UserRole };
    }[];
  }[];
}

const auth = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { ...init.headers, Authorization: `Bearer ${token}` },
});
const mutation = (token: string, method: string, body: unknown) =>
  auth(token, { method, body: JSON.stringify(body) });

export const adminApi = {
  overview: (token: string) => apiRequest<AdminOverview>('/admin/overview', auth(token)),
  entrepreneurs: (token: string, page = 1) =>
    apiRequestWithMeta<EntrepreneurRow[]>(`/admin/entrepreneurs?page=${page}`, auth(token)),
  entrepreneur: (token: string, userId: string) =>
    apiRequest<EntrepreneurDetail>(`/admin/entrepreneurs/${userId}`, auth(token)),
  assessments: (token: string, page = 1) =>
    apiRequestWithMeta<AssessmentRow[]>(`/admin/assessments?page=${page}`, auth(token)),
  questions: (token: string) => apiRequest<QuestionRow[]>('/admin/questions', auth(token)),
  question: (token: string, questionId: string) =>
    apiRequest<QuestionRow>(`/admin/questions/${questionId}`, auth(token)),
  configuration: (token: string) =>
    apiRequest<AdminConfiguration>('/admin/configuration', auth(token)),
  feedback: (token: string, userId: string, businessId: string, message: string) =>
    apiRequest<unknown>(
      `/admin/entrepreneurs/${userId}/feedback`,
      mutation(token, 'POST', { businessId, message }),
    ),
  replyToFeedback: (token: string, feedbackId: string, message: string) =>
    apiRequest<EntrepreneurDetail['adminFeedbackReceived'][number]['replies'][number]>(
      `/admin/feedback/${feedbackId}/replies`,
      mutation(token, 'POST', { message }),
    ),
  recommendation: (token: string, userId: string, input: unknown) =>
    apiRequest<unknown>(
      `/admin/entrepreneurs/${userId}/recommendations`,
      mutation(token, 'POST', input),
    ),
  review: (token: string, sessionId: string, status: string) =>
    apiRequest<unknown>(
      `/admin/assessments/${sessionId}/status`,
      mutation(token, 'PATCH', { status }),
    ),
  createQuestion: (token: string, input: unknown) =>
    apiRequest<QuestionRow>('/admin/questions', mutation(token, 'POST', input)),
  saveQuestionSet: (token: string, domainId: string, input: unknown) =>
    apiRequest<{
      domainId: string;
      questionCount: number;
      active: boolean;
      questions: QuestionRow[];
    }>(`/admin/domains/${domainId}/question-set`, mutation(token, 'PUT', input)),
  updateQuestion: (token: string, questionId: string, input: unknown) =>
    apiRequest<QuestionRow>(`/admin/questions/${questionId}`, mutation(token, 'PATCH', input)),
  deleteQuestion: (token: string, questionId: string) =>
    apiRequest<{ deleted: boolean; archived: boolean; message: string }>(
      `/admin/questions/${questionId}`,
      auth(token, { method: 'DELETE' }),
    ),
  updateSector: (token: string, sectorId: string, input: unknown) =>
    apiRequest<SectorRow>(`/admin/sectors/${sectorId}`, mutation(token, 'PATCH', input)),
  updateDomain: (token: string, domainId: string, input: unknown) =>
    apiRequest<DomainRow>(`/admin/domains/${domainId}`, mutation(token, 'PATCH', input)),
  createDomain: (token: string, input: unknown) =>
    apiRequest<DomainRow>('/admin/domains', mutation(token, 'POST', input)),
  deleteDomain: (token: string, domainId: string) =>
    apiRequest<{ deleted: boolean }>(
      `/admin/domains/${domainId}`,
      auth(token, { method: 'DELETE' }),
    ),
  users: (token: string, page = 1) =>
    apiRequestWithMeta<SystemUserRow[]>(`/system/users?page=${page}`, auth(token)),
  updateUser: (token: string, userId: string, input: unknown) =>
    apiRequest<SystemUserRow>(`/system/users/${userId}`, mutation(token, 'PATCH', input)),
  audits: (token: string, page = 1) =>
    apiRequestWithMeta<AuditRow[]>(`/system/audit-logs?page=${page}`, auth(token)),
  expertAssignments: (token: string) =>
    apiRequest<ExpertAssignmentData>('/system/expert-assignments', auth(token)),
  createExpertAssignment: (token: string, expertId: string, entrepreneurId: string) =>
    apiRequest<ExpertAssignmentRow>(
      '/system/expert-assignments',
      mutation(token, 'POST', { expertId, entrepreneurId }),
    ),
  removeExpertAssignment: (token: string, assignmentId: string) =>
    apiRequest<void>(
      `/system/expert-assignments/${assignmentId}`,
      auth(token, { method: 'DELETE' }),
    ),
  expertApplications: (token: string, page = 1) =>
    apiRequestWithMeta<ExpertApplicationRow[]>(
      `/system/expert-applications?page=${page}`,
      auth(token),
    ),
  reviewExpert: (
    token: string,
    profileId: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNote: string,
  ) =>
    apiRequest<ExpertApplicationRow>(
      `/system/expert-applications/${profileId}`,
      mutation(token, 'PATCH', { status, reviewNote }),
    ),
  async downloadReport(token: string) {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';
    const response = await fetch(`${base}/admin/reports/assessments.csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Could not export the assessment report.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'yersps-assessments.csv';
    link.click();
    URL.revokeObjectURL(url);
  },
};
