export interface BusinessClassificationInput {
  description: string;
  productOrService: string;
  selectedSector?: string;
}

export interface ClassificationResult {
  primarySector: string;
  confidence: number;
  matchedKeywords: string[];
  explanation: string;
  requiresReview: boolean;
}

const sectorKeywords: Record<string, string[]> = {
  'Agriculture and Farming': ['farm', 'crop', 'livestock', 'poultry', 'harvest', 'irrigation'],
  'Agro-processing and Food Production': ['processing', 'packaged food', 'flour', 'juice', 'dairy'],
  Manufacturing: ['manufacture', 'factory', 'production line', 'fabrication', 'equipment'],
  'Wholesale and Retail Trade': ['shop', 'retail', 'resell', 'wholesale', 'store'],
  'ICT and Software': ['software', 'application', 'website', 'cloud', 'cybersecurity', 'coding'],
  'Digital and Creative Services': [
    'design',
    'content',
    'photography',
    'digital marketing',
    'media',
  ],
  'Tourism, Hospitality and Food Services': ['hotel', 'restaurant', 'tourism', 'catering', 'guest'],
};

export class KeywordBusinessClassifier {
  classify(input: BusinessClassificationInput): ClassificationResult {
    const searchable = `${input.description} ${input.productOrService}`.toLowerCase();
    const ranked = Object.entries(sectorKeywords)
      .map(([sector, keywords]) => ({
        sector,
        matches: keywords.filter((keyword) => searchable.includes(keyword)),
      }))
      .sort((left, right) => right.matches.length - left.matches.length);

    const best = ranked[0];
    const primarySector = best?.matches.length
      ? best.sector
      : (input.selectedSector ?? 'Professional and Business Services');
    const matchedKeywords = best?.matches ?? [];
    const confidence = Math.min(0.95, 0.45 + matchedKeywords.length * 0.15);

    return {
      primarySector,
      confidence,
      matchedKeywords,
      explanation: matchedKeywords.length
        ? `Suggested ${primarySector} because the description contains ${matchedKeywords.join(', ')}.`
        : `Kept the selected broad sector because no maintained keyword rule was strong enough.`,
      requiresReview: confidence < 0.6,
    };
  }
}
