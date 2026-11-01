// Original reading passages and questions for NSU practice mocks.
// Format: [question, [A, B, C, D, E], index of the correct option, topic, short explanation]

import { shuffleOptions } from './shuffle.js';

const M = 'Main idea';
const D = 'Detail';
const I = 'Inference';
const V = 'Vocabulary in context';
const P = "Author's purpose";

const RAW = [
  {
    title: 'The Quiet Work of Mangroves',
    passage:
      'Mangrove forests grow where land meets the sea, in mud that is salty and starved of oxygen. Few trees could survive there, yet mangroves thrive by raising their roots above the water like snorkels and by pushing salt out through their leaves. These adaptations are remarkable, but the forest\'s greatest gift is not to itself. The tangled roots slow incoming waves, so storms that would tear away a bare coastline lose much of their force. The same roots trap silt, slowly building new land. Beneath the water, the roots shelter young fish and crabs, which is why fishing communities near mangroves often catch more than those farther along the coast. Despite these benefits, mangroves have long been seen as useless swamps. In many countries they have been cleared for shrimp farms and housing, and the cost of that choice has become clear. Where the forests vanish, villages face stronger floods and fishermen return with emptier nets. Scientists now urge governments to protect the remaining mangroves, and some communities have begun planting new ones. Their message is simple: a living shoreline is cheaper and stronger than a concrete wall.',
    questions: [
      ['The passage is mainly about', ['how to start a shrimp farm', 'the protective and economic value of mangrove forests', 'how plants remove salt from seawater', 'the history of fishing villages', 'the cost of building concrete walls'], 1, M, 'The whole passage explains what mangroves do for coasts and people.'],
      ['According to the passage, how do mangroves deal with salt?', ['They store it in their roots', 'They wash it away with rain', 'They push it out through their leaves', 'They bury it in the mud', 'They avoid salty water'], 2, D, 'The second sentence says they push salt out through their leaves.'],
      ['Which of the following is NOT mentioned as a benefit of mangrove roots?', ['Slowing waves', 'Trapping silt', 'Sheltering young fish', 'Providing timber for houses', 'Reducing the force of storms'], 3, D, 'Timber is never mentioned.'],
      ['Why do fishing communities near mangroves often catch more fish?', ['The water is warmer', 'Young fish and crabs shelter among the roots', 'Fishermen use bigger nets', 'There are fewer storms', 'Shrimp farms feed the fish'], 1, D, 'The roots shelter young fish and crabs.'],
      ['It can be inferred that clearing mangroves for shrimp farms', ['always makes villages richer', 'may bring short-term gain but long-term harm', 'is required by law', 'protects the coast from floods', 'has no effect on fishing'], 1, I, 'The passage says the cost of the choice has become clear: floods and emptier nets.'],
      ['In the passage, the word "thrive" most nearly means', ['struggle', 'grow well', 'hide', 'change colour', 'disappear'], 1, V, 'Mangroves survive and do well in difficult mud.'],
      ['In the passage, the word "vanish" most nearly means', ['grow', 'move', 'disappear', 'multiply', 'change'], 2, V, 'Where the forests vanish, they are gone.'],
      ['The author\'s main purpose is to', ['entertain readers with a story', 'persuade readers that mangroves deserve protection', 'teach readers how to plant trees', 'compare two kinds of forest', 'describe a fishing village'], 1, P, 'The passage ends by urging protection and replanting.'],
      ['The author\'s attitude to clearing mangroves is', ['approving', 'indifferent', 'critical', 'amused', 'confused'], 2, P, 'The author points out the harmful results of clearing them.'],
      ['The phrase "a living shoreline" in the last sentence refers to', ['a beach with many tourists', 'a concrete wall with plants on it', 'a coast protected by mangrove forest', 'a fishing harbour', 'a shrimp farm'], 2, V, 'It contrasts the mangrove forest with a concrete wall.'],
    ],
  },
  {
    title: 'Why Sleep Matters for Memory',
    passage:
      'Many students believe that staying up all night before an exam is the best way to prepare. Research suggests the opposite. During sleep the brain does not simply rest; it replays the events of the day and moves important information from short-term storage into long-term memory. Deep sleep seems especially important for facts and figures, while the dreaming stage appears to help people connect new ideas with older ones. In one well-known experiment, two groups learned the same list of words. The group that slept soon afterwards remembered far more the next day than the group that stayed awake, even though both had studied for the same length of time. Lack of sleep also makes it harder to concentrate, so tired students absorb less new material in the first place. None of this means that studying can be skipped. Sleep cannot save a memory that was never formed. But it does mean that a student who studies steadily and sleeps well is likely to do better than one who crams through the night. The brain, it seems, finishes the lesson while we are asleep.',
    questions: [
      ['Which statement best expresses the main idea of the passage?', ['Students should never study at night', 'Sleep helps the brain store what has been learned, so cramming all night is a poor plan', 'Dreams predict exam results', 'Memory cannot be improved', 'Short-term memory is more useful than long-term memory'], 1, M, 'The passage argues that sleep strengthens memory.'],
      ['According to the passage, which stage of sleep seems especially important for facts and figures?', ['Dreaming sleep', 'Light sleep', 'Deep sleep', 'Daytime naps', 'Waking rest'], 2, D, 'Deep sleep is named for facts and figures.'],
      ['The dreaming stage appears to help people', ['forget old ideas', 'connect new ideas with older ones', 'wake up earlier', 'concentrate better', 'learn lists of words'], 1, D, 'The passage says dreaming helps connect new and older ideas.'],
      ['In the experiment, what was the same for both groups?', ['How long they slept', 'How much they remembered', 'The time they spent studying', 'The time of the test', 'The number of dreams'], 2, D, 'Both studied for the same length of time.'],
      ['Why do tired students absorb less new material?', ['They have no books', 'They find it hard to concentrate', 'They dislike the subject', 'They study for too long', 'They sleep during lessons'], 1, I, 'Lack of sleep makes it harder to concentrate.'],
      ['The author would most likely advise a student to', ['skip studying and sleep more', 'study all night before the exam', 'study steadily and sleep well', 'avoid dreaming', 'learn only facts and figures'], 2, I, 'The last paragraph recommends steady study and good sleep.'],
      ['In the passage, "crams" most nearly means', ['sleeps deeply', 'studies a great deal in a short time', 'copies from others', 'plans a timetable', 'avoids work'], 1, V, 'Cramming is intense last-minute studying.'],
      ['In the passage, "absorb" most nearly means', ['throw away', 'take in', 'repeat', 'ignore', 'measure'], 1, V, 'Absorbing material means taking it in and learning it.'],
      ['The author\'s main purpose is to', ['correct a common belief using evidence', 'sell a sleep product', 'tell a personal story', 'describe how to build a clock', 'argue that exams are unfair'], 0, P, 'The passage begins with a belief and answers it with research.'],
      ['"Sleep cannot save a memory that was never formed" means that', ['sleep is useless', 'you must study before sleep can help', 'memories fade quickly', 'dreams erase memories', 'only deep sleep matters'], 1, I, 'Sleep strengthens what was learned; it cannot create learning.'],
    ],
  },
  {
    title: 'Rivers and the Growth of Cities',
    passage:
      'Almost every great city in history began beside water. Early farmers needed rivers to irrigate their fields, and traders needed them as roads long before roads existed. A boat could carry many times more grain than a cart, and at a fraction of the cost, so towns that grew along riverbanks became centres of exchange. In time, markets, workshops and governments gathered around these crossing points. Yet the same rivers that fed cities also threatened them. Floods could wash away homes in a single night, and waste thrown into the water spread disease downstream. Cities responded in different ways. Some built high walls of earth beside the banks; others learned to live with the water by raising their houses on stilts or by planning open land where floods could spread harmlessly. Today, with more people than ever living near rivers, the lesson has become urgent. Engineers argue that cities should work with their rivers rather than fight them, keeping wetlands and floodplains instead of paving over every field. A river, they say, is not an obstacle to be conquered but a partner that must be respected.',
    questions: [
      ['The passage is mainly about', ['the invention of the boat', 'how rivers helped cities grow and what dangers they brought', 'why farmers prefer cities', 'how to build stilt houses', 'the history of markets'], 1, M, 'The passage covers both the benefits and the dangers of rivers.'],
      ['Why were boats useful to traders?', ['They were faster than any road', 'They carried much more at lower cost than carts', 'They needed no crew', 'They avoided floods', 'They were cheap to build'], 1, D, 'A boat could carry many times more grain than a cart at a fraction of the cost.'],
      ['Which of the following problems is NOT mentioned in the passage?', ['Floods destroying homes', 'Disease spreading from waste', 'Earthquakes damaging buildings', 'Cities building walls beside rivers', 'Rivers being treated as obstacles'], 2, D, 'Earthquakes are never mentioned.'],
      ['Which way of living with floods is mentioned?', ['Moving the city every year', 'Raising houses on stilts', 'Draining the river', 'Digging underground homes', 'Closing the markets'], 1, D, 'Some cities raised their houses on stilts.'],
      ['Why did towns on riverbanks become centres of exchange?', ['The soil was richer there', 'Cheap, easy transport made trade convenient', 'Governments forced traders to settle', 'Floods brought customers', 'There were no other roads anywhere'], 1, I, 'Boats made moving goods cheap, so trade gathered there.'],
      ['In the passage, "irrigate" most nearly means', ['harvest', 'supply with water', 'plough', 'measure', 'sell'], 1, V, 'Farmers used river water for their fields.'],
      ['In the passage, "obstacle" most nearly means', ['helper', 'guide', 'something in the way', 'reward', 'shortcut'], 2, V, 'An obstacle blocks progress.'],
      ['Engineers mentioned in the passage would most likely oppose', ['keeping wetlands', 'paving over floodplains', 'planning open land for floods', 'working with rivers', 'protecting riverbanks with plants'], 1, I, 'They argue against paving over every field.'],
      ['The final sentence suggests that engineers see a river as', ['an enemy', 'a partner to be respected', 'a road only', 'a danger to avoid', 'a source of waste'], 1, P, 'They call it "a partner that must be respected".'],
      ['The author\'s purpose in writing the passage is to', ['explain how rivers and cities relate and suggest a wise approach', 'advertise riverside homes', 'tell a story about a flood', 'compare boats and carts', 'argue against building cities'], 0, P, 'The passage explains the history and ends with a recommendation.'],
    ],
  },
];


