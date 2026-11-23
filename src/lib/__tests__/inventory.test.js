import { describe, expect, it, vi } from 'vitest';
import { filterEquipment, isFreeOn } from '../inventory.js';

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
