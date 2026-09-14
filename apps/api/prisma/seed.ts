import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../src/generated/prisma/client.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../../.env'), quiet: true });

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const sectors = [
  [
    'AGR',
    'Agriculture and Farming',
    'Crop production, livestock, poultry, fisheries, and horticulture.',
    ['farm', 'crop', 'livestock', 'poultry', 'harvest'],
  ],
  [
    'AGP',
    'Agro-processing and Food Production',
    'Food and agricultural product transformation.',
    ['processing', 'dairy', 'flour', 'juice', 'packaged food'],
  ],
  [
    'MFG',
    'Manufacturing',
    'Production, fabrication, equipment, and industrial operations.',
    ['manufacture', 'factory', 'fabrication', 'production line'],
  ],
  [
    'RET',
    'Wholesale and Retail Trade',
    'Wholesale, resale, shops, and general merchandising.',
    ['shop', 'retail', 'store', 'wholesale', 'resell'],
  ],
  [
    'ICT',
    'ICT and Software',
    'Software, applications, IT support, and computer services.',
    ['software', 'application', 'website', 'cloud', 'coding'],
  ],
  [
    'DCS',
    'Digital and Creative Services',
    'Design, media, content, and digital marketing services.',
    ['design', 'content', 'photography', 'media', 'digital marketing'],
  ],
  [
    'CON',
    'Construction and Real Estate',
    'Building, property, related materials, and services.',
    ['construction', 'building', 'property', 'real estate'],
  ],
  [
    'LOG',
    'Transport and Logistics',
    'Delivery, freight, passenger transport, and warehousing.',
    ['delivery', 'freight', 'transport', 'warehouse'],
  ],
  [
    'THF',
    'Tourism, Hospitality and Food Services',
    'Hotels, restaurants, catering, and tourism.',
    ['hotel', 'restaurant', 'catering', 'tourism', 'guest'],
  ],
  [
    'PBS',
    'Professional and Business Services',
    'Consulting, accounting, training, and administrative services.',
    ['consulting', 'accounting', 'training', 'administrative'],
  ],
  [
    'EHS',
    'Education and Health Services',
    'Education, health care, child care, and wellness.',
    ['education', 'school', 'health', 'clinic', 'wellness'],
  ],
  [
    'ENV',
    'Energy and Environmental Services',
    'Renewable energy, recycling, and clean technology.',
    ['energy', 'solar', 'recycling', 'environment', 'clean technology'],
  ],
  [
    'PCS',
    'Personal and Community Services',
    'Repairs, tailoring, events, and community services.',
    ['repair', 'tailoring', 'event', 'community', 'salon'],
  ],
] as const;

const domains = [
  [
    'ECL',
    'Entrepreneurial Competence & Leadership',
    'Knowledge, management, decision-making and entrepreneurial confidence',
    20,
  ],
  ['FINANCE', 'Financial Readiness', 'Financial resources and financial management', 20],
  [
    'MARKET',
    'Market & Customer Readiness',
    'Market research, customers, competition and marketing',
    20,
  ],
  [
    'INNOVATION',
    'Innovation, Digital & Adaptability',
    'Technology, innovation and ability to respond to change',
    20,
  ],
  [
    'RISK',
    'Risk, Planning & Business Sustainability',
    'Risk management, strategic planning, resilience and success',
    20,
  ],
] as const;

