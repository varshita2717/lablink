import { describe, expect, it, vi } from 'vitest';
import { explainAllocation, templateExplanation } from '../agent/explain.js';

vi.mock('../firebase.js', () => ({ db: {}, app: {}, appCheck: null }));

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

describe('explainAllocation', () => {
  const AI_TEXT =
    'Aarav Sharma gets the oscilloscope with 0.86: his deadline is closest and he used the lab least. Rohan Das (0.62) is offered Thu 26 Nov, 10:00–12:00. Meera Iyer (0.36) has no slot before her deadline.';

  it('returns the AI text and sends the rounded numbers with the no-re-ranking rule', async () => {
    const generate = vi.fn(async () => `  ${AI_TEXT}  `);
    const result = await explainAllocation(resolution, { generate });
    expect(result).toEqual({ text: AI_TEXT, source: 'ai' });
    const [prompt, options] = generate.mock.calls[0];
    expect(prompt).toContain('"total":0.86');
    expect(prompt).toContain('"total":0.62');
    expect(prompt).toContain('Do not change, question or re-rank it');
    expect(options.maxOutputTokens).toBeGreaterThan(0);
  });

  it.each([
    [
      'fails',
      async () =>
        Promise.reject(Object.assign(new Error('busy'), { customErrorData: { status: 503 } })),
    ],
    ['returns nothing', async () => '   '],
    ['is too long', async () => `Aarav ${'x'.repeat(1000)}`],
    ['does not name the winner', async () => 'Someone else wins.'],
  ])('falls back to the template when the model %s', async (_label, generate) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await explainAllocation(resolution, { generate });
    expect(result).toEqual({ text: templateExplanation(resolution), source: 'template' });
    vi.restoreAllMocks();
  });

  it('does not call the model for an empty resolution', async () => {
    const generate = vi.fn();
    expect(await explainAllocation({ ranking: [] }, { generate })).toEqual({
      text: '',
      source: 'template',
    });
    expect(generate).not.toHaveBeenCalled();
  });
});
