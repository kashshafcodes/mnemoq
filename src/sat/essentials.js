// SAT essentials: the rules and formulas worth knowing by heart, as ready-made
// review cards. Adding a deck puts these into the student's own cards, so
// spaced repetition brings each one back until it sticks.
//
// Each row: [skill (the card's category), question, answer, memory hook]

const GRAMMAR = [
  ['Boundaries', 'Two complete sentences are joined by only a comma. What is this error called, and how do you fix it?', 'A comma splice. Use a full stop, a semicolon, or a comma plus and/but/so/yet.', 'A comma is too weak to hold two sentences together on its own.'],
  ['Boundaries', 'What must be on BOTH sides of a semicolon?', 'A complete sentence on each side.', 'Test: could you replace the semicolon with a full stop? If yes, it is correct.'],
  ['Boundaries', 'What must come BEFORE a colon?', 'A complete sentence. After it can come a list, an explanation or an example.', 'Cover everything after the colon: what is left must stand alone.'],
  ['Boundaries', 'How do you punctuate "however" when it joins two complete sentences?', 'Semicolon before, comma after: "...failed; however, the second worked."', 'However is not a joining word like "but". It needs the semicolon.'],
  ['Boundaries', 'Extra information in the middle of a sentence opens with a comma. What must close it?', 'A second comma (a pair). The same goes for dashes and brackets: they come in matching pairs.', 'Lift the extra part out. The sentence must still read correctly.'],
  ['Boundaries', 'Should you put a comma between a subject and its verb?', 'No, never: "The grasses that cover the plain provide shelter."', 'A long subject tempts you to pause. Do not.'],
  ['Boundaries', '"The scientist who discovered the comet named it." Commas around the "who" part or not?', 'No commas, because the clause tells you WHICH scientist (it is essential).', 'Essential = no commas. Extra = two commas.'],
  ['Boundaries', 'When do you separate list items with semicolons instead of commas?', 'When the items themselves contain commas: "Sylhet, in the northeast; Khulna, in the southwest".', 'Semicolons are the bigger dividers.'],
  ['Boundaries', 'A sentence reports a question: "She asked how far it was" Which mark ends it?', 'A full stop. It is a statement about a question, not a question.', 'Only a direct question ("How far is it?") takes a question mark.'],
  ['Form, Structure, and Sense', '"The box of old letters ___ on the shelf." sit or sits?', 'sits. The subject is "box", not "letters".', 'Cross out the "of ..." phrase to find the real subject.'],
  ['Form, Structure, and Sense', 'its, it\'s or its\': which shows possession?', 'its (no apostrophe). "It\'s" means "it is". "Its\'" does not exist.', 'Say "it is" in the sentence. If it sounds wrong, use "its".'],
  ['Form, Structure, and Sense', '"Walking through the market, the smell of spice was everywhere." What is wrong?', 'A dangling modifier: the smell was not walking. The person walking must follow the comma.', 'Whoever does the -ing action must be the very next noun.'],
  ['Form, Structure, and Sense', 'Which tense: "By the time help arrived, the hikers ___ shelter."', 'had found (past perfect): the earlier of two past events.', 'Two past events: the older one takes "had".'],
  ['Form, Structure, and Sense', '"She likes to read, to write, and painting." How do you fix it?', 'Make the list parallel: "to read, to write, and to paint".', 'Items in a list must match in form.'],
  ['Form, Structure, and Sense', '"Neither the manager nor the employees ___ aware." was or were?', 'were. With neither...nor (and either...or), the verb agrees with the nearer subject.', 'Look at the word just before the verb.'],
  ['Form, Structure, and Sense', '"The rainfall in Sylhet is greater than Rajshahi." What is wrong?', 'An illogical comparison: rainfall is compared with a city. Write "than that in Rajshahi".', 'Compare like with like.'],
  ['Form, Structure, and Sense', '"The director thanked Rafiq and ___." I or me?', 'me. The pronoun receives the action.', 'Remove "Rafiq and": "thanked me" sounds right.'],
  ['Form, Structure, and Sense', 'One bird\'s wings vs many birds\' wings: where does the apostrophe go?', 'Singular: before the s (bird\'s). Plural ending in s: after the s (birds\').', 'Write the owner first, then add the apostrophe.'],
  ['Transitions', 'Which transitions show CONTRAST?', 'however, nevertheless, still, yet, in contrast, on the other hand, instead', 'Ask: does sentence 2 push against sentence 1?'],
  ['Transitions', 'Which transitions show CAUSE and RESULT?', 'therefore, thus, as a result, consequently, accordingly', 'Ask: did sentence 1 make sentence 2 happen?'],
  ['Transitions', 'Which transitions ADD a similar point?', 'in addition, moreover, furthermore, likewise, similarly', 'Sentence 2 goes the same way as sentence 1.'],
  ['Transitions', 'Which transitions introduce an EXAMPLE or a RESTATEMENT?', 'Example: for example, for instance, specifically. Restatement: in other words, that is.', 'Is sentence 2 one case of sentence 1, or the same idea again?'],
  ['Words in Context', 'In a "most logical and precise word" question, what should you do before looking at the options?', 'Predict your own word from the clues in the sentence, then pick the option closest to it.', 'The clue is usually after a colon, a "but" or an "although".'],
  ['Command of Evidence', 'In a "which finding supports the hypothesis" question, what makes an option correct?', 'It tests exactly what the hypothesis claims: the same cause, the same effect, the right comparison.', 'True but off-topic findings are the trap.'],
];

