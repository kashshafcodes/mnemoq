// Turns the student's answers into per-section results, topic by topic.
// Pure functions, so they are easy to test.

// sections: [{ id, name, passage, questions: [{ id, question, options, answer, topic }] }]
// answers:  { [questionId]: chosenOptionIndex }
export function scoreSections(sections, answers) {
  return sections.map((section) => {
    const topics = new Map();
    const missed = [];
    let correct = 0;

    for (const q of section.questions) {
      const picked = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
      const right = picked === q.answer;
      const topic = topics.get(q.topic) || { topic: q.topic, correct: 0, total: 0 };

      topic.total += 1;

      if (right) {
        topic.correct += 1;
        correct += 1;
      } else {
        // Reading questions need their passage, so they are kept for the
        // results but not turned into flashcards (see `needsPassage`).
        missed.push({
          question: q.question,
          options: q.options,
          correct: q.answer,
          picked,
          topic: q.topic,
          explain: q.explain || '',
          needsPassage: Boolean(section.passage),
        });
      }

      topics.set(q.topic, topic);
    }

    return {
      id: section.id,
      name: section.name,
      correct,
      total: section.questions.length,
      topics: [...topics.values()],
      missed,
    };
  });
}

// Missed questions that make sense as stand-alone flashcards.
export function missedAsCards(diagnostic) {
  const cards = [];

  for (const section of diagnostic?.sections || []) {
    for (const m of section.missed || []) {
      if (!m || m.needsPassage) continue;

      // Not every question has options: SAT maths has typed answers, and a
      // result saved from another device keeps no question text at all.
      const options = Array.isArray(m.options) ? m.options : [];
      const correctAnswer = m.correctText || (Number.isInteger(m.correct) ? options[m.correct] : '') || '';
      const yourAnswer = m.pickedText || (Number.isInteger(m.picked) ? options[m.picked] : '') || '';

      if (!m.question || !correctAnswer) continue;

      cards.push({
        sectionId: section.id,
        topic: m.topic,
        question: m.question,
        correctAnswer,
        yourAnswer,
        distractors: options.filter((_, i) => i !== m.correct),
        explain: m.explain || '',
      });
    }
  }

  return cards;
}

export const ESSAY_PROMPTS = [
  'Social media has changed the way young people communicate. Discuss.',
  'Should university education be free for everyone? Give your opinion.',
  'Technology creates more jobs than it destroys. Do you agree?',
  'What can ordinary people do to fight climate change?',
  'Is online learning as effective as learning in a classroom?',
  'Why reading habits matter more than ever in the age of the internet.',
  'Should students be allowed to use smartphones in class?',
  'Rapid urbanisation: a blessing or a curse for Bangladesh?',
];

export const MIN_ESSAY_WORDS = 60;

export const countWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;
