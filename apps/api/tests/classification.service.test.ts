import { describe, expect, it } from 'vitest';
import { KeywordBusinessClassifier } from '../src/modules/classification/classification.service.js';

describe('KeywordBusinessClassifier', () => {
  it('returns an explainable ICT classification', () => {
    const result = new KeywordBusinessClassifier().classify({
      description: 'We build a cloud application for small shops.',
      productOrService: 'Subscription software and website',
    });

    expect(result.primarySector).toBe('ICT and Software');
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    expect(result.matchedKeywords).toContain('software');
    expect(result.requiresReview).toBe(false);
  });
});