const MATH = [
  ['Linear equations in two variables', 'Slope of the line through (x1, y1) and (x2, y2)?', '(y2 - y1) / (x2 - x1)', 'Rise over run.'],
  ['Linear equations in two variables', 'Slopes of parallel lines? Of perpendicular lines?', 'Parallel: equal. Perpendicular: negative reciprocals (their product is -1).', 'Flip the fraction and change the sign.'],
  ['Linear functions', 'In y = mx + b, what do m and b mean in a word problem?', 'm is the rate of change (per unit). b is the starting value (when x = 0).', 'b is where you begin; m is how fast you move.'],
  ['Systems of linear equations', 'When does a system of two linear equations have NO solution?', 'When the lines are parallel: same slope, different intercepts.', 'Same left side, different right side.'],
  ['Systems of linear equations', 'When does a system of two linear equations have INFINITELY many solutions?', 'When both equations describe the same line (one is a multiple of the other).', 'Everything matches after you scale.'],
  ['Linear inequalities', 'What happens to an inequality when you multiply or divide by a negative number?', 'The sign reverses (< becomes >).', '-2x > 6 gives x < -3.'],
  ['Equivalent expressions', 'Factor a² - b².', '(a - b)(a + b)', 'Difference of squares.'],
  ['Equivalent expressions', 'Expand (a + b)² and (a - b)².', 'a² + 2ab + b² and a² - 2ab + b²', 'Do not forget the middle term.'],
  ['Equivalent expressions', 'Exponent rules: x^a · x^b, (x^a)^b, x^a / x^b?', 'x^(a+b), x^(ab), x^(a-b)', 'Multiply: add. Power of a power: multiply. Divide: subtract.'],
  ['Equivalent expressions', 'What does x^(a/b) mean?', 'The b-th root of x^a.', 'Top is the power, bottom is the root.'],
  ['Nonlinear equations and systems', 'The quadratic formula for ax² + bx + c = 0?', 'x = (-b ± √(b² - 4ac)) / (2a)', 'On the test you can also graph it in the built-in calculator and read the zeros.'],
  ['Nonlinear equations and systems', 'What does the discriminant b² - 4ac tell you?', 'Positive: two real solutions. Zero: one. Negative: none.', 'It is the part under the square root.'],
  ['Nonlinear equations and systems', 'For ax² + bx + c = 0, what are the sum and the product of the solutions?', 'Sum = -b/a. Product = c/a.', 'Saves solving when a question asks only for the sum.'],
  ['Nonlinear functions', 'Where is the vertex of y = a(x - h)² + k, and of y = ax² + bx + c?', '(h, k). For standard form, x = -b / (2a).', 'The vertex is the minimum if a > 0 and the maximum if a < 0.'],
  ['Nonlinear functions', 'In y = a(1 + r)^t, what do a and r mean?', 'a is the starting amount; r is the rate of growth per period (negative r, or a base below 1, means decay).', '1.04 means +4% each period; 0.92 means -8%.'],
  ['Percentages', 'How do you find a percent change?', '(new - old) / old × 100', 'Always divide by the ORIGINAL value.'],
  ['Percentages', 'A price rises 20%, then falls 20%. Is it back where it started?', 'No. 1.2 × 0.8 = 0.96, a 4% drop.', 'Multiply the factors; never add the percentages.'],
  ['Data: center and spread', 'Which is pulled more by an extreme value: the mean or the median?', 'The mean. The median hardly moves.', 'One very rich person raises the average income, not the middle one.'],
  ['Probability', 'How do you find a conditional probability from a two-way table?', 'Use only the row or column named after "given": the wanted cell divided by that row or column total.', '"Given Grade 12" means the Grade 12 row is your whole world.'],
  ['Inference and statistical claims', 'What does random SAMPLING allow? What does random ASSIGNMENT allow?', 'Sampling: generalising to the population sampled. Assignment: concluding cause and effect.', 'Sample → who it applies to. Assign → what caused it.'],
  ['Area and volume', 'Lengths are multiplied by k. What happens to areas and volumes?', 'Areas are multiplied by k², volumes by k³.', 'Double the sides: 4 times the area, 8 times the volume.'],
  ['Right triangles and trigonometry', 'Side ratios of the 30-60-90 and 45-45-90 triangles?', '30-60-90: x, x√3, 2x. 45-45-90: x, x, x√2.', 'Both are on the test\'s reference sheet.'],
  ['Right triangles and trigonometry', 'sin, cos and tan of an angle in a right triangle?', 'sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent', 'SOH-CAH-TOA.'],
  ['Right triangles and trigonometry', 'How are sin x° and cos (90 - x)° related?', 'They are equal.', 'The sine of one acute angle is the cosine of the other.'],
  ['Circles', 'Equation of a circle with centre (h, k) and radius r?', '(x - h)² + (y - k)² = r²', 'Signs flip: (x + 3)² means h = -3. The right side is r squared.'],
  ['Circles', 'Arc length and sector area for a central angle of θ degrees?', 'Arc = (θ/360) × 2πr. Sector = (θ/360) × πr².', 'The same fraction of the whole circle.'],
  ['Circles', 'How do you convert degrees to radians?', 'Multiply by π/180. (180° = π radians.)', 'To go back, multiply by 180/π.'],
];

const asCards = (subject, sectionId, rows) =>
  rows.map(([topic, question, correctAnswer, explain]) => ({ subject, sectionId, topic, question, correctAnswer, yourAnswer: '', distractors: [], explain }));

export const ESSENTIAL_DECKS = [
  { id: 'grammar', name: 'Grammar and reading rules', detail: 'Punctuation, agreement, transitions and question strategy.', cards: asCards('SAT Reading & Writing', 'rw', GRAMMAR) },
  { id: 'math', name: 'Math formulas and facts', detail: 'What is not on the reference sheet, and what is.', cards: asCards('SAT Math', 'math', MATH) },
];
