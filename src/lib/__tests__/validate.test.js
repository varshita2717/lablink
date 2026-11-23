import { describe, expect, it } from 'vitest';
import {
  validateChatInput,
  validateCheckAvailabilityArgs,
  validateDate,
  validateDraftPlanArgs,
  validateDraftProjectArgs,
  validateEnum,
  validateFindSlotsArgs,
  validateHorizonDate,
  validateId,
  validateInteger,
  validateRecommendArgs,
  validateText,
} from '../validate.js';
import { ERROR_CODES } from '../errors.js';

const TODAY = '2026-11-23'; // Monday
const invalid = expect.objectContaining({ code: ERROR_CODES.INVALID_INPUT });
const outOfHorizon = expect.objectContaining({ code: ERROR_CODES.OUT_OF_HORIZON });
const equipmentById = { scope: { quantity: 1 }, flask: { quantity: 10 } };

describe('validateText and validateChatInput', () => {
  it('trims valid text', () => {
    expect(validateText('  hello ', 10)).toBe('hello');
    expect(validateChatInput(' I need a flask ')).toBe('I need a flask');
  });

  it('rejects wrong types, empty and too-long text', () => {
    expect(() => validateText(42, 10)).toThrow(invalid);
    expect(() => validateText('   ', 10)).toThrow(invalid);
    expect(() => validateText(undefined, 10)).toThrow(invalid);
    expect(() => validateText('x'.repeat(11), 10)).toThrow(invalid);
    expect(() => validateChatInput('x'.repeat(1001))).toThrow(invalid);
    expect(validateChatInput('x'.repeat(1000))).toHaveLength(1000);
  });

  it('allows missing optional text', () => {
    expect(validateText(undefined, 10, { required: false })).toBe('');
    expect(validateText('  ', 10, { required: false })).toBe('');
  });
});

describe('validateDate and validateHorizonDate', () => {
  it('accepts real YYYY-MM-DD dates', () => {
    expect(validateDate('2026-11-24')).toBe('2026-11-24');
    expect(validateHorizonDate('2026-12-07', TODAY)).toBe('2026-12-07');
  });

  it.each([['2026-02-30'], ['24-11-2026'], ['2026-11-24T10:00'], [20261124], [null]])(
    'rejects bad date %s',
    (bad) => {
      expect(() => validateDate(bad)).toThrow(invalid);
    },
  );

  it.each([
    ['today', TODAY],
    ['weekend', '2026-11-28'],
    ['too far', '2026-12-08'],
  ])('rejects %s as out of horizon', (_label, date) => {
    expect(() => validateHorizonDate(date, TODAY)).toThrow(outOfHorizon);
  });
});

describe('validateInteger, validateEnum and validateId', () => {
  it('accepts in-range integers and rejects wrong types and out-of-range values', () => {
    expect(validateInteger(9, 9, 16)).toBe(9);
    expect(() => validateInteger(8, 9, 16)).toThrow(invalid);
    expect(() => validateInteger(17, 9, 16)).toThrow(invalid);
    expect(() => validateInteger(9.5, 9, 16)).toThrow(invalid);
    expect(() => validateInteger('10', 9, 16)).toThrow(invalid);
  });

  it('checks enums', () => {
    expect(validateEnum('final', ['idea', 'final'])).toBe('final');
    expect(() => validateEnum('done', ['idea', 'final'])).toThrow(invalid);
  });

  it('checks IDs against loaded data, including prototype keys', () => {
    expect(validateId('scope', equipmentById)).toBe('scope');
    expect(() => validateId('laser', equipmentById)).toThrow(invalid);
    expect(() => validateId('toString', equipmentById)).toThrow(invalid);
    expect(() => validateId(7, equipmentById)).toThrow(invalid);
  });
});

