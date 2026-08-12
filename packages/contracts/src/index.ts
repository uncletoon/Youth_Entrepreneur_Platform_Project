import { z } from 'zod';

export const userRoleSchema = z.enum(['SYSTEM_ADMIN', 'EXPERT', 'ENTREPRENEUR']);
export type UserRole = z.infer<typeof userRoleSchema>;

export const expertApprovalStatusSchema = z.enum(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED']);
export type ExpertApprovalStatus = z.infer<typeof expertApprovalStatusSchema>;

export const businessStageSchema = z.enum([
  'IDEA',
  'PREPARATION',
  'STARTUP',
  'OPERATING',
  'GROWTH',
]);
export type BusinessStage = z.infer<typeof businessStageSchema>;

export const readinessLevelSchema = z.enum([
  'NOT_READY',
  'EMERGING_READINESS',
  'MODERATELY_READY',
  'READY',
  'HIGHLY_READY',
]);
export type ReadinessLevel = z.infer<typeof readinessLevelSchema>;

export const riskLevelSchema = z.enum(['HIGH_RISK', 'MODERATE_RISK', 'LOW_RISK']);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter your full name.'),
    identifier: z.string().trim().min(5, 'Enter a valid email address or telephone number.'),
    password: z
      .string()
      .min(8, 'Use at least 8 characters.')
      .regex(/[A-Z]/, 'Include an uppercase letter.')
      .regex(/[0-9]/, 'Include a number.'),
    passwordConfirmation: z.string(),
    role: z.enum(['EXPERT', 'ENTREPRENEUR'], {
      error: 'Choose whether you are an entrepreneur or an expert.',
    }),
    consent: z.literal(true, { error: 'You must accept the privacy notice.' }),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ['passwordConfirmation'],
    message: 'Passwords do not match.',
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or telephone number.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({
  identifier: z.string().trim().min(5, 'Enter your email address or telephone number.'),
});
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetSchema = z.object({
  token: z.string().min(20, 'The reset token is invalid.'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .regex(/[A-Z]/, 'Include an uppercase letter.')
    .regex(/[0-9]/, 'Include a number.'),
});
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;

export const authUserSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  role: userRoleSchema,
  status: z.enum(['ACTIVE', 'DISABLED']),
  profileCompletion: z.number().int().min(0).max(100),
  expertApprovalStatus: expertApprovalStatusSchema.nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authPayloadSchema = z.object({
  user: authUserSchema,
  accessToken: z.string(),
});
export type AuthPayload = z.infer<typeof authPayloadSchema>;

export const accountProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter your full name.').max(150),
});
export type AccountProfileInput = z.infer<typeof accountProfileSchema>;

export const entrepreneurProfileSchema = z.object({
  ageGroup: z.string().trim().min(1),
  gender: z.string().trim().min(1),
  province: z.string().trim().min(1),
  district: z.string().trim().min(1),
  sectorLocation: z.string().trim().min(1),
  educationLevel: z.string().trim().min(1),
  employmentStatus: z.string().trim().min(1),
  entrepreneurshipExperience: z.string().trim().min(1),
  previousBusinessExperience: z.string().trim().min(1),
  relevantTraining: z.string().trim().min(1),
  digitalAccess: z.string().trim().min(1),
  preferredLanguage: z.string().trim().min(1),
});
export type EntrepreneurProfileInput = z.infer<typeof entrepreneurProfileSchema>;

export const expertProfileSchema = z.object({
  expertiseField: z.string().trim().min(2, 'Enter your field of expertise.'),
  proficiencyLevel: z.string().trim().min(2, 'Choose your proficiency level.'),
  yearsOfExperience: z.number().int().min(0).max(70),
  employmentStatus: z.string().trim().min(2, 'Enter your employment status.'),
  workplace: z.string().trim().max(200).optional(),
  position: z.string().trim().max(200).optional(),
  highestQualification: z.string().trim().min(2, 'Enter your highest qualification.'),
  institution: z.string().trim().min(2, 'Enter the institution that awarded it.'),
  certifications: z.string().trim().max(1000).optional(),
  professionalSummary: z
    .string()
    .trim()
    .min(50, 'Write at least 50 characters about your experience.'),
  evidenceUrl: z.union([z.string().url('Enter a valid evidence URL.'), z.literal('')]).optional(),
});
export type ExpertProfileInput = z.infer<typeof expertProfileSchema>;

export const businessProfileSchema = z.object({
  name: z.string().trim().min(2),
  description: z.string().trim().min(20),
  problemSolved: z.string().trim().min(5),
  productOrService: z.string().trim().min(5),
  targetCustomers: z.string().trim().min(3),
  location: z.string().trim().min(2),
  stage: businessStageSchema,
  revenueModel: z.string().trim().min(3),
  estimatedStartupCapital: z.number().nonnegative(),
  availableCapital: z.number().nonnegative(),
  teamSize: z.number().int().min(1).max(100000),
  registrationStatus: z.string().trim().min(1),
  salesChannel: z.string().trim().min(1),
  mainRisks: z.string().trim().min(3),
  supportingDocumentName: z.string().trim().max(200).optional(),
  supportingDocumentUrl: z
    .union([z.string().url('Enter a valid document URL.'), z.literal('')])
    .optional(),
  selectedSectorId: z.string().uuid().optional(),
});
export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;
