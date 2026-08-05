import { describe, expect, it } from 'vitest';
import { calculateReadiness } from '../src/modules/scoring/scoring.service.js';

describe('calculateReadiness', () => {
  it('calculates a weighted, explainable result', () => {
    const result = calculateReadiness([
      { code: 'FINANCE', score: 55, weight: 2 },
      { code: 'MARKET', score: 80, weight: 1 },
      { code: 'MINDSET', score: 75, weight: 1 },
    ]);

    expect(result.score).toBe(66);
    expect(result.level).toBe('MODERATELY_READY');
    expect(result.riskLevel).toBe('MODERATE_RISK');
    expect(result.gaps).toContain('FINANCE');
    expect(result.disclaimer).toContain('not a guarantee');
  });

  it('raises high risk when a critical domain is very weak', () => {
    const result = calculateReadiness([
      { code: 'FINANCE', score: 20, weight: 1 },
      { code: 'MARKET', score: 90, weight: 4 },
    ]);

    expect(result.score).toBe(76);
    expect(result.riskLevel).toBe('HIGH_RISK');
  });
});
