import type { BusinessProfileInput, EntrepreneurProfileInput } from '@yersps/contracts';
import { apiRequest } from '../auth/auth-api';

export interface SectorSummary {
  id: string;
  name: string;
}
interface AssessmentQuestion {
  id: string;
  prompt: string;
  helpText?: string;
  source: 'SYSTEM_MANDATORY' | 'EXPERT_SUPPLEMENTAL';
  domain: { name: string };
  sector: { name: string } | null;
  createdBy: { fullName: string } | null;
}
export interface AssessmentPayload {
  session: { id: string };
  questions: AssessmentQuestion[];
  responses: { questionId: string; answer: number }[];
}
interface DomainScore {
  code: string;
  name: string;
  score: number;
  weight: number;
}
interface SupplementalScore {
  name: string;
  sector: string;
  score: number;
  questionCount: number;
}
export interface ReadinessResultPayload {
  result: {
    overallScore: number;
    readinessLevel: string;
    riskLevel: string;
    domainScores: DomainScore[];
    supplementalScores: SupplementalScore[];
    strengths: string[];
    disclaimer: string;
  };
  recommendations: { id: string; title: string; description: string }[];
}
export interface EntrepreneurOverview {
  profile: { completionPercent: number } | null;
  business: { id: string; name: string; sector: { name: string } | null } | null;
  latestSession: {
    id: string;
    status: string;
    result: { overallScore: number; readinessLevel: string; riskLevel: string } | null;
  } | null;
  recommendations: { id: string; title: string; description: string; status: string }[];
  feedback: { id: string; message: string; createdAt: string; admin: { fullName: string } }[];
}
export interface BusinessSummary {
  id: string;
  name: string;
  description: string;
  productOrService: string;
  problemSolved: string | null;
  targetCustomers: string | null;
  location: string | null;
  stage: string;
  revenueModel: string | null;
  estimatedStartupCapital: string | number | null;
  availableCapital: string | number | null;
  teamSize: number;
  registrationStatus: string | null;
  salesChannel: string | null;
  mainRisks: string | null;
  supportingDocumentName: string | null;
  supportingDocumentUrl: string | null;
  createdAt: string;
  sector: { id?: string; name: string } | null;
  classifications: {
    id: string;
    confidence: number;
    explanation: string;
    status: 'SUGGESTED' | 'CONFIRMED' | 'DISPUTED' | 'ADMIN_CORRECTED';
    correctionReason: string | null;
  }[];
  assessmentSessions: {
    id: string;
    status: string;
    result: { overallScore: number; readinessLevel: string } | null;
  }[];
}
export interface AssessmentSummary {
  id: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  business: { id: string; name: string; sector: { name: string } | null };
  result: { overallScore: number; readinessLevel: string; riskLevel: string } | null;
}
export interface FeedbackItem {
  id: string;
  message: string;
  createdAt: string;
  admin: { fullName: string; expertProfile: { expertiseField: string } | null };
  business: { id: string; name: string } | null;
  replies: {
    id: string;
    message: string;
    createdAt: string;
    author: { id: string; fullName: string; role: string };
  }[];
}
export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  actionSteps: string[];
  createdAt: string;
}

const authorized = (accessToken: string, init: RequestInit = {}) => ({
  ...init,
  headers: { ...init.headers, Authorization: `Bearer ${accessToken}` },
});

export const entrepreneurApi = {
  overview: (token: string) =>
    apiRequest<EntrepreneurOverview>('/entrepreneur/overview', authorized(token)),
  sectors: (token: string) =>
    apiRequest<SectorSummary[]>('/entrepreneur/sectors', authorized(token)),
  profile: (token: string) =>
    apiRequest<Partial<EntrepreneurProfileInput> | null>(
      '/entrepreneur/profile',
      authorized(token),
    ),
  saveProfile: (token: string, input: EntrepreneurProfileInput) =>
    apiRequest<unknown>(
      '/entrepreneur/profile',
      authorized(token, { method: 'PUT', body: JSON.stringify(input) }),
    ),
  saveBusiness: (token: string, input: BusinessProfileInput) =>
    apiRequest<unknown>(
      '/entrepreneur/business',
      authorized(token, { method: 'POST', body: JSON.stringify(input) }),
    ),
  updateBusiness: (token: string, businessId: string, input: BusinessProfileInput) =>
    apiRequest<BusinessSummary>(
      `/entrepreneur/business/${businessId}`,
      authorized(token, { method: 'PATCH', body: JSON.stringify(input) }),
    ),
  archiveBusiness: (token: string, businessId: string) =>
    apiRequest<void>(
      `/entrepreneur/business/${businessId}`,
      authorized(token, { method: 'DELETE' }),
    ),
  decideClassification: (
    token: string,
    businessId: string,
    status: 'CONFIRMED' | 'DISPUTED',
    reason?: string,
  ) =>
    apiRequest<unknown>(
      `/entrepreneur/business/${businessId}/classification`,
      authorized(token, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
    ),
  businesses: (token: string) =>
    apiRequest<BusinessSummary[]>('/entrepreneur/businesses', authorized(token)),
  startAssessment: (token: string, businessId?: string) =>
    apiRequest<AssessmentPayload>(
      '/entrepreneur/assessment/start',
      authorized(token, { method: 'POST', body: JSON.stringify({ businessId }) }),
    ),
  assessments: (token: string) =>
    apiRequest<AssessmentSummary[]>('/entrepreneur/assessments', authorized(token)),
  feedback: (token: string) =>
    apiRequest<FeedbackItem[]>('/entrepreneur/feedback', authorized(token)),
  replyToFeedback: (token: string, feedbackId: string, message: string) =>
    apiRequest<FeedbackItem['replies'][number]>(
      `/entrepreneur/feedback/${feedbackId}/replies`,
      authorized(token, { method: 'POST', body: JSON.stringify({ message }) }),
    ),
  recommendations: (token: string) =>
    apiRequest<RecommendationItem[]>('/entrepreneur/recommendations', authorized(token)),
  updateRecommendationStatus: (token: string, recommendationId: string, status: string) =>
    apiRequest<RecommendationItem>(
      `/entrepreneur/recommendations/${recommendationId}`,
      authorized(token, { method: 'PATCH', body: JSON.stringify({ status }) }),
    ),
  saveResponses: (
    token: string,
    sessionId: string,
    responses: { questionId: string; value: number }[],
  ) =>
    apiRequest<{ saved: number }>(
      `/entrepreneur/assessment/${sessionId}/responses`,
      authorized(token, { method: 'PUT', body: JSON.stringify({ responses }) }),
    ),
  submitAssessment: (token: string, sessionId: string) =>
    apiRequest<unknown>(
      `/entrepreneur/assessment/${sessionId}/submit`,
      authorized(token, { method: 'POST' }),
    ),
  result: (token: string, sessionId: string) =>
    apiRequest<ReadinessResultPayload>(
      `/entrepreneur/assessment/${sessionId}/result`,
      authorized(token),
    ),
};