const mandatoryQuestions = [
  [
    'MANDATORY_ECL_01',
    'ECL',
    'I understand the fundamental principles of starting and managing a business.',
  ],
  ['MANDATORY_ECL_02', 'ECL', 'I can identify and evaluate a viable business opportunity.'],
  [
    'MANDATORY_ECL_03',
    'ECL',
    'I understand how to determine the costs, pricing and profitability of my business.',
  ],
  [
    'MANDATORY_ECL_04',
    'ECL',
    'I understand the legal and regulatory requirements relevant to my business.',
  ],
  [
    'MANDATORY_ECL_05',
    'ECL',
    'I can make important business decisions within a reasonable amount of time.',
  ],
  ['MANDATORY_ECL_06', 'ECL', 'I can effectively organize and prioritize business activities.'],
  [
    'MANDATORY_ECL_07',
    'ECL',
    'I can communicate my business goals effectively to employees or business partners.',
  ],
  ['MANDATORY_ECL_08', 'ECL', 'I can solve problems that arise during business operations.'],
  ['MANDATORY_ECL_09', 'ECL', 'I am confident in my ability to manage my business successfully.'],
  [
    'MANDATORY_ECL_10',
    'ECL',
    'I can take responsibility for the outcomes of my business decisions.',
  ],
  [
    'MANDATORY_FINANCE_01',
    'FINANCE',
    'I have sufficient financial resources to start or continue operating my business.',
  ],
  [
    'MANDATORY_FINANCE_02',
    'FINANCE',
    'I have accurately estimated the capital required for my business.',
  ],
  [
    'MANDATORY_FINANCE_03',
    'FINANCE',
    'I have a clear plan for obtaining additional financing when necessary.',
  ],
  ['MANDATORY_FINANCE_04', 'FINANCE', 'I separate my personal finances from my business finances.'],
  ['MANDATORY_FINANCE_05', 'FINANCE', 'I regularly record my business income and expenses.'],
  ['MANDATORY_FINANCE_06', 'FINANCE', 'I prepare and monitor a budget for my business.'],
  ['MANDATORY_FINANCE_07', 'FINANCE', 'I understand the cash-flow position of my business.'],
  [
    'MANDATORY_FINANCE_08',
    'FINANCE',
    'I can determine whether my business is making a profit or loss.',
  ],
  [
    'MANDATORY_FINANCE_09',
    'FINANCE',
    'I can manage unexpected financial expenses without seriously disrupting my business.',
  ],
  [
    'MANDATORY_FINANCE_10',
    'FINANCE',
    'I have sufficient working capital to support my business operations.',
  ],
  ['MANDATORY_MARKET_01', 'MARKET', 'I have clearly identified my target customers.'],
  [
    'MANDATORY_MARKET_02',
    'MARKET',
    'I understand the main needs and problems of my target customers.',
  ],
  [
    'MANDATORY_MARKET_03',
    'MARKET',
    'I have conducted research to determine whether customers need my product or service.',
  ],
  ['MANDATORY_MARKET_04', 'MARKET', 'I understand the size and potential of my target market.'],
  ['MANDATORY_MARKET_05', 'MARKET', 'I know who my major competitors are.'],
  ['MANDATORY_MARKET_06', 'MARKET', 'I understand the strengths and weaknesses of my competitors.'],
  ['MANDATORY_MARKET_07', 'MARKET', 'My business has a clear competitive advantage.'],
  ['MANDATORY_MARKET_08', 'MARKET', 'I regularly collect and use customer feedback.'],
  [
    'MANDATORY_MARKET_09',
    'MARKET',
    'I monitor changes in customer preferences and market conditions.',
  ],
  [
    'MANDATORY_MARKET_10',
    'MARKET',
    'I have a clear strategy for attracting and retaining customers.',
  ],
  [
    'MANDATORY_INNOVATION_01',
    'INNOVATION',
    'I can effectively use digital technologies for business activities.',
  ],
  ['MANDATORY_INNOVATION_02', 'INNOVATION', 'I use digital platforms to promote my business.'],
  ['MANDATORY_INNOVATION_03', 'INNOVATION', 'I use digital tools to communicate with customers.'],
  [
    'MANDATORY_INNOVATION_04',
    'INNOVATION',
    'I use appropriate digital tools to manage business records or transactions.',
  ],
  [
    'MANDATORY_INNOVATION_05',
    'INNOVATION',
    'I regularly look for ways to improve my products or services.',
  ],
  ['MANDATORY_INNOVATION_06', 'INNOVATION', 'I actively look for new business opportunities.'],
  [
    'MANDATORY_INNOVATION_07',
    'INNOVATION',
    'I am willing to introduce new products, services or processes when opportunities arise.',
  ],
  [
    'MANDATORY_INNOVATION_08',
    'INNOVATION',
    'I use customer feedback to improve my products or services.',
  ],
  [
    'MANDATORY_INNOVATION_09',
    'INNOVATION',
    'I can adapt my business when customer needs or market conditions change.',
  ],
  [
    'MANDATORY_INNOVATION_10',
    'INNOVATION',
    'I am willing to learn and adopt new technologies or approaches that can improve my business.',
  ],
  ['MANDATORY_RISK_01', 'RISK', 'I have identified the major risks that could affect my business.'],
  ['MANDATORY_RISK_02', 'RISK', 'I regularly assess the potential impact of business risks.'],
  ['MANDATORY_RISK_03', 'RISK', 'I have strategies for reducing major business risks.'],
  ['MANDATORY_RISK_04', 'RISK', 'I have a contingency plan for major business problems.'],
  [
    'MANDATORY_RISK_05',
    'RISK',
    'My business has clearly defined short-term and long-term objectives.',
  ],
  ['MANDATORY_RISK_06', 'RISK', 'I have a realistic plan for achieving my business objectives.'],
  [
    'MANDATORY_RISK_07',
    'RISK',
    'I regularly review my business performance against my objectives.',
  ],
  [
    'MANDATORY_RISK_08',
    'RISK',
    'My business can continue operating when unexpected challenges occur.',
  ],
  [
    'MANDATORY_RISK_09',
    'RISK',
    'My business has the potential to remain financially sustainable over the next three years.',
  ],
  [
    'MANDATORY_RISK_10',
    'RISK',
    'Overall, I believe my business has strong potential for long-term success.',
  ],
] as const;

