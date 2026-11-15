// Exam paths: what each target exam is made of.
//
// A path is data, not code. Adding another exam later means adding an entry
// here (and a diagnostic for any new subject in diagnostics.js).
//
// Exam formats are written from published sources and checked on VERIFIED_ON.
// Universities change formats often, so every path carries a note telling the
// student to confirm against the latest official circular. Where a university
// does not publish a marks split we say so and use an even split.

export const VERIFIED_ON = '2026-10-31';

// Every subject any path can use. `cardSubject` is the subject name used by the
// student's own cards, so their reviews count towards this subject.
export const SUBJECT_CATALOG = {
  math: {
    id: 'math',
    name: 'Math',
    cardSubject: 'Mathematics',
    blurb: 'Calculus, vectors, complex numbers, coordinate geometry',
  },
  physics: {
    id: 'physics',
    name: 'Physics',
    cardSubject: 'Physics',
    blurb: 'Mechanics, heat, electricity, waves, modern physics',
  },
  chemistry: {
    id: 'chemistry',
    name: 'Chemistry',
    cardSubject: 'Chemistry',
    blurb: 'Stoichiometry, equilibrium, acids and bases, organic',
  },
  biology: {
    id: 'biology',
    name: 'Biology',
    cardSubject: 'Biology',
    blurb: 'Cell, genetics, human physiology, botany',
  },
  english: {
    id: 'english',
    name: 'English',
    cardSubject: 'English',
    blurb: 'Grammar and vocabulary',
  },
  gk: {
    id: 'gk',
    name: 'General Knowledge',
    cardSubject: 'General Knowledge',
    blurb: 'Bangladesh, world and science basics',
  },
  quant: {
    id: 'quant',
    name: 'Quantitative Aptitude',
    cardSubject: 'Mathematics',
    blurb: 'Arithmetic, algebra, ratio, geometry, counting',
  },
  reading: {
    id: 'reading',
    name: 'Reading Comprehension',
    cardSubject: 'Reading Comprehension',
    blurb: 'Understanding passages and drawing conclusions',
  },
  bmath: {
    id: 'bmath',
    name: 'Mathematics',
    cardSubject: 'Mathematics',
    blurb: 'Arithmetic, algebra, geometry, trigonometry, statistics (SSC/HSC level)',
  },
  hmphys: {
    id: 'hmphys',
    name: 'Higher Math & Physics',
    cardSubject: 'Physics',
    blurb: 'Calculus, vectors, coordinate geometry, mechanics, electricity, waves',
  },
  essay: {
    id: 'essay',
    name: 'Essay',
    cardSubject: 'Essay',
    blurb: 'Composition: structure, clarity and language',
    // No multiple-choice diagnostic: the student writes a short essay and the AI marks it.
    aiMarked: true,
  },
};

