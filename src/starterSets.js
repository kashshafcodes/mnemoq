// Small, hand-checked starter sets for the "I have an exam coming" path.
// Each entry: [question, correct answer, memory hook]. Keep facts stable and
// textbook-level; anything that changes with time (current affairs) is left out.
// Subject and category names must match subjects.js.

const raw = {
  English: {
    Vocabulary: [
      ['Ephemeral means...', 'Lasting for a very short time', 'Think "ephemeral = a day-fly": gone by tomorrow.'],
      ['Benevolent means...', 'Kind and generous', 'bene = good (benefit), volent = wishing.'],
      ['Candid means...', 'Honest and straightforward', 'A candid camera shows people as they really are.'],
      ['Meticulous means...', 'Very careful about details', 'A "meticulous" person misses no detail.'],
      ['Ambiguous means...', 'Open to more than one meaning', 'ambi = both: it can be read both ways.'],
    ],
    Grammar: [
      ['Fill in: "Neither of the boys ___ present."', 'is', '"Neither" and "each" take a singular verb.'],
      ['Fill in: "I have been living here ___ 2015."', 'since', 'since = a point in time, for = a length of time.'],
      ['Fill in: "If I ___ you, I would apologise."', 'were', 'Imaginary "if" uses "were" for every person.'],
      ['Fill in: "He is senior ___ me."', 'to', 'senior, junior, superior, inferior take "to", not "than".'],
    ],
  },
  Biology: {
    'Cell & molecular': [
      ['Which organelle is called the powerhouse of the cell?', 'Mitochondria', 'Mitochondria make ATP, the cell\'s energy currency.'],
      ['Where does protein synthesis take place in the cell?', 'Ribosomes', 'Ribosomes read mRNA and build proteins.'],
      ['Which organelle packages and ships proteins out of the cell?', 'Golgi apparatus', 'Golgi = the cell\'s post office.'],
      ['Which organelles contain digestive enzymes?', 'Lysosomes', 'Lysosomes = the cell\'s recycling bin.'],
    ],
    Genetics: [
      ['Who is known as the father of genetics?', 'Gregor Mendel', 'Mendel and his pea plants.'],
      ['Who proposed the double-helix model of DNA (1953)?', 'Watson and Crick', 'Two names for a two-strand helix.'],
      ['Down syndrome is caused by which chromosomal condition?', 'Trisomy 21', 'Down = 3 copies of chromosome 21.'],
      ['How many chromosomes does a normal human body cell have?', '46', '23 pairs = 46.'],
    ],
    'Human physiology': [
      ['Which is the largest organ of the human body?', 'Skin', 'It covers the whole body.'],
      ['What is the functional unit of the kidney?', 'Nephron', 'Nephron = the kidney\'s filter unit.'],
      ['Which cells of the pancreas produce insulin?', 'Beta cells (islets of Langerhans)', 'Beta = B = "bring sugar down".'],
      ['Which protein in red blood cells carries oxygen?', 'Haemoglobin', 'Haem + globin: iron-containing protein.'],
    ],
    Botany: [
      ['In which organelle does photosynthesis occur?', 'Chloroplast', 'Chloro = green, plast = body.'],
      ['Which tissue carries water upward in plants?', 'Xylem', 'X-ylem: "X marks the way up" for water.'],
      ['Which tissue carries food (sugars) in plants?', 'Phloem', 'Phloem = food.'],
      ['Which structures control gas exchange in leaves?', 'Stomata', 'Stomata = tiny mouths of the leaf.'],
    ],
    Zoology: [
      ['Which is the largest phylum of the animal kingdom?', 'Arthropoda', 'Insects, spiders, crabs: jointed legs.'],
      ['How many chambers does a fish heart have?', 'Two', 'Fish 2, frog 3, human 4.'],
      ['Which mosquito spreads malaria?', 'Female Anopheles', 'Malaria = Anopheles.'],
      ['Which mosquito spreads dengue?', 'Aedes', 'Dengue = Aedes.'],
    ],
  },
  'General Knowledge': {
    History: [
      ['On which date is Victory Day celebrated in Bangladesh?', '16 December', 'Victory in December: 16/12/1971.'],
      ['The Language Movement martyrs are remembered on which date?', '21 February', '21 Feb 1952, now International Mother Language Day.'],
      ['The Declaration of Independence of Bangladesh is dated...', '26 March 1971', 'Independence Day: 26 March.'],
      ['The Battle of Plassey was fought in which year?', '1757', 'Plassey 1757: start of British rule in Bengal.'],
    ],
    Geography: [
      ['Which is the largest mangrove forest in the world?', 'The Sundarbans', 'Home of the Royal Bengal tiger.'],
      ['Which place has the longest natural sea beach in Bangladesh?', "Cox's Bazar", "About 120 km: Cox's Bazar."],
      ['What is the Ganges called in Bangladesh?', 'Padma', 'Ganges becomes Padma at the Bangladesh border.'],
      ['Which district of Bangladesh is the largest by area?', 'Rangamati', 'Hill district: Rangamati.'],
    ],
    'Science & technology': [
      ['What is the SI unit of force?', 'Newton', 'Named after Isaac Newton.'],
      ['What is the pH of a neutral solution like pure water?', '7', 'Below 7 acid, above 7 base.'],
      ['What is the chemical symbol of sodium?', 'Na', 'From the Latin "natrium".'],
      ['Where is the headquarters of the World Health Organization?', 'Geneva', 'WHO = Geneva, Switzerland.'],
    ],
  },
};

// Flat, ready-to-use list: { id, subject, category, question, correctAnswer, explanation }
export const STARTER_CARDS = Object.entries(raw).flatMap(([subject, categories]) =>
  Object.entries(categories).flatMap(([category, rows]) =>
    rows.map(([question, correctAnswer, explanation], index) => ({
      id: `${subject}|${category}|${index}`,
      subject,
      category,
      question,
      correctAnswer,
      explanation,
    }))
  )
);

// For the topic picker: [{ subject, categories: [name, ...] }]
export const STARTER_TOPICS = Object.entries(raw).map(([subject, categories]) => ({
  subject,
  categories: Object.keys(categories),
}));
