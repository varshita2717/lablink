import { describe, expect, it } from 'vitest';
import { collectSafetyNotes, needsApproval } from '../access.js';

const open = { accessLevel: 'open', hazardLevel: 'none', safetyNote: '' };
const approval = { accessLevel: 'approval', hazardLevel: 'none', safetyNote: '' };
const moderate = { accessLevel: 'open', hazardLevel: 'moderate', safetyNote: 'Wear gloves.' };
// Invalid in data (rules forbid it), but needsApproval must still be safe.
const highOpen = { accessLevel: 'open', hazardLevel: 'high', safetyNote: 'Use the fume hood.' };

describe('needsApproval', () => {
  it('is false for an open-only plan', () => {
    expect(needsApproval([open, moderate])).toBe(false);
  });

  it('is true when any item needs approval', () => {
    expect(needsApproval([open, approval])).toBe(true);
  });

  it('is true for a high-hazard item even if marked open', () => {
    expect(needsApproval([open, highOpen])).toBe(true);
  });

  it('is false for an empty plan', () => {
    expect(needsApproval([])).toBe(false);
  });
});

describe('collectSafetyNotes', () => {
  it('collects moderate and high notes once each, skipping none-hazard items', () => {
    expect(collectSafetyNotes([open, moderate, highOpen, { ...moderate }])).toEqual([
      'Wear gloves.',
      'Use the fume hood.',
    ]);
  });

  it('includes a hazardous experiment note first', () => {
    const experiment = { hazardLevel: 'high', safetyNote: 'Faculty supervision required.' };
    expect(collectSafetyNotes([moderate], experiment)).toEqual([
      'Faculty supervision required.',
      'Wear gloves.',
    ]);
  });

  it('ignores empty notes and safe experiments', () => {
    expect(collectSafetyNotes([{ hazardLevel: 'moderate' }], { hazardLevel: 'none' })).toEqual([]);
  });
});