const likertOptions = [
  { label: 'Not yet', value: 1 },
  { label: 'A little', value: 2 },
  { label: 'Partly', value: 3 },
  { label: 'Mostly', value: 4 },
  { label: 'Confidently', value: 5 },
];

async function main() {
  for (const [code, name, description, keywords] of sectors) {
    await prisma.sector.upsert({
      where: { code },
      update: { name, description, keywords: [...keywords], active: true },
      create: { code, name, description, keywords: [...keywords] },
    });
  }

  const domainIds = new Map<string, string>();
  for (const [index, [code, name, description, weight]] of domains.entries()) {
    const domain = await prisma.assessmentDomain.upsert({
      where: { code },
      update: { name, description, weight, displayOrder: index + 1, active: true },
      create: { code, name, description, weight, displayOrder: index + 1, active: true },
    });
    domainIds.set(code, domain.id);
  }

  const mandatoryCodes = mandatoryQuestions.map(([code]) => code);
  await prisma.question.updateMany({
    where: { source: 'LEGACY_ARCHIVED', active: true },
    data: { active: false },
  });
  await prisma.question.updateMany({
    where: { source: 'SYSTEM_MANDATORY', code: { notIn: [...mandatoryCodes] }, active: true },
    data: { active: false },
  });
  await prisma.assessmentDomain.updateMany({
    where: { code: { notIn: domains.map(([code]) => code) } },
    data: { active: false },
  });

  for (const [index, [code, domainCode, prompt]] of mandatoryQuestions.entries()) {
    await prisma.question.upsert({
      where: { code },
      update: {
        prompt,
        domainId: domainIds.get(domainCode)!,
        scope: 'CORE',
        source: 'SYSTEM_MANDATORY',
        createdById: null,
        expertiseField: null,
        sectorId: null,
        stage: null,
        required: true,
        weight: 1,
        displayOrder: index + 1,
        active: true,
        options: likertOptions,
        scoringConfig: { min: 1, max: 5 },
      },
      create: {
        code,
        prompt,
        type: 'LIKERT',
        scope: 'CORE',
        source: 'SYSTEM_MANDATORY',
        domainId: domainIds.get(domainCode)!,
        required: true,
        weight: 1,
        displayOrder: index + 1,
        options: likertOptions,
        scoringConfig: { min: 1, max: 5 },
      },
    });
  }

  console.log('Five mandatory classes and 50 core questions are ready.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
