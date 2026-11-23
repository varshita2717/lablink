import { describe, expect, it, vi } from 'vitest';
import { buildSeedData } from '../seed.js';
import { horizonDates, nextWorkingDay, daysBetween } from '../dates.js';
import { CATEGORIES, MAX_HOURS_PER_DAY, SLOT_END_HOUR, SLOT_START_HOUR } from '../config.js';

vi.mock('../firebase.js', () => ({ db: {} }));
vi.mock('../inventory.js', () => ({ invalidateInventory: () => {} }));

const TODAY = '2026-11-23';
const data = buildSeedData(TODAY);
const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));
const EQUIPMENT_FIELDS = [
  'name',
  'category',
  'description',
  'tags',
  'labId',
  'labName',
  'department',
  'quantity',
  'accessLevel',
  'hazardLevel',
  'safetyNote',
  'equivalentGroup',
  'status',
  'proposedByUid',
  'proposedByName',
  'reason',
];

describe('buildSeedData: reference data', () => {
  it('has 6 labs in 4 departments, 6 users, 18 equipment items and 8 experiments', () => {
    expect(data.labs).toHaveLength(6);
    expect(new Set(data.labs.map((lab) => lab.department))).toEqual(
      new Set(['ECE', 'CSE-AIML', 'Mechanical', 'Chemistry']),
    );
    expect(data.users.map((u) => u.id)).toContain('seed-aarav');
    expect(byId(data.users)['seed-kavita']).toMatchObject({
      name: 'Dr. Kavita Rao',
      role: 'faculty',
    });
    expect(data.equipment).toHaveLength(18);
    expect(data.experiments).toHaveLength(8);
  });

  it('matches the rules shape and the hazard invariant for every equipment item', () => {
    for (const item of data.equipment) {
      const { id, ...fields } = item;
      expect(id).toBeTruthy();
      expect(Object.keys(fields).every((key) => EQUIPMENT_FIELDS.includes(key))).toBe(true);
      expect(item.name.length).toBeLessThanOrEqual(100);
      expect(item.description.length).toBeLessThanOrEqual(500);
      expect(item.tags.length).toBeLessThanOrEqual(20);
      expect(CATEGORIES).toContain(item.category);
      expect(Number.isInteger(item.quantity) && item.quantity >= 1).toBe(true);
      expect(item.status).toBe('active');
      if (item.hazardLevel === 'high') expect(item.accessLevel).toBe('approval');
      if (item.hazardLevel !== 'none') expect(item.safetyNote).not.toBe('');
    }
  });

  it('covers all three kinds: equipment, dev kits and workstations', () => {
    const categories = new Set(data.equipment.map((item) => item.category));
    expect(categories).toContain('Dev Kit');
    expect(categories).toContain('Workstation');
    expect(categories).toContain('Measurement');
  });

  it('makes the two flasks substitutes and keeps experiment equipment real', () => {
    const equipment = byId(data.equipment);
    expect(equipment['eq-flask-250'].equivalentGroup).toBe('round-bottom-flask');
    expect(equipment['eq-flask-500'].equivalentGroup).toBe('round-bottom-flask');
    for (const exp of data.experiments) {
      for (const need of exp.requiredEquipment) expect(equipment[need.equipmentId]).toBeDefined();
    }
    const acid = byId(data.experiments)['exp-acid-heating'];
    expect(acid.hazardLevel).toBe('high');
    expect(acid.typicalSessionHours).toBe(3);
  });
});

describe('buildSeedData: flask substitution demo', () => {
  it('books the 250 mL flask out on every hour of every horizon working day', () => {
    expect(data.slots.map((s) => s.date)).toEqual(horizonDates(TODAY));
    for (const slot of data.slots) {
      expect(slot.id).toBe(`eq-flask-250_${slot.date}`);
      for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
        expect(slot.hours[String(hour)]).toBe(10);
      }
    }
  });
});

describe('buildSeedData: oscilloscope conflict', () => {
  const projects = byId(data.projects);

  it('creates three pending oscilloscope requests on the next working day, 10:00-12:00', () => {
    expect(data.requests).toHaveLength(3);
    for (const request of data.requests) {
      expect(request.status).toBe('pending');
      expect(request.score).toBeNull();
      expect(request.items).toEqual([
        { equipmentId: 'eq-oscilloscope', equipmentName: 'Digital Oscilloscope', qty: 1 },
      ]);
      expect(request.sessions).toEqual([
        { date: nextWorkingDay(TODAY), startHour: 10, endHour: 12 },
      ]);
      expect(projects[request.projectId].ownerUid).toBe(request.studentUid);
      expect(request.facultyUid).toBe('seed-anil');
    }
  });

  it.each([
    ['seed-aarav', 'final', 3, 2],
    ['seed-rohan', 'prototype', 7, 5],
    ['seed-meera', 'prototype', 10, 15],
  ])(
    'gives %s stage %s, deadline today+%i and %i distinct past hours',
    (uid, stage, days, hours) => {
      const request = data.requests.find((r) => r.studentUid === uid);
      expect(request.stage).toBe(stage);
      expect(daysBetween(TODAY, request.deadline)).toBe(days);
      const bookings = data.bookings.filter((b) => b.userUid === uid);
      const distinct = new Set();
      for (const b of bookings) {
        expect(b.status).toBe('confirmed');
        expect(daysBetween(b.date, TODAY)).toBeGreaterThan(0);
        expect(daysBetween(b.date, TODAY)).toBeLessThanOrEqual(30);
        expect(b.endHour - b.startHour).toBeLessThanOrEqual(MAX_HOURS_PER_DAY);
        for (let h = b.startHour; h < b.endHour; h += 1) distinct.add(`${b.date}|${h}`);
      }
      expect(distinct.size).toBe(hours);
    },
  );
});
