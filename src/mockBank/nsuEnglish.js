// Original English grammar and vocabulary questions for NSU practice mocks.
// Format: [stem, [A, B, C, D, E], index of the correct option, topic, short explanation]

import { shuffleOptions } from './shuffle.js';

const T = {
  tense: 'Tenses',
  sv: 'Subject-verb agreement',
  prep: 'Articles & prepositions',
  cond: 'Conditionals & modals',
  voice: 'Voice & narration',
  fix: 'Sentence correction',
  syn: 'Synonyms & antonyms',
  mean: 'Meaning in context',
  idiom: 'Idioms & phrases',
};

const RAW = [
  // ---- Mock 1 ----
  [
    ['She has lived in Dhaka ___ 2015.', ['for', 'since', 'from', 'during', 'by'], 1, T.tense, '"Since" goes with a starting point in time (2015).'],
    ['Neither the manager nor his assistants ___ aware of the change.', ['was', 'is', 'are', 'has been', 'be'], 2, T.sv, 'With "neither...nor" the verb agrees with the nearer subject, "assistants" (plural).'],
    ['He suggested that she ___ a doctor.', ['sees', 'saw', 'see', 'seeing', 'has seen'], 2, T.cond, 'After "suggested that", use the base form (subjunctive).'],
    ['The report ___ by the committee before the deadline.', ['completed', 'was completed', 'has completing', 'completes', 'is complete'], 1, T.voice, 'The report receives the action, so use the passive: was completed.'],
    ['___ honest man never hides the truth.', ['A', 'An', 'The', 'Some', 'No article'], 1, T.prep, '"Honest" begins with a vowel sound, so use "an".'],
    ['We are looking forward ___ you next week.', ['to see', 'to seeing', 'seeing', 'for seeing', 'on seeing'], 1, T.prep, '"Look forward to" is followed by a noun or -ing form.'],
    ['If I ___ you, I would accept the offer.', ['am', 'was', 'were', 'be', 'had been'], 2, T.cond, 'Second conditional (unreal present) uses "were".'],
    ['Choose the word closest in meaning to "meticulous".', ['Sloppy', 'Painstaking', 'Hasty', 'Lazy', 'Vague'], 1, T.syn, 'Meticulous means very careful and exact.'],
    ['Choose the word opposite in meaning to "scarce".', ['Rare', 'Plentiful', 'Limited', 'Meagre', 'Sparse'], 1, T.syn, 'Scarce means in short supply; plentiful is the opposite.'],
    ['Choose the correct indirect speech: He said, "I am tired."', ['He said that he was tired.', 'He said that I am tired.', 'He says he was tired.', 'He told that he is tired.', 'He said he is being tired.'], 0, T.voice, 'Present tense moves back to past, and "I" becomes "he".'],
    ['What does "to burn the midnight oil" mean?', ['To waste fuel', 'To work late into the night', 'To start a fire', 'To sleep early', 'To cook at night'], 1, T.idiom, 'It means to work or study late at night.'],
    ['Choose the correct sentence.', ['Each of the boys have a book.', 'Each of the boys has a book.', 'Each of the boys are having a book.', 'Each boys has a book.', 'Each of the boy has a book.'], 1, T.fix, '"Each" is singular, so it takes "has".'],
    ['"She was reluctant to speak in public." The word "reluctant" means:', ['eager', 'unwilling', 'able', 'confident', 'ready'], 1, T.mean, 'Reluctant means unwilling or hesitant.'],
    ['By next June, they ___ married for ten years.', ['will be', 'will have been', 'have been', 'would be', 'are'], 1, T.tense, 'Future perfect: an amount of time completed by a future point.'],
    ['The children were ___ by the loud thunder.', ['frightened', 'frightening', 'frighten', 'fright', 'frightens'], 0, T.fix, 'The passive needs a past participle: frightened.'],
    ['He is good ___ mathematics.', ['in', 'at', 'on', 'for', 'with'], 1, T.prep, '"Good at" is the fixed pattern.'],
    ['"A bird in the hand is worth two in the bush" means:', ['Birds are valuable', 'A sure thing is better than a possible one', 'Hunting is rewarding', 'Hands should be clean', 'Bushes hide birds'], 1, T.idiom, 'It advises keeping what you have rather than risking it for more.'],
    ['Choose the correct spelling.', ['Accomodation', 'Acommodation', 'Accommodation', 'Acomodation', 'Accomadation'], 2, T.fix, 'Accommodation has double c and double m.'],
    ['She ___ the piano since morning.', ['plays', 'is playing', 'has been playing', 'played', 'had played'], 2, T.tense, 'An action continuing up to now with "since": present perfect continuous.'],
    ['The meeting was ___ because of heavy rain.', ['called off', 'called on', 'called up', 'called in', 'called at'], 0, T.idiom, '"Called off" means cancelled.'],
  ],
  // ---- Mock 2 ----
  [
    ['The news ___ shocking.', ['were', 'are', 'was', 'have been', 'were being'], 2, T.sv, '"News" is an uncountable, singular noun.'],
    ['I would have called you if I ___ your number.', ['had', 'have had', 'had had', 'would have', 'has'], 2, T.cond, 'Third conditional: if + past perfect (had had).'],
    ['She ___ to the market when it started to rain.', ['walked', 'was walking', 'has walked', 'walks', 'had walk'], 1, T.tense, 'An action in progress interrupted by another: past continuous.'],
    ['The thief ___ by the police last night.', ['caught', 'was caught', 'is caught', 'has caught', 'was catching'], 1, T.voice, 'The thief receives the action in the past: was caught.'],
    ['He is the ___ of the two brothers.', ['tall', 'taller', 'tallest', 'more tall', 'most tall'], 1, T.fix, 'Compare two people with the comparative form: taller.'],
    ['Choose the word closest in meaning to "benevolent".', ['Cruel', 'Kind', 'Greedy', 'Proud', 'Timid'], 1, T.syn, 'Benevolent means kind and generous.'],
    ['Choose the word opposite in meaning to "ancient".', ['Old', 'Modern', 'Historic', 'Antique', 'Aged'], 1, T.syn, 'Ancient means very old; modern is the opposite.'],
    ['Choose the correct indirect speech: The teacher said to the boy, "Open your book."', ['The teacher told the boy to open his book.', 'The teacher said the boy opens your book.', 'The teacher told the boy he opens his book.', 'The teacher asked the boy opened his book.', 'The teacher said to the boy open the book.'], 0, T.voice, 'A command becomes "told + person + to + verb".'],
    ['What does "to let the cat out of the bag" mean?', ['To free a pet', 'To reveal a secret', 'To buy a bag', 'To lose something', 'To cause trouble'], 1, T.idiom, 'It means to reveal a secret by accident.'],
    ['She apologised ___ being late.', ['of', 'for', 'at', 'to', 'by'], 1, T.prep, '"Apologise for" is the fixed pattern.'],
    ['Either you or he ___ responsible.', ['are', 'is', 'were', 'have been', 'be'], 1, T.sv, 'With "either...or" the verb agrees with the nearer subject, "he".'],
    ['He has been absent ___ Monday.', ['for', 'since', 'from', 'in', 'at'], 1, T.tense, '"Since" marks the starting point (Monday).'],
    ['The decision was ___ unfair that everyone protested.', ['so', 'such', 'too', 'very', 'much'], 0, T.fix, '"So + adjective + that" shows a result.'],
    ['"His arguments were so cogent that no one could object." The word "cogent" means:', ['weak', 'convincing', 'confusing', 'rude', 'long'], 1, T.mean, 'Cogent means clear, logical and convincing.'],
    ['Choose the correct sentence.', ['He don\'t like tea.', 'He doesn\'t likes tea.', 'He doesn\'t like tea.', 'He not like tea.', 'He didn\'t liked tea.'], 2, T.fix, 'After "doesn\'t" use the base verb.'],
    ['She ___ be at home; her lights are on.', ['must', 'need', 'ought', 'dare', 'used'], 0, T.cond, '"Must" expresses a strong logical conclusion.'],
    ['Choose the word opposite in meaning to "expand".', ['Grow', 'Shrink', 'Extend', 'Stretch', 'Swell'], 1, T.syn, 'Expand means to grow bigger; shrink is the opposite.'],
    ['Choose the correct spelling.', ['Necesary', 'Neccessary', 'Necessary', 'Necessery', 'Nessecary'], 2, T.fix, 'Necessary: one c, double s.'],
    ['What does "once in a blue moon" mean?', ['Very frequently', 'Almost never', 'At night', 'Every month', 'Suddenly'], 1, T.idiom, 'It means very rarely.'],
    ['The principal, along with the teachers, ___ attending the ceremony.', ['are', 'is', 'were', 'have', 'be'], 1, T.sv, '"Along with" does not change the subject; "principal" is singular.'],
  ],
  // ---- Mock 3 ----
  [
    ['Hardly had he reached the station ___ the train left.', ['than', 'when', 'then', 'as', 'that'], 1, T.fix, '"Hardly...when" is the correct pair.'],
    ['She prefers tea ___ coffee.', ['than', 'to', 'over', 'from', 'against'], 1, T.prep, '"Prefer X to Y" is the fixed pattern.'],
    ['I wish I ___ a bird.', ['am', 'was', 'were', 'be', 'would be'], 2, T.cond, 'After "wish" (unreal present) use "were".'],
    ['The letter ___ before I arrived.', ['has been written', 'had been written', 'was writing', 'wrote', 'is written'], 1, T.voice, 'Passive, and earlier than another past event: past perfect passive.'],
    ['Everyone ___ invited to the party.', ['were', 'are', 'was', 'have', 'be'], 2, T.sv, '"Everyone" is singular.'],
    ['Choose the word closest in meaning to "diligent".', ['Lazy', 'Hardworking', 'Angry', 'Shy', 'Rude'], 1, T.syn, 'Diligent means careful and hardworking.'],
    ['Choose the word opposite in meaning to "victory".', ['Triumph', 'Defeat', 'Success', 'Win', 'Glory'], 1, T.syn, 'Victory is winning; defeat is losing.'],
    ['Choose the correct indirect speech: She said, "I will come tomorrow."', ['She said that she will come tomorrow.', 'She said that she would come the next day.', 'She said she comes next day.', 'She told that she would came the next day.', 'She said that I would come the next day.'], 1, T.voice, '"Will" becomes "would" and "tomorrow" becomes "the next day".'],
    ['What does "to bite the bullet" mean?', ['To eat quickly', 'To endure a painful situation bravely', 'To fire a gun', 'To be angry', 'To break a tooth'], 1, T.idiom, 'It means to face something unpleasant with courage.'],
    ['He insisted ___ paying the bill.', ['to', 'on', 'at', 'for', 'with'], 1, T.prep, '"Insist on" is the fixed pattern.'],
    ['Neither of the answers ___ correct.', ['are', 'were', 'is', 'have been', 'be'], 2, T.sv, '"Neither of" takes a singular verb.'],
    ['The more you practise, ___ you become.', ['the better', 'better', 'best', 'the best', 'more better'], 0, T.fix, '"The more..., the better" is the correct comparative pair.'],
    ['"The company\'s profits dwindled over the year." The word "dwindled" means:', ['Increased sharply', 'Decreased gradually', 'Stayed the same', 'Doubled', 'Were hidden'], 1, T.mean, 'Dwindle means to get smaller little by little.'],
    ['Choose the correct sentence.', ['She suggested me to leave.', 'She suggested that I leave.', 'She suggested me leaving.', 'She suggest I left.', 'She suggested to leave me.'], 1, T.fix, '"Suggest that + subject + base verb" is correct.'],
    ['By the time the doctor came, the patient ___.', ['died', 'has died', 'had died', 'was dying', 'dies'], 2, T.tense, 'Past perfect shows the earlier of two past events.'],
    ['"The ball is in your court" means:', ['It is your turn to act', 'You own a tennis court', 'You are winning', 'The game is over', 'Play fairly'], 0, T.idiom, 'It means it is now your decision or move.'],
    ['A ___ of sheep was grazing on the hill.', ['pack', 'flock', 'swarm', 'pride', 'litter'], 1, T.idiom, 'A group of sheep is a flock.'],
    ['Choose the correct spelling.', ['Occurence', 'Occurrence', 'Ocurrence', 'Occurance', 'Occurrance'], 1, T.fix, 'Occurrence: double c, double r.'],
    ['You ___ smoke here; it is prohibited.', ['needn\'t', 'mustn\'t', 'shan\'t', 'may', 'can'], 1, T.cond, '"Mustn\'t" expresses prohibition.'],
    ['The singer, ___ voice is magical, won an award.', ['who', 'whom', 'whose', 'which', 'that'], 2, T.fix, '"Whose" shows possession of the voice.'],
  ],
];

export const NSU_ENGLISH = RAW.map((list, mi) => ({
  n: mi + 1,
  questions: list.map(([question, options, answer, topic, explain], qi) => ({
    id: `english-${mi + 1}-${qi + 1}`,
    question,
    ...shuffleOptions(options, answer, (mi + 1) * 100 + qi + 7),
    topic,
    explain,
  })),
}));
