// The skill map: how the student is doing on each SAT skill, from every
// answer they have given in the diagnostic, drills, modules and full tests.

import { SECTIONS, SECTION_IDS, SKILLS } from './blueprint';

const DAY_MS = 24 * 60 * 60 * 1000;
export const SKILL_WINDOW_DAYS = 60;
export const MIN_SKILL_ANSWERS = 3;

export function skillState(correct, total) {
  if (total < MIN_SKILL_ANSWERS) return 'unseen';

  const share = correct / total;

  if (share >= 0.8) return 'strong';
  if (share >= 0.6) return 'ok';

  return 'weak';
}

// Every saved section result, from the diagnostic and from tests.
function sectionResults(diagnostic, mocks, since) {
  const out = [];

  if (diagnostic && new Date(diagnostic.createdAt).getTime() >= since) out.push(...(diagnostic.sections || []));

  for (const mock of mocks) {
    if (new Date(mock.createdAt).getTime() >= since) out.push(...(mock.sections || []));
  }

  return out;
}

// -> { skills: { [skillId]: { id, name, domain, section, correct, total, pct, state } },
//      sections: [{ id, name, domains: [{ id, name, correct, total, pct, skills: [...] }] }] }
export function skillMap(diagnostic, mocks = [], now = new Date()) {
  const since = now.getTime() - SKILL_WINDOW_DAYS * DAY_MS;
  const totals = new Map();

  for (const section of sectionResults(diagnostic, mocks, since)) {
    for (const topic of section.topics || []) {
      if (!SKILLS[topic.skill]) continue;

      const entry = totals.get(topic.skill) || [0, 0];

      entry[0] += topic.correct || 0;
      entry[1] += topic.total || 0;
      totals.set(topic.skill, entry);
    }
  }

  const skills = {};

  for (const skill of Object.values(SKILLS)) {
    const [correct, total] = totals.get(skill.id) || [0, 0];

    skills[skill.id] = {
      ...skill,
      correct,
      total,
      pct: total > 0 ? Math.round((correct / total) * 100) : null,
      state: skillState(correct, total),
    };
  }

  const sections = SECTION_IDS.map((sectionId) => ({
    id: sectionId,
    name: SECTIONS[sectionId].name,
    domains: SECTIONS[sectionId].domains.map((domain) => {
      const list = domain.skills.map((s) => skills[s.id]);
      const correct = list.reduce((sum, s) => sum + s.correct, 0);
      const total = list.reduce((sum, s) => sum + s.total, 0);

      return { id: domain.id, name: domain.name, correct, total, pct: total > 0 ? Math.round((correct / total) * 100) : null, skills: list };
    }),
  }));

  return { skills, sections };
}

// What to drill next: the weakest measured skill, counting bigger domains for
// more. If nothing is weak yet, a skill that has not been tried.
export function nextSkill(map, sectionId = null) {
  const all = Object.values(map.skills).filter((s) => !sectionId || s.section === sectionId);
  const perModule = (s) => SECTIONS[s.section].domains.find((d) => d.id === s.domain).perModule;
  const measured = all.filter((s) => s.state !== 'unseen' && s.pct < 80);

  if (measured.length > 0) {
    // Points that could be won back: how far below 100% times how often the domain comes up.
    return [...measured].sort((a, b) => (100 - b.pct) * perModule(b) - (100 - a.pct) * perModule(a))[0];
  }

  return all.find((s) => s.state === 'unseen') || null;
}

// Ids of every question the student has already seen, so new sets avoid them.
export function seenIds(diagnostic, mocks = []) {
  const seen = new Set();

  for (const section of diagnostic?.sections || []) for (const id of section.ids || []) seen.add(id);
  for (const mock of mocks) for (const section of mock.sections || []) for (const id of section.ids || []) seen.add(id);

  return seen;
}