export const PATHS = {
  buet: {
    id: 'buet',
    name: 'BUET Engineering',
    short: 'BUET',
    tagline: 'Math, Physics and Chemistry at admission level.',
    target: 85,
    subjects: [
      { id: 'math', marks: 35 },
      { id: 'physics', marks: 33 },
      { id: 'chemistry', marks: 32 },
    ],
    exam: {
      summary: 'Written test: about 40 questions over 3 hours, around 400 marks.',
      details: [
        'Math about 35%, Physics about 33%, Chemistry about 32%.',
        'Architecture applicants also sit a separate drawing test.',
        'The real test is written. Our diagnostic uses multiple choice to find your gaps quickly.',
      ],
      source: {
        label: 'Open Exam Prep: BUET undergraduate written test',
        url: 'https://open-exam-prep.com/practice/bd-buet-ug-written',
      },
      note: 'BUET has changed its test format before (it used a preliminary MCQ round). This is the weakest-sourced path: confirm marks and format on the latest official BUET circular.',
    },
  },

  nsu: {
    id: 'nsu',
    name: 'NSU Admission',
    short: 'NSU',
    tagline: 'English, quantitative aptitude, reading comprehension and an essay.',
    target: 75,
    subjects: [
      { id: 'english', marks: 25 },
      { id: 'quant', marks: 25 },
      { id: 'reading', marks: 25 },
      { id: 'essay', marks: 25 },
    ],
    exam: {
      summary: '2.5 hours: English grammar and vocabulary, quantitative aptitude, reading comprehension and an essay.',
      details: [
        'North South University does not publish the marks for each part, so Mnemoq weighs the four parts equally.',
        'Architecture applicants also take a 30-minute drawing test.',
      ],
      source: {
        label: 'NSU admissions: requirements',
        url: 'https://admissions.northsouth.edu/requirement',
      },
      note: 'The even weighting is our estimate, not an official split. Confirm the format on the latest NSU admissions page.',
    },
  },

  brac: {
    id: 'brac',
    name: 'BRAC University Admission',
    short: 'BRAC',
    tagline: 'English, composition, mathematics, and higher maths and physics.',
    target: 75,
    // Sections A to D: the paper for CSE, EEE, ECE, CS, Physics, Maths and APE.
    // Weighted by BRAC's published marks (20, 40, 15, 10).
    subjects: [
      { id: 'english', name: 'English Language', marks: 20 },
      { id: 'essay', name: 'English Composition', marks: 40 },
      { id: 'bmath', marks: 15 },
      { id: 'hmphys', marks: 10 },
    ],
    exam: {
      summary: 'Sections A to D, 1 hour 50 minutes: 20 English MCQs, one written composition (40 marks), 15 Mathematics MCQs and 10 Higher Mathematics & Physics MCQs.',
      details: [
        'You must pass every section separately. There is a written test and then an interview.',
        'BBA, Economics, Biology and Microbiology sit only sections A to C (1 hour 30 minutes). Pharmacy adds Biology & Chemistry; Architecture adds Drawing.',
        'Mathematics and the science sections are offered in English and Bangla.',
      ],
      source: {
        label: 'BRAC University: sample questions for undergraduate programs',
        url: 'https://www.bracu.ac.bd/sites/default/files/admission/SQ/Sample%20Question_UG_%20Updated%20_October%202022_2.pdf',
      },
      note: 'Based on BRAC University’s published sample paper. Confirm the sections for your program in the current admission notice.',
    },
  },

  medical: {
    id: 'medical',
    name: 'Medical (MBBS / BDS)',
    short: 'Medical',
    tagline: 'Biology, Chemistry, Physics, English and General Knowledge.',
    target: 80,
    subjects: [
      { id: 'biology', marks: 30 },
      { id: 'chemistry', marks: 25 },
      { id: 'physics', marks: 15 },
      { id: 'english', marks: 15 },
      { id: 'gk', marks: 15 },
    ],
    exam: {
      summary: '100 questions, 100 marks, 1 hour 15 minutes. 0.25 marks off for each wrong answer.',
      details: [
        'Biology 30, Chemistry 25, Physics 15, English 15, General Knowledge 15.',
        'Scoring below 40 on the test makes a candidate ineligible.',
        'SSC and HSC GPAs are added to the merit score separately.',
      ],
      source: {
        label: 'Prothom Alo: medical and dental admission guidelines',
        url: 'https://en.prothomalo.com/youth/education/lpcpzm0agn',
      },
      note: 'Guidelines are published each year. Confirm the marks and rules in the latest DGME circular.',
    },
  },

  // The digital SAT. Its sections, skills and scoring live in src/sat/; this
  // entry only tells the rest of the app that the path exists and that its
  // score is on the 400-1600 scale instead of 0-100.
  sat: {
    id: 'sat',
    name: 'Digital SAT',
    short: 'SAT',
    engine: 'sat',
    tagline: 'Reading and Writing plus Math, on the real 400-1600 scale.',
    target: 1400,
    scale: { min: 400, max: 1600, step: 10, targetMin: 900, close: 50, building: 150, word: 'estimated score' },
    subjects: [
      { id: 'rw', name: 'Reading and Writing', cardSubject: 'SAT Reading & Writing', blurb: 'Short passages, grammar, transitions', marks: 800 },
      { id: 'math', name: 'Math', cardSubject: 'SAT Math', blurb: 'Algebra, advanced math, data analysis, geometry', marks: 800 },
    ],
    exam: {
      summary: '2 hours 14 minutes on a computer: Reading and Writing (64 minutes), a 10-minute break, then Math (70 minutes).',
      details: [
        'Each section has two modules. How you do on the first decides whether the second is harder or easier.',
        'Each section is scored from 200 to 800, for a total of 400 to 1600. Wrong answers cost nothing.',
        'Mnemoq questions are original. For official practice, use the free Bluebook app and log your scores here.',
      ],
      source: {
        label: 'College Board: how the SAT is structured',
        url: 'https://satsuite.collegeboard.org/sat/whats-on-the-test/structure',
      },
      note: 'Checked against College Board on 15 November 2026. Test dates, fees and policies change: confirm them on the College Board site.',
    },
  },
};

// Paths offered to students right now. The others are fully described above
// but stay hidden until their diagnostics have been checked.
export const ENABLED_PATHS = ['nsu', 'brac', 'sat'];

export const PATH_LIST = ENABLED_PATHS.map((id) => PATHS[id]);

// Most paths measure readiness from 0 to 100.
export const DEFAULT_SCALE = { min: 0, max: 100, step: 1, targetMin: 40, targetMax: 95, close: 10, building: 25, word: 'readiness' };

export const scaleOf = (path) => ({ ...DEFAULT_SCALE, targetMax: path?.scale ? path.scale.max : DEFAULT_SCALE.targetMax, ...(path?.scale || {}) });

export function getPath(id) {
  const path = PATHS[id];

  if (!path) return null;

  // Join each entry with its catalog details.
  return {
    ...path,
    subjects: path.subjects.map((entry) => ({ ...SUBJECT_CATALOG[entry.id], ...entry })),
    totalMarks: path.subjects.reduce((sum, entry) => sum + entry.marks, 0),
  };
}