describe('tool argument validators', () => {
  it('recommend_equipment: description 1-1000 characters', () => {
    expect(validateRecommendArgs({ description: ' heat an acid ' })).toEqual({
      description: 'heat an acid',
    });
    expect(() => validateRecommendArgs({ description: 'x'.repeat(1001) })).toThrow(invalid);
    expect(() => validateRecommendArgs(null)).toThrow(invalid);
  });

  it('check_availability: existing equipment and a horizon date', () => {
    expect(
      validateCheckAvailabilityArgs(
        { equipmentId: 'scope', date: '2026-11-24' },
        equipmentById,
        TODAY,
      ),
    ).toEqual({
      equipmentId: 'scope',
      date: '2026-11-24',
    });
    expect(() =>
      validateCheckAvailabilityArgs(
        { equipmentId: 'ghost', date: '2026-11-24' },
        equipmentById,
        TODAY,
      ),
    ).toThrow(invalid);
    expect(() =>
      validateCheckAvailabilityArgs(
        { equipmentId: 'scope', date: '2026-11-28' },
        equipmentById,
        TODAY,
      ),
    ).toThrow(outOfHorizon);
  });

  describe('find_slots', () => {
    const valid = {
      items: [
        { equipmentId: 'flask', qty: 2 },
        { equipmentId: 'scope', qty: 1 },
      ],
      sessionHours: 3,
      sessionsPerWeek: 2,
    };

    it('accepts valid arguments and defaults optional ones to null', () => {
      expect(validateFindSlotsArgs(valid, equipmentById, TODAY)).toEqual({
        ...valid,
        numWeeks: null,
        deadline: null,
      });
      expect(
        validateFindSlotsArgs(
          { ...valid, numWeeks: 2, deadline: '2026-12-05' },
          equipmentById,
          TODAY,
        ),
      ).toMatchObject({ numWeeks: 2, deadline: '2026-12-05' });
    });

    it.each([
      ['no items', { items: [] }],
      [
        'nine items',
        { items: Array.from({ length: 9 }, () => ({ equipmentId: 'flask', qty: 1 })) },
      ],
      ['unknown ID', { items: [{ equipmentId: 'ghost', qty: 1 }] }],
      [
        'duplicate ID',
        {
          items: [
            { equipmentId: 'flask', qty: 1 },
            { equipmentId: 'flask', qty: 1 },
          ],
        },
      ],
      ['qty above capacity', { items: [{ equipmentId: 'scope', qty: 2 }] }],
      ['qty as text', { items: [{ equipmentId: 'flask', qty: '2' }] }],
      ['session too long', { sessionHours: 5 }],
      ['zero sessions', { sessionsPerWeek: 0 }],
      ['three weeks', { numWeeks: 3 }],
      ['past deadline', { deadline: '2026-11-20' }],
      ['bad deadline', { deadline: 'next week' }],
    ])('rejects %s', (_label, overrides) => {
      expect(() => validateFindSlotsArgs({ ...valid, ...overrides }, equipmentById, TODAY)).toThrow(
        invalid,
      );
    });
  });

  describe('draft_project', () => {
    const valid = {
      title: 'Acid Reaction Study',
      description: 'Heating an acid',
      deadline: '2026-12-05',
      stage: 'prototype',
      facultyGuideName: 'Dr. Kavita Rao',
    };

    it('accepts and trims valid arguments', () => {
      expect(validateDraftProjectArgs({ ...valid, title: ' Acid Reaction Study ' }, TODAY)).toEqual(
        valid,
      );
    });

    it.each([
      ['long title', { title: 'x'.repeat(121) }],
      ['missing title', { title: undefined }],
      ['unknown stage', { stage: 'done' }],
      ['deadline today', { deadline: TODAY }],
      ['deadline over a year away', { deadline: '2027-12-01' }],
      ['guide as number', { facultyGuideName: 3 }],
    ])('rejects %s', (_label, overrides) => {
      expect(() => validateDraftProjectArgs({ ...valid, ...overrides }, TODAY)).toThrow(invalid);
    });
  });

  it('draft_plan: plan and project must exist; justification ≤ 500', () => {
    const plans = { P1: {} };
    const projects = { proj1: {} };
    expect(
      validateDraftPlanArgs(
        { planId: 'P1', projectId: 'proj1', justification: ' For the study ' },
        plans,
        projects,
      ),
    ).toEqual({ planId: 'P1', projectId: 'proj1', justification: 'For the study' });
    expect(() =>
      validateDraftPlanArgs({ planId: 'P9', projectId: 'proj1' }, plans, projects),
    ).toThrow(invalid);
    expect(() =>
      validateDraftPlanArgs({ planId: 'P1', projectId: 'other' }, plans, projects),
    ).toThrow(invalid);
    expect(() =>
      validateDraftPlanArgs(
        { planId: 'P1', projectId: 'proj1', justification: 'x'.repeat(501) },
        plans,
        projects,
      ),
    ).toThrow(invalid);
  });
});
