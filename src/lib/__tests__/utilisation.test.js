import { describe, expect, it } from 'vitest';
import { computeUtilisation, utilisationLabel } from '../utilisation.js';

const hoursArray = (remaining) => {
  const arr = [];
  for (let h = 9; h < 17; h += 1) arr[h] = remaining;
  return arr;
};

describe('utilisationLabel', () => {
  it('labels by threshold', () => {
    expect(utilisationLabel(0)).toBe('Quiet');
    expect(utilisationLabel(0.19)).toBe('Quiet');
    expect(utilisationLabel(0.2)).toBe('Moderate');
    expect(utilisationLabel(0.69)).toBe('Moderate');
    expect(utilisationLabel(0.7)).toBe('Busy');
    expect(utilisationLabel(1)).toBe('Busy');
  });
});

describe('computeUtilisation', () => {
  const equipment = [
    { id: 'flask', name: 'Flask', quantity: 10 },
    { id: 'scope', name: 'Scope', quantity: 1 },
  ];
  const dates = ['2026-11-24', '2026-11-25'];

  it('computes booked hours, capacity, rate and label', () => {
    const availability = {
      flask: { '2026-11-24': hoursArray(0), '2026-11-25': hoursArray(0) },
      scope: { '2026-11-24': hoursArray(1), '2026-11-25': [...hoursArray(1).slice(0, 10), 0, 0] },
    };
    const [flask, scope] = computeUtilisation({ equipment, availability, dates });
    expect(flask).toEqual({
      equipmentId: 'flask',
      name: 'Flask',
      bookedHours: 160,
      capacityHours: 160,
      rate: 1,
      label: 'Busy',
    });
    // 2 of 16 scope-hours booked (10:00 and 11:00 on the 25th; later hours missing = free).
    expect(scope.bookedHours).toBe(2);
    expect(scope.capacityHours).toBe(16);
    expect(scope.rate).toBe(0.125);
    expect(scope.label).toBe('Quiet');
  });

  it('treats missing availability as nothing booked', () => {
    const [flask] = computeUtilisation({ equipment, availability: {}, dates });
    expect(flask.bookedHours).toBe(0);
    expect(flask.rate).toBe(0);
    expect(flask.label).toBe('Quiet');
  });

  it('handles empty data without dividing by zero', () => {
    expect(computeUtilisation({ equipment: [], availability: {}, dates })).toEqual([]);
    const [flask] = computeUtilisation({ equipment, availability: {}, dates: [] });
    expect(flask.capacityHours).toBe(0);
    expect(flask.rate).toBe(0);
    expect(flask.label).toBe('Quiet');
  });
});
