// The digital SAT, as data: sections, modules, timing, content domains and skills.
//
// Structure, timing, domains and skills are from College Board's public pages
// (checked on VERIFIED_ON, links in SOURCES). College Board gives domain sizes
// as ranges, so the exact number of questions per domain in one module
// (`perModule`) is Mnemoq's own split inside those ranges. Two-variable data
// (scatterplots) is left out until the app can draw graphs, and the two
// statistics-inference skills are taught as one.

export const VERIFIED_ON = '2026-11-15';

export const SOURCES = [
  { label: 'College Board: how the SAT is structured', url: 'https://satsuite.collegeboard.org/sat/whats-on-the-test/structure' },
  { label: 'College Board: SAT content domains', url: 'https://satsuite.collegeboard.org/practice/content-domains' },
];

export const SCALE = { min: 400, max: 1600, sectionMin: 200, sectionMax: 800, step: 10 };
export const BREAK_MINUTES = 10;

export const SECTIONS = {
  rw: {
    id: 'rw',
    name: 'Reading and Writing',
    short: 'R&W',
    cardSubject: 'SAT Reading & Writing',
    moduleQuestions: 27,
    moduleMinutes: 32,
    // Questions appear in this domain order, as on the real test.
    domains: [
      {
        id: 'cs',
        name: 'Craft and Structure',
        perModule: 8,
        skills: [
          { id: 'wic', name: 'Words in Context' },
          { id: 'tsp', name: 'Text Structure and Purpose' },
          { id: 'ctc', name: 'Cross-Text Connections' },
        ],
      },
      {
        id: 'ii',
        name: 'Information and Ideas',
        perModule: 7,
        skills: [
          { id: 'cid', name: 'Central Ideas and Details' },
          { id: 'coe', name: 'Command of Evidence' },
          { id: 'inf', name: 'Inferences' },
        ],
      },
      {
        id: 'sec',
        name: 'Standard English Conventions',
        perModule: 7,
        skills: [
          { id: 'bnd', name: 'Boundaries' },
          { id: 'fss', name: 'Form, Structure, and Sense' },
        ],
      },
      {
        id: 'eoi',
        name: 'Expression of Ideas',
        perModule: 5,
        skills: [
          { id: 'trn', name: 'Transitions' },
          { id: 'syn', name: 'Rhetorical Synthesis' },
        ],
      },
    ],
  },
  math: {
    id: 'math',
    name: 'Math',
    short: 'Math',
    cardSubject: 'SAT Math',
    moduleQuestions: 22,
    moduleMinutes: 35,
    domains: [
      {
        id: 'alg',
        name: 'Algebra',
        perModule: 8,
        skills: [
          { id: 'lin1', name: 'Linear equations in one variable' },
          { id: 'lin2', name: 'Linear equations in two variables' },
          { id: 'linf', name: 'Linear functions' },
          { id: 'sys', name: 'Systems of linear equations' },
          { id: 'ineq', name: 'Linear inequalities' },
        ],
      },
      {
        id: 'adv',
        name: 'Advanced Math',
        perModule: 7,
        skills: [
          { id: 'eqx', name: 'Equivalent expressions' },
          { id: 'nleq', name: 'Nonlinear equations and systems' },
          { id: 'nlf', name: 'Nonlinear functions' },
        ],
      },
      {
        id: 'psda',
        name: 'Problem-Solving and Data Analysis',
        perModule: 3,
        skills: [
          { id: 'rate', name: 'Ratios, rates and units' },
          { id: 'pct', name: 'Percentages' },
          { id: 'stat', name: 'Data: center and spread' },
          { id: 'prob', name: 'Probability' },
          { id: 'infr', name: 'Inference and statistical claims' },
        ],
      },
      {
        id: 'geo',
        name: 'Geometry and Trigonometry',
        perModule: 4,
        skills: [
          { id: 'area', name: 'Area and volume' },
          { id: 'ang', name: 'Lines, angles and triangles' },
          { id: 'trig', name: 'Right triangles and trigonometry' },
          { id: 'circ', name: 'Circles' },
        ],
      },
    ],
  },
};

export const SECTION_IDS = ['rw', 'math'];
export const LEVEL_NAMES = { 1: 'Easier', 2: 'Medium', 3: 'Harder' };

// Flat lookups: skill id -> { id, name, domain, domainName, section }.
export const SKILLS = Object.fromEntries(
  SECTION_IDS.flatMap((sectionId) =>
    SECTIONS[sectionId].domains.flatMap((domain) =>
      domain.skills.map((skill) => [skill.id, { ...skill, domain: domain.id, domainName: domain.name, section: sectionId }])
    )
  )
);

export const DOMAINS = Object.fromEntries(
  SECTION_IDS.flatMap((sectionId) => SECTIONS[sectionId].domains.map((domain) => [domain.id, { ...domain, section: sectionId }]))
);

export const skillName = (id) => SKILLS[id]?.name || id;

// The diagnostic is short on purpose: 12 questions per section.
export const DIAGNOSTIC_MIX = {
  rw: { cs: 4, ii: 3, sec: 3, eoi: 2 },
  math: { alg: 4, adv: 4, psda: 2, geo: 2 },
};

export const DRILL_LENGTH = 10;

// Facts shown on the "About the SAT" card.
export const EXAM_FACTS = [
  'Reading and Writing: 54 questions in 64 minutes, as two 32-minute modules. Every question has its own short passage (25 to 150 words).',
  'Math: 44 questions in 70 minutes, as two 35-minute modules. About 75% are four-option multiple choice; for the rest you type your answer.',
  'A 10-minute break separates the two sections. A graphing calculator is built into the test app for the whole Math section.',
  'The test adapts: how you do on the first module of a section decides whether the second module is harder or easier.',
  'Each section is scored from 200 to 800, for a total of 400 to 1600. There is no penalty for a wrong answer, so never leave a question blank.',
];
