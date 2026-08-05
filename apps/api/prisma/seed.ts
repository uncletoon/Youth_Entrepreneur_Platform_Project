import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UserRole } from '../src/generated/prisma/enums.js';

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
  ['MINDSET', 'Entrepreneurial Mindset and Personal Readiness', 10],
  ['OPPORTUNITY', 'Opportunity Identification and Value Proposition', 10],
  ['MARKET', 'Market and Marketing Readiness', 12],
  ['FINANCE', 'Financial Readiness', 15],
  ['MODEL', 'Business Model and Planning', 10],
  ['OPERATIONS', 'Operations and Resource Management', 10],
  ['INNOVATION', 'Innovation Capability', 10],
  ['DIGITAL', 'Digital Readiness', 8],
  ['LEADERSHIP', 'Leadership, Team and Networking', 7],
  ['RISK', 'Risk, Legal and Sustainability Readiness', 8],
] as const;

async function seedUser(email: string, fullName: string, role: UserRole, envKey: string) {
  const supplied = process.env[envKey];
  const generated = !supplied;
  const password = supplied || randomBytes(15).toString('base64url') + 'A1!';
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        fullName,
        role,
        passwordHash,
        consentAt: new Date(),
        ...(role === UserRole.ENTREPRENEUR ? { entrepreneurProfile: { create: {} } } : {}),
        ...(role === UserRole.ADMIN
          ? {
              expertProfile: {
                create: {
                  expertiseField: 'Business readiness and enterprise development',
                  proficiencyLevel: 'Expert',
                  yearsOfExperience: 8,
                  employmentStatus: 'Employed',
                  workplace: 'YERSPS Demonstration Programme',
                  position: 'Business Readiness Advisor',
                  highestQualification: 'Masters degree',
                  institution: 'Demo Institution',
                  professionalSummary:
                    'Experienced business readiness advisor supporting entrepreneurs with planning, finance, operations, and market validation.',
                  approvalStatus: 'APPROVED',
                  submittedAt: new Date(),
                  reviewedAt: new Date(),
                },
              },
            }
          : {}),
      },
    });
    console.log(`Created ${role}: ${email} / ${password}${generated ? ' (generated)' : ''}`);
  } else if (supplied) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash } });
    console.log(`Updated ${role} password from ${envKey}: ${email}`);
  } else {
    console.log(`Kept existing ${role}: ${email}`);
  }

  if (role === UserRole.ADMIN) {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.expertProfile.upsert({
      where: { userId: admin.id },
      update: { approvalStatus: 'APPROVED' },
      create: {
        userId: admin.id,
        expertiseField: 'Business readiness and enterprise development',
        proficiencyLevel: 'Expert',
        yearsOfExperience: 8,
        employmentStatus: 'Employed',
        workplace: 'YERSPS Demonstration Programme',
        position: 'Business Readiness Advisor',
        highestQualification: 'Masters degree',
        institution: 'Demo Institution',
        professionalSummary:
          'Experienced business readiness advisor supporting entrepreneurs with planning, finance, operations, and market validation.',
        approvalStatus: 'APPROVED',
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
  }
}

async function main() {
  for (const [code, name, description, keywords] of sectors) {
    await prisma.sector.upsert({
      where: { code },
      update: { name, description, keywords: [...keywords], active: true },
      create: { code, name, description, keywords: [...keywords] },
    });
  }

  for (const [index, [code, name, weight]] of domains.entries()) {
    await prisma.assessmentDomain.upsert({
      where: { code },
      update: { name, description: `${name} readiness domain`, weight, displayOrder: index + 1 },
      create: {
        code,
        name,
        description: `${name} readiness domain`,
        weight,
        displayOrder: index + 1,
      },
    });
  }

  const questions = [
    [
      'CORE_MINDSET_01',
      'MINDSET',
      'I follow through on important business tasks even when they become difficult.',
      1,
    ],
    [
      'CORE_MARKET_01',
      'MARKET',
      'I have spoken directly with potential customers about their needs.',
      2,
    ],
    [
      'CORE_FINANCE_01',
      'FINANCE',
      'I can estimate my costs, selling price, and expected cash flow.',
      3,
    ],
    ['CORE_MODEL_01', 'MODEL', 'I can clearly explain how the business will earn revenue.', 4],
    [
      'CORE_DIGITAL_01',
      'DIGITAL',
      'I can use appropriate digital tools to reach customers and manage the business.',
      5,
    ],
    [
      'CORE_RISK_01',
      'RISK',
      'I understand the main legal, operational, and market risks affecting the business.',
      6,
    ],
    [
      'CORE_MINDSET_02',
      'MINDSET',
      'I can dedicate consistent time and effort to building this business.',
      7,
    ],
    [
      'CORE_OPPORTUNITY_01',
      'OPPORTUNITY',
      'I can clearly describe the customer problem or opportunity I am addressing.',
      8,
    ],
    [
      'CORE_OPPORTUNITY_02',
      'OPPORTUNITY',
      'I have evidence that the problem is important enough for customers to act on.',
      9,
    ],
    [
      'CORE_MARKET_02',
      'MARKET',
      'I know how my offer differs from the alternatives customers already use.',
      10,
    ],
    [
      'CORE_FINANCE_02',
      'FINANCE',
      'I know how much capital I need and where it could come from.',
      11,
    ],
    [
      'CORE_MODEL_02',
      'MODEL',
      'I have identified the key partners and activities needed to deliver value.',
      12,
    ],
    [
      'CORE_OPERATIONS_01',
      'OPERATIONS',
      'I have identified the people, equipment, suppliers, and processes needed to operate.',
      13,
    ],
    [
      'CORE_OPERATIONS_02',
      'OPERATIONS',
      'I can define practical quality and delivery standards for the business.',
      14,
    ],
    [
      'CORE_INNOVATION_01',
      'INNOVATION',
      'I regularly test assumptions and improve the product or service using feedback.',
      15,
    ],
    [
      'CORE_INNOVATION_02',
      'INNOVATION',
      'I can adapt the business when customer needs or market conditions change.',
      16,
    ],
    [
      'CORE_DIGITAL_02',
      'DIGITAL',
      'I understand how to protect important business and customer information.',
      17,
    ],
    [
      'CORE_LEADERSHIP_01',
      'LEADERSHIP',
      'I can identify the skills that my team has and the skills still missing.',
      18,
    ],
    [
      'CORE_LEADERSHIP_02',
      'LEADERSHIP',
      'I have useful mentors, peers, partners, or professional networks I can approach.',
      19,
    ],
    [
      'CORE_RISK_02',
      'RISK',
      'I understand the registrations, permits, taxes, and sustainability duties relevant to the business.',
      20,
    ],
    ['CORE_MINDSET_03', 'MINDSET', 'I set measurable business goals and review my progress regularly.', 21],
    ['CORE_MINDSET_04', 'MINDSET', 'I seek constructive feedback and use it to improve my decisions.', 22],
    ['CORE_MINDSET_05', 'MINDSET', 'I can make responsible decisions when information is incomplete.', 23],
    ['CORE_OPPORTUNITY_03', 'OPPORTUNITY', 'I can describe the specific value customers receive from my solution.', 24],
    ['CORE_OPPORTUNITY_04', 'OPPORTUNITY', 'I have compared this opportunity with realistic alternative ideas.', 25],
    ['CORE_OPPORTUNITY_05', 'OPPORTUNITY', 'I can explain why this is the right time to pursue this opportunity.', 26],
    ['CORE_MARKET_03', 'MARKET', 'I have defined a specific group of customers to serve first.', 27],
    ['CORE_MARKET_04', 'MARKET', 'I know how I will reach, communicate with, and retain customers.', 28],
    ['CORE_MARKET_05', 'MARKET', 'I have tested whether customers are willing and able to pay.', 29],
    ['CORE_FINANCE_03', 'FINANCE', 'I separate expected one-time startup costs from recurring operating costs.', 30],
    ['CORE_FINANCE_04', 'FINANCE', 'I know the sales volume needed for the business to cover its costs.', 31],
    ['CORE_FINANCE_05', 'FINANCE', 'I keep or plan to keep reliable financial records and supporting evidence.', 32],
    ['CORE_MODEL_03', 'MODEL', 'I can describe the resources required to deliver the product or service.', 33],
    ['CORE_MODEL_04', 'MODEL', 'I understand the most important assumptions in my business model.', 34],
    ['CORE_MODEL_05', 'MODEL', 'I have a practical plan for testing and improving the business model.', 35],
    ['CORE_OPERATIONS_03', 'OPERATIONS', 'I have identified dependable suppliers or alternative sources for key inputs.', 36],
    ['CORE_OPERATIONS_04', 'OPERATIONS', 'I can estimate the time and capacity needed to meet expected demand.', 37],
    ['CORE_OPERATIONS_05', 'OPERATIONS', 'I have a practical method for monitoring quality and customer complaints.', 38],
    ['CORE_INNOVATION_03', 'INNOVATION', 'I collect evidence before making major changes to the solution.', 39],
    ['CORE_INNOVATION_04', 'INNOVATION', 'I can protect or differentiate the knowledge, design, or process behind the idea.', 40],
    ['CORE_INNOVATION_05', 'INNOVATION', 'I have a repeatable way to turn learning into product or service improvements.', 41],
    ['CORE_DIGITAL_03', 'DIGITAL', 'I can select affordable digital tools that match the needs of the business.', 42],
    ['CORE_DIGITAL_04', 'DIGITAL', 'I can use digital records to monitor customers, sales, or operations.', 43],
    ['CORE_DIGITAL_05', 'DIGITAL', 'I have a plan for reliable internet, device access, backups, and account security.', 44],
    ['CORE_LEADERSHIP_03', 'LEADERSHIP', 'Roles and decision responsibilities are clear among the people involved.', 45],
    ['CORE_LEADERSHIP_04', 'LEADERSHIP', 'I can communicate the business direction clearly to partners and team members.', 46],
    ['CORE_LEADERSHIP_05', 'LEADERSHIP', 'I know when to seek specialist support instead of making decisions alone.', 47],
    ['CORE_RISK_03', 'RISK', 'I have identified actions that reduce the most serious business risks.', 48],
    ['CORE_RISK_04', 'RISK', 'I understand how the business affects people, community, and the environment.', 49],
    ['CORE_RISK_05', 'RISK', 'I have considered continuity plans for disruptions, losses, or key-person absence.', 50],
  ] as const;

  for (const [code, domainCode, prompt, displayOrder] of questions) {
    const domain = await prisma.assessmentDomain.findUniqueOrThrow({ where: { code: domainCode } });
    await prisma.question.upsert({
      where: { code },
      update: { prompt, domainId: domain.id, displayOrder, active: true },
      create: {
        code,
        prompt,
        type: 'LIKERT',
        scope: 'CORE',
        domainId: domain.id,
        displayOrder,
        options: [
          { label: 'Not yet', value: 1 },
          { label: 'A little', value: 2 },
          { label: 'Partly', value: 3 },
          { label: 'Mostly', value: 4 },
          { label: 'Confidently', value: 5 },
        ],
        scoringConfig: { min: 1, max: 5 },
      },
    });
  }

  const marketDomain = await prisma.assessmentDomain.findUniqueOrThrow({
    where: { code: 'MARKET' },
  });
  for (const [index, [sectorCode, sectorName]] of sectors.entries()) {
    const sector = await prisma.sector.findUniqueOrThrow({ where: { code: sectorCode } });
    await prisma.question.upsert({
      where: { code: `SECTOR_${sectorCode}_01` },
      update: {
        sectorId: sector.id,
        prompt: `I understand the customer expectations, operating conditions, and competition specific to ${sectorName}.`,
        active: true,
      },
      create: {
        code: `SECTOR_${sectorCode}_01`,
        prompt: `I understand the customer expectations, operating conditions, and competition specific to ${sectorName}.`,
        type: 'LIKERT',
        scope: 'SECTOR',
        domainId: marketDomain.id,
        sectorId: sector.id,
        displayOrder: 100 + index,
        options: [
          { label: 'Not yet', value: 1 },
          { label: 'A little', value: 2 },
          { label: 'Partly', value: 3 },
          { label: 'Mostly', value: 4 },
          { label: 'Confidently', value: 5 },
        ],
        scoringConfig: { min: 1, max: 5 },
      },
    });
  }

  const stageQuestions = [
    [
      'IDEA',
      'OPPORTUNITY',
      'I have a practical plan to test this idea with potential customers before making major investments.',
    ],
    [
      'PREPARATION',
      'MODEL',
      'I have converted the idea into a documented launch plan with milestones and responsibilities.',
    ],
    [
      'STARTUP',
      'OPERATIONS',
      'I can deliver consistently while learning from early customers and controlling cash use.',
    ],
    [
      'OPERATING',
      'FINANCE',
      'I monitor sales, costs, cash flow, and operating performance using reliable records.',
    ],
    [
      'GROWTH',
      'LEADERSHIP',
      'I can delegate, standardize operations, and finance responsible business growth.',
    ],
  ] as const;
  for (const [index, [stage, domainCode, prompt]] of stageQuestions.entries()) {
    const domain = await prisma.assessmentDomain.findUniqueOrThrow({ where: { code: domainCode } });
    await prisma.question.upsert({
      where: { code: `STAGE_${stage}_01` },
      update: { prompt, stage, active: true },
      create: {
        code: `STAGE_${stage}_01`,
        prompt,
        type: 'LIKERT',
        scope: 'STAGE',
        domainId: domain.id,
        stage,
        displayOrder: 200 + index,
        options: [
          { label: 'Not yet', value: 1 },
          { label: 'A little', value: 2 },
          { label: 'Partly', value: 3 },
          { label: 'Mostly', value: 4 },
          { label: 'Confidently', value: 5 },
        ],
        scoringConfig: { min: 1, max: 5 },
      },
    });
  }

  await seedUser(
    'entrepreneur@yersps.local',
    'Demo Entrepreneur',
    UserRole.ENTREPRENEUR,
    'SEED_ENTREPRENEUR_PASSWORD',
  );
  await seedUser('admin@yersps.local', 'Demo Admin', UserRole.ADMIN, 'SEED_ADMIN_PASSWORD');
  await seedUser(
    'system@yersps.local',
    'System Administrator',
    UserRole.SYSTEM_ADMIN,
    'SEED_SYSTEM_ADMIN_PASSWORD',
  );
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
