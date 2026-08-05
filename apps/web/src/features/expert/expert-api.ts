import type { ExpertApprovalStatus, ExpertProfileInput } from '@yersps/contracts';
import { apiRequest } from '../auth/auth-api';

export interface ExpertProfile extends ExpertProfileInput {
  id: string;
  approvalStatus: ExpertApprovalStatus;
  reviewNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

const authorized = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { ...init.headers, Authorization: `Bearer ${token}` },
});

export const expertApi = {
  profile: (token: string) =>
    apiRequest<ExpertProfile | null>('/expert/profile', authorized(token)),
  saveProfile: (token: string, input: ExpertProfileInput) =>
    apiRequest<ExpertProfile>(
      '/expert/profile',
      authorized(token, { method: 'PUT', body: JSON.stringify(input) }),
    ),
};
