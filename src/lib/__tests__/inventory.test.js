import { describe, expect, it, vi } from 'vitest';
import { filterEquipment, isFreeOn, suggestEquipment } from '../inventory.js';

vi.mock('../firebase.js', () => ({ db: {} }));

const full = () => {
  const arr = [];
  for (let h = 9; h < 17; h += 1) arr[h] = 0;
  return arr;
};

const equipment = [
  {
    id: 'flask',
    name: 'Round-bottom flask 250 mL',
    category: 'Glassware',
    description: 'For heating liquids',
    tags: ['acid', 'reflux'],
    labName: 'Chemistry Lab',
    department: 'Chemistry',
    accessLevel: 'open',
    quantity: 10,
  },
  {
    id: 'scope',
    name: 'Digital Oscilloscope',
    category: 'Measurement',
    description: 'Signal analysis',
    tags: ['signals'],
    labName: 'Signals Lab',
    department: 'ECE',
    accessLevel: 'approval',
    quantity: 1,
  },
];
const availability = { flask: { '2026-11-24': full() } };
const ids = (list) => list.map((item) => item.id);

describe('filterEquipment', () => {
  it('returns everything with empty filters', () => {
    expect(ids(filterEquipment(equipment, {}))).toEqual(['flask', 'scope']);
  });

  it('matches every query word across name, tags, lab and department, case-insensitively', () => {
    expect(ids(filterEquipment(equipment, { query: 'ACID chemistry' }))).toEqual(['flask']);
    expect(ids(filterEquipment(equipment, { query: 'signals ece' }))).toEqual(['scope']);
    expect(ids(filterEquipment(equipment, { query: 'acid signals' }))).toEqual([]);
  });

  it('filters by department, category and access level', () => {
    expect(ids(filterEquipment(equipment, { department: 'ECE' }))).toEqual(['scope']);
    expect(ids(filterEquipment(equipment, { category: 'Glassware' }))).toEqual(['flask']);
    expect(ids(filterEquipment(equipment, { accessLevel: 'approval' }))).toEqual(['scope']);
  });

  it('filters by "free on" using remaining capacity', () => {
    expect(ids(filterEquipment(equipment, { freeOn: '2026-11-24' }, availability))).toEqual([
      'scope',
    ]);
  });
});

describe('isFreeOn', () => {
  it('is false when every hour is full and true when data is missing', () => {
    expect(isFreeOn(equipment[0], availability, '2026-11-24')).toBe(false);
    expect(isFreeOn(equipment[0], availability, '2026-11-25')).toBe(true);
  });
});

describe('suggestEquipment', () => {
  const list = [
    { id: 'beaker', name: 'Beaker set', category: 'Glassware', tags: ['mixing'], status: 'active' },
    {
      id: 'flask250',
      name: 'Round-bottom flask 250 mL',
      category: 'Glassware',
      tags: ['acid'],
      status: 'active',
    },
    {
      id: 'flask500',
      name: 'Flask 500 mL',
      category: 'Glassware',
      tags: ['acid'],
      status: 'active',
    },
    {
      id: 'mantle',
      name: 'Heating mantle',
      category: 'Heating',
      tags: ['flask', 'acid'],
      status: 'active',
    },
    { id: 'old', name: 'Flask (broken)', category: 'Glassware', tags: [], status: 'disabled' },
    { id: 'idea', name: 'Flask washer', category: 'Glassware', tags: [], status: 'proposed' },
    {
      id: 'scope',
      name: 'Digital Oscilloscope',
      category: 'Measurement',
      tags: ['signals'],
      status: 'active',
    },
  ];
  const ids = (items) => items.map((item) => item.id);

  it('returns nothing for an empty or blank query', () => {
    expect(suggestEquipment('', list)).toEqual([]);
    expect(suggestEquipment('   ', list)).toEqual([]);
    expect(suggestEquipment(undefined, list)).toEqual([]);
  });

  it('ranks names starting with the query above names containing it, then tag matches', () => {
    expect(ids(suggestEquipment('FLASK', list))).toEqual(['flask500', 'flask250', 'mantle']);
  });

  it('matches tags and then category', () => {
    expect(ids(suggestEquipment('signals', list))).toEqual(['scope']);
    expect(ids(suggestEquipment('measure', list))).toEqual(['scope']);
    expect(ids(suggestEquipment('glass', list))).toEqual(['beaker', 'flask250', 'flask500']);
  });

  it('never suggests disabled or proposed items', () => {
    expect(ids(suggestEquipment('flask', list))).not.toContain('old');
    expect(ids(suggestEquipment('washer', list))).toEqual([]);
  });

  it('respects the limit (default 8)', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `k${i}`,
      name: `Kit ${i}`,
      category: 'Dev Kit',
      tags: [],
    }));
    expect(suggestEquipment('kit', many)).toHaveLength(8);
    expect(ids(suggestEquipment('kit', many, 2))).toEqual(['k0', 'k1']);
  });

  it('returns an empty list when nothing matches', () => {
    expect(suggestEquipment('time machine', list)).toEqual([]);
  });
});
