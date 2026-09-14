import type { ReadinessLevel, RiskLevel } from '@yersps/contracts';

export interface DomainInput {
  code: string;
  score: number;
  weight: number;
}

export interface ReadinessResult {
  score: number;
  level: ReadinessLevel;
  riskLevel: RiskLevel;
  strengths: string[];
  gaps: string[];
  explanation: string;
  rulesVersion: string;
  disclaimer: string;
}

const levelFor = (score: number): ReadinessLevel => {
  if (score >= 90) return 'HIGHLY_READY';
  if (score >= 75) return 'READY';
  if (score >= 60) return 'MODERATELY_READY';
  if (score >= 40) return 'EMERGING_READINESS';
  return 'NOT_READY';
};

export const calculateReadiness = (domains: DomainInput[]): ReadinessResult => {
  if (domains.length === 0) throw new Error('At least one domain score is required.');
  const totalWeight = domains.reduce((sum, domain) => sum + domain.weight, 0);
  if (totalWeight <= 0) throw new Error('Domain weights must total more than zero.');
  for (const domain of domains) {
    if (domain.score < 0 || domain.score > 100 || domain.weight < 0) {
      throw new Error('Scores must be 0-100 and weights cannot be negative.');
    }
  }

  const score = Math.round(
    domains.reduce((sum, domain) => sum + domain.score * domain.weight, 0) / totalWeight,
  );
  const criticalMinimum = Math.min(...domains.map((domain) => domain.score));
  const riskLevel: RiskLevel =
    score < 50 || criticalMinimum < 30
      ? 'HIGH_RISK'
      : score < 75 || criticalMinimum < 50
        ? 'MODERATE_RISK'
        : 'LOW_RISK';
  const strengths = domains.filter((domain) => domain.score >= 75).map((domain) => domain.code);
  const gaps = domains.filter((domain) => domain.score < 60).map((domain) => domain.code);

  return {
    score,
    level: levelFor(score),
    riskLevel,
    strengths,
    gaps,
    explanation: `Weighted readiness is ${score}/100; the lowest domain is ${criticalMinimum}/100.`,
    rulesVersion: 'readiness-rules-v2',
    disclaimer:
      'This is an explainable preparedness-risk estimate, not a guarantee of business success.',
  };
};
