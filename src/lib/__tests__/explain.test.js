import { describe, expect, it } from 'vitest';
import { templateExplanation } from '../agent/explain.js';

const entry = (overrides) => ({
  requestId: 'r',
  studentUid: 'u',
  studentName: 'Aarav Sharma',
  projectTitle: 'Radar signal analyser',
  deadline: '2026-11-26',
  stage: 'final',
  score: { urgency: 0.7857, fairness: 0.9, stage: 1, total: 0.8629 },
  rank: 1,
  isWinner: true,
  alternatives: null,
  ...overrides,
});

const resolution = {
  ranking: [
    entry(),
    entry({
      studentName: 'Rohan Das',
      score: { urgency: 0.5, fairness: 0.75, stage: 0.7, total: 0.615 },
      rank: 2,
      isWinner: false,
      alternatives: {
        sessions: [{ date: '2026-11-26', startHour: 10, endHour: 12 }],
        substitutions: [],
        complete: true,
      },
    }),
    entry({
      studentName: 'Meera Iyer',
      score: { urgency: 0.2857, fairness: 0.25, stage: 0.7, total: 0.3579 },
      rank: 3,
      isWinner: false,
      alternatives: { sessions: [], substitutions: [], complete: false },
    }),
  ],
};

describe('templateExplanation', () => {
  const text = templateExplanation(resolution);

  it('names the winner with the rounded total and the breakdown', () => {
    expect(text).toContain(
      'Aarav Sharma (Radar signal analyser) is allocated with a score of 0.86',
    );
    expect(text).toContain('urgency 0.79 (deadline Thu 26 Nov)');
    expect(text).toContain('fairness 0.90');
    expect(text).toContain('stage 1.00 (Final)');
  });

  it('gives the others their numbers and alternatives', () => {
    expect(text).toContain('Rohan Das scored 0.62 and is offered Thu 26 Nov, 10:00–12:00.');
    expect(text).toContain('Meera Iyer scored 0.36; no alternative slots were found');
  });

  it('states the formula weights', () => {
    expect(text).toContain('urgency 50%');
    expect(text).toContain('recent use 30%');
    expect(text).toContain('project stage 20%');
  });

  it('mentions substitutes and partial plans', () => {
    const withSwap = templateExplanation({
      ranking: [
        entry({
          isWinner: false,
          alternatives: {
            sessions: [{ date: '2026-11-26', startHour: 9, endHour: 12 }],
            substitutions: [
              { originalEquipmentId: 'a', replacement: { equipmentId: 'b', name: 'Flask 500 mL' } },
            ],
            complete: false,
          },
        }),
      ],
    });
    expect(withSwap).toContain('No request fits the remaining capacity');
    expect(withSwap).toContain(
      'using Flask 500 mL as a substitute (fewer sessions than requested).',
    );
  });

  it('returns an empty string for an empty resolution', () => {
    expect(templateExplanation({ ranking: [] })).toBe('');
    expect(templateExplanation(null)).toBe('');
  });
});
