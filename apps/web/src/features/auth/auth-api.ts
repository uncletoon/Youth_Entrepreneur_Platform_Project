import type {
  ApiResponse,
  AuthPayload,
  AuthUser,
  LoginInput,
  RegisterInput,
} from '@yersps/contracts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export const apiRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });

  if (response.status === 204) return undefined as T;
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !result.success) {
    const error = result.success ? undefined : result.error;
    throw new ApiRequestError(
      error?.message ?? 'The request failed.',
      error?.code ?? 'REQUEST_FAILED',
      response.status,
    );
  }
  return result.data;
};

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const apiRequestWithMeta = async <T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; meta: PaginationMeta }> => {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  const result = (await response.json()) as ApiResponse<T> & { meta?: PaginationMeta };
  if (!response.ok || !result.success) {
    const error = result.success ? undefined : result.error;
    throw new ApiRequestError(
      error?.message ?? 'The request failed.',
      error?.code ?? 'REQUEST_FAILED',
      response.status,
    );
  }
  return {
    data: result.data,
    meta: result.meta ?? {
      page: 1,
      limit: result.data instanceof Array ? result.data.length : 1,
      total: 0,
      totalPages: 1,
    },
  };
};

export const authApi = {
  register(input: RegisterInput) {
    return apiRequest<AuthPayload>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  login(input: LoginInput) {
    return apiRequest<AuthPayload>('/auth/login', { method: 'POST', body: JSON.stringify(input) });
  },
  refresh() {
    return apiRequest<AuthPayload>('/auth/refresh', { method: 'POST' });
  },
  logout() {
    return apiRequest<void>('/auth/logout', { method: 'POST' });
  },
  me(accessToken: string) {
    return apiRequest<AuthUser>('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  },
  updateProfile(accessToken: string, fullName: string) {
    return apiRequest<AuthUser>('/auth/account/profile', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ fullName }),
    });
  },
  requestPasswordReset(identifier: string) {
    return apiRequest<{ message: string; developmentToken?: string }>(
      '/auth/password-reset/request',
      {
        method: 'POST',
        body: JSON.stringify({ identifier }),
      },
    );
  },
  resetPassword(token: string, password: string) {
    return apiRequest<{ message: string }>('/auth/password-reset/complete', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
  async exportAccount(accessToken: string) {
    const response = await fetch(`${API_URL}/auth/account/export`, {
      credentials: 'include',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error('Could not export your account data.');
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = 'yersps-account-data.json';
    link.click();
    URL.revokeObjectURL(url);
  },
  deactivateAccount(accessToken: string, password: string) {
    return apiRequest<void>('/auth/account/deactivate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ password }),
    });
  },
};
