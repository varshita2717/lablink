import { describe, expect, it, vi } from 'vitest';
import {
  enrichRecommendation,
  parseRecommendation,
  recommendEquipment,
  searchEquipment,
} from '../agent/recommend.js';
import { buildAvailability } from '../booking.js';
import { buildSeedData } from '../seed.js';
import { buildSubstitutes } from '../inventory.js';
import { nextWorkingDay } from '../dates.js';

vi.mock('../firebase.js', () => ({ db: {} }));

const TODAY = '2026-11-23';
const seed = buildSeedData(TODAY);
const equipmentById = Object.fromEntries(seed.equipment.map((item) => [item.id, item]));
const experimentsById = Object.fromEntries(seed.experiments.map((exp) => [exp.id, exp]));
const DATE = nextWorkingDay(TODAY);
const ACID_JSON = JSON.stringify({
  matchedExperimentId: 'exp-acid-heating',
  items: [
    { equipmentId: 'eq-flask-250', qty: 1, role: 'Vessel', reason: 'Holds the acid' },
    { equipmentId: 'eq-heating-mantle', qty: 1, role: 'Heat', reason: 'Even heating' },
    { equipmentId: 'eq-fume-hood', qty: 1, role: 'Ventilation', reason: 'Fumes' },
  ],
});

describe('parseRecommendation', () => {
  it('strips code fences and parses', () => {
    const parsed = parseRecommendation(
      `\`\`\`json\n${ACID_JSON}\n\`\`\``,
      equipmentById,
      experimentsById,
    );
    expect(parsed.valid).toBe(true);
    expect(parsed.matchedExperimentId).toBe('exp-acid-heating');
    expect(parsed.items.map((i) => i.equipmentId)).toEqual([
      'eq-flask-250',
      'eq-heating-mantle',
      'eq-fume-hood',
    ]);
  });

  it('gives an empty, invalid result for invalid JSON (callers fall back)', () => {
    expect(parseRecommendation('not json', equipmentById)).toEqual({
      matchedExperimentId: null,
      items: [],
      valid: false,
    });
    expect(parseRecommendation('null', equipmentById).valid).toBe(false);
    expect(parseRecommendation(undefined, equipmentById).valid).toBe(false);
  });

  it('drops unknown and duplicate IDs and unknown experiments', () => {
    const raw = JSON.stringify({
      matchedExperimentId: 'exp-made-up',
      items: [
        { equipmentId: 'eq-time-machine', qty: 1 },
        { equipmentId: 'eq-multimeter', qty: 1 },
        { equipmentId: 'eq-multimeter', qty: 2 },
        { equipmentId: 42, qty: 1 },
        null,
      ],
    });
    const parsed = parseRecommendation(raw, equipmentById, experimentsById);
    expect(parsed.matchedExperimentId).toBeNull();
    expect(parsed.items).toEqual([{ equipmentId: 'eq-multimeter', qty: 1, role: '', reason: '' }]);
  });

  it('caps qty at the equipment quantity, with a minimum of 1', () => {
    const raw = JSON.stringify({
      items: [
        { equipmentId: 'eq-oscilloscope', qty: 5 },
        { equipmentId: 'eq-multimeter', qty: 0 },
        { equipmentId: 'eq-beaker-set', qty: '3' },
      ],
    });
    const qty = parseRecommendation(raw, equipmentById).items.map((i) => i.qty);
    expect(qty).toEqual([1, 1, 1]);
  });

  it('cuts role and reason to 120 characters and keeps at most 8 items', () => {
    const items = seed.equipment.map((item) => ({
      equipmentId: item.id,
      qty: 1,
      role: 'r'.repeat(300),
      reason: 'x'.repeat(300),
    }));
    const parsed = parseRecommendation(JSON.stringify({ items }), equipmentById);
    expect(parsed.items).toHaveLength(8);
    expect(parsed.items[0].role).toHaveLength(120);
    expect(parsed.items[0].reason).toHaveLength(120);
  });
});

describe('searchEquipment', () => {
  it('scores name and tag matches above description matches', () => {
    const results = searchEquipment('oscilloscope signals', seed.equipment);
    expect(results[0].id).toBe('eq-oscilloscope');
  });

  it('returns at most 8 items and nothing for short or empty queries', () => {
    expect(
      searchEquipment('chemistry lab glassware heating acid', seed.equipment).length,
    ).toBeLessThanOrEqual(8);
    expect(searchEquipment('a b', seed.equipment)).toEqual([]);
    expect(searchEquipment('', seed.equipment)).toEqual([]);
  });
});

describe('enrichRecommendation and recommendEquipment (seed data)', () => {
  const deps = {
    equipment: seed.equipment,
    experiments: seed.experiments,
    date: DATE,
    availability: buildAvailability(seed.equipment, [DATE], seed.slots),
    substitutesById: buildSubstitutes(
      seed.equipment,
      seed.equipment.map((i) => i.id),
    ),
  };

  it('adds availability, substitutes, safety notes and needsApproval from data', async () => {
    const result = await recommendEquipment('heat an acid', {
      ...deps,
      generateJson: async () => ACID_JSON,
    });
    expect(result.aiMatching).toBe('ok');
    expect(result.matchedExperiment).toEqual({
      id: 'exp-acid-heating',
      title: 'Heating an acid solution to a set temperature',
    });
    const flask = result.items.find((i) => i.equipmentId === 'eq-flask-250');
    expect(flask.availableTomorrow).toBe(false);
    expect(flask.substitutes).toEqual([
      { equipmentId: 'eq-flask-500', name: 'Round-bottom flask 500 mL' },
    ]);
    expect(result.needsApproval).toBe(true);
    expect(result.safetyNotes.length).toBeGreaterThan(0);
    const mantle = result.items.find((i) => i.equipmentId === 'eq-heating-mantle');
    expect(mantle).toMatchObject({
      accessLevel: 'approval',
      hazardLevel: 'high',
      availableTomorrow: true,
    });
  });

  it('ignores model claims about access or hazard', () => {
    const parsed = {
      matchedExperimentId: null,
      items: [{ equipmentId: 'eq-fume-hood', qty: 1, accessLevel: 'open' }],
    };
    const result = enrichRecommendation(parsed, { ...deps, equipmentById, experimentsById });
    expect(result.items[0].accessLevel).toBe('approval');
    expect(result.needsApproval).toBe(true);
  });

  it('falls back to keyword search when the model call fails or returns bad JSON', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const failed = await recommendEquipment('oscilloscope', {
      ...deps,
      generateJson: async () => {
        throw new Error('quota');
      },
    });
    expect(failed.aiMatching).toBe('unavailable');
    expect(failed.items[0].equipmentId).toBe('eq-oscilloscope');
    const bad = await recommendEquipment('oscilloscope', {
      ...deps,
      generateJson: async () => '{oops',
    });
    expect(bad.aiMatching).toBe('unavailable');
    vi.restoreAllMocks();
  });
});