// A second paragraph and ten more questions for each passage.
const EXTRA = [
  {
    paragraph:
      'Protecting mangroves is not only a matter for governments. In parts of Bangladesh and India, villagers have organised patrols to stop illegal cutting, and schools plant seedlings at the start of each rainy season. Planting alone is not enough, however. Young trees die quickly if they are placed in the wrong spot, so experts first study the tides and the soil before choosing a site. Success also depends on patience. A planted mangrove needs about a decade before its roots are dense enough to break waves, and in that time it must be guarded from grazing animals and from people looking for firewood. Communities that keep faith with this long timetable are rewarded with calmer water, richer fishing and, increasingly, income from visitors who come to see the forest.',
    questions: [
      ['According to paragraph B, why do experts study the tides and soil before planting?', ['To save money on seedlings', 'Because young trees die quickly in the wrong spot', 'To attract visitors', 'Because the law requires it', 'To measure the waves'], 1, D, 'Young trees die quickly if placed in the wrong spot.'],
      ['About how long does a planted mangrove need before its roots can break waves?', ['One season', 'About a year', 'About five years', 'About a decade', 'About fifty years'], 3, D, 'The passage says about a decade.'],
      ['From what must young mangroves be guarded?', ['Heavy rain and floods', 'Grazing animals and people seeking firewood', 'Fishermen and tourists', 'Salt and mud', 'Other young trees'], 1, D, 'They must be guarded from grazing animals and people looking for firewood.'],
      ['The author suggests that planting mangroves is', ['quick and easy', 'worthwhile but needs patience and planning', 'a waste of time', 'only for governments', 'harmful to fishing'], 1, I, 'Paragraph B stresses planning, guarding and patience, and lists rewards.'],
      ['In paragraph B, "dense" most nearly means', ['thin', 'closely packed', 'dry', 'ancient', 'colourful'], 1, V, 'Dense roots are thick and tightly packed.'],
      ['In paragraph B, "patrols" are', ['markets for fish', 'groups that guard or watch an area', 'planting tools', 'tourist boats', 'government offices'], 1, V, 'Villagers organised patrols to stop illegal cutting.'],
      ['The main idea of paragraph B is that', ['mangroves grow slowly so they are not worth planting', 'protecting mangroves needs community effort, careful planning and time', 'only schools should plant trees', 'visitors harm the forest', 'firewood is more valuable than mangroves'], 1, M, 'The paragraph gives practical steps and the need for patience.'],
      ['"Communities that keep faith with this long timetable" suggests that they', ['continue the work despite slow results', 'believe in old stories', 'avoid new ideas', 'give up quickly', 'follow the government blindly'], 0, I, 'Keeping faith means staying committed to the long process.'],
      ['Which income benefit is mentioned in paragraph B?', ['Selling timber', 'Money from visitors who come to see the forest', 'Fees from shrimp farms', 'Payments from governments', 'Sale of seedlings'], 1, D, 'It mentions income from visitors.'],
      ['Paragraph B mainly serves to', ['show how protection can work in practice', 'contradict paragraph A', 'describe how salt is removed', 'compare two countries', 'list the dangers of storms'], 0, P, 'It moves from the problem to practical action.'],
    ],
  },
  {
    paragraph:
      'Researchers have also looked at naps. A short sleep of twenty to thirty minutes in the afternoon can sharpen attention without leaving a person groggy, whereas a long nap that slips into deep sleep may make waking difficult. Some students use this to their advantage, studying a hard topic, napping briefly and then testing themselves on it. Others, however, find that napping late in the day makes it harder to fall asleep at night, which defeats the purpose. The best advice, specialists say, is to protect a regular bedtime first. Going to bed at roughly the same hour each night trains the body clock, and caffeine, which stays in the blood for hours, should be avoided in the evening. These habits are not glamorous, but they cost nothing and the benefits to learning are well supported.',
    questions: [
      ['According to paragraph B, how long is a helpful afternoon nap?', ['Five minutes', 'Twenty to thirty minutes', 'One hour', 'Two hours', 'It does not matter'], 1, D, 'The paragraph names twenty to thirty minutes.'],
      ['Why can a long nap be a problem?', ['It costs too much', 'It may slip into deep sleep and make waking difficult', 'It erases memories', 'It causes dreams', 'It makes people hungry'], 1, D, 'A long nap can slip into deep sleep and make waking difficult.'],
      ['What problem can napping late in the day cause?', ['Poor eyesight', 'Difficulty falling asleep at night', 'Loss of appetite', 'Weaker muscles', 'Bad dreams'], 1, D, 'It makes it harder to fall asleep at night.'],
      ['"Which defeats the purpose" means that', ['the nap helps more', 'the nap undermines the goal of good sleep', 'the student is defeated', 'the purpose is unknown', 'the nap was too short'], 1, I, 'The nap works against what it was meant to achieve.'],
      ['What do specialists say should be protected first?', ['Afternoon naps', 'A regular bedtime', 'Study time', 'Exam dates', 'Dream time'], 1, D, 'They advise protecting a regular bedtime first.'],
      ['In paragraph B, "groggy" most nearly means', ['energetic', 'drowsy and unclear-headed', 'angry', 'hungry', 'cheerful'], 1, V, 'A groggy person feels heavy and slow after sleep.'],
      ['In paragraph B, "glamorous" most nearly means', ['exciting and attractive', 'expensive', 'dangerous', 'ancient', 'noisy'], 0, V, 'The habits are plain, not glamorous.'],
      ['What does the paragraph say about evening caffeine?', ['It improves memory', 'It should be avoided because it stays in the blood for hours', 'It is harmless', 'It replaces sleep', 'It is only a problem for children'], 1, D, 'Caffeine stays in the blood for hours.'],
      ['Paragraph B mainly aims to', ['give practical advice about naps and sleep habits', 'prove that naps are harmful', 'describe an experiment', 'argue against studying', 'list famous sleepers'], 0, P, 'It offers advice on naps, bedtime and caffeine.'],
      ['The author\'s view of the habits described is that they are', ['dull and useless', 'simple but valuable', 'too difficult for students', 'expensive but effective', 'dangerous'], 1, I, '"Not glamorous, but they cost nothing and the benefits are well supported."'],
    ],
  },
  {
    paragraph:
      'Some cities have already begun to change course. In several countries, old concrete channels have been broken open so that rivers can curve and spread as they once did, and the results have been encouraging. Water slows down, fish return, and nearby streets flood less often because the extra water has somewhere to go. Residents, too, have gained: where a drain once ran between fences, there are now paths, benches and small parks. Not every city can follow this example. In crowded districts there may be no room to give the river back its banks, and the cost of buying land can be high. Even so, planners say that small steps, such as leaving a strip of grass along the bank or building roofs that hold rainwater, add up over time.',
    questions: [
      ['What have some cities done with old concrete channels?', ['Painted them', 'Broken them open so rivers can curve and spread', 'Filled them with soil', 'Sold them', 'Built new walls beside them'], 1, D, 'They broke them open so rivers can curve and spread.'],
      ['Which result is mentioned in paragraph B?', ['Fish return', 'Cities grow larger', 'Boats become faster', 'Farms disappear', 'Rain stops'], 0, D, 'The paragraph says fish return.'],
      ['Why do nearby streets flood less often?', ['The river becomes smaller', 'The extra water has somewhere to go', 'Walls are built higher', 'People move away', 'Rain falls less'], 1, D, 'The extra water has somewhere to go.'],
      ['What have residents gained?', ['Cheaper homes', 'Paths, benches and small parks', 'Faster boats', 'New markets', 'Less rain'], 1, D, 'The paragraph lists paths, benches and small parks.'],
      ['Why can\'t every city follow this example?', ['Rivers are too small', 'Crowded districts may lack room and land can be costly', 'Fish refuse to return', 'Planners disagree', 'Concrete is too strong'], 1, I, 'It says there may be no room and land costs can be high.'],
      ['In paragraph B, "encouraging" most nearly means', ['disappointing', 'hopeful and promising', 'confusing', 'dangerous', 'expensive'], 1, V, 'Encouraging results give hope.'],
      ['In the last sentence, "add up over time" means that small steps', ['cost more each year', 'gradually build into a significant effect', 'are counted by planners', 'cancel each other out', 'are quickly forgotten'], 1, V, 'Small actions accumulate into a big benefit.'],
      ['Which is given as an example of a small step?', ['Building a new harbour', 'Leaving a strip of grass along the bank', 'Moving a river', 'Selling riverside land', 'Closing a market'], 1, D, 'A strip of grass along the bank is mentioned.'],
      ['Paragraph B mainly describes', ['examples of cities restoring rivers and the limits of doing so', 'how floods began', 'the history of trade', 'dangers of fishing', 'plans for new canals'], 0, M, 'It gives examples, benefits and limits.'],
      ['The planners mentioned are most likely', ['hopeful that modest actions help', 'certain that nothing can be done', 'opposed to parks', 'worried about fish', 'planning to build walls'], 0, I, 'They believe small steps add up.'],
    ],
  },
];

export const NSU_READING = RAW.map((mock, mi) => ({
  n: mi + 1,
  title: mock.title,
  passage: `A. ${mock.passage}\n\nB. ${EXTRA[mi].paragraph}`,
  questions: [...mock.questions, ...EXTRA[mi].questions].map(([question, options, answer, topic, explain], qi) => ({
    id: `reading-${mi + 1}-${qi + 1}`,
    question,
    ...shuffleOptions(options, answer, (mi + 1) * 1000 + qi + 11),
    topic,
    explain,
  })),
}));
