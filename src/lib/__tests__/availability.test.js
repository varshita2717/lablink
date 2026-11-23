import { describe, expect, it, vi } from 'vitest';
import { buildAvailability } from '../booking.js';

vi.mock('../firebase.js', () => ({ db: {} }));

describe('buildAvailability', () => {
  const equipment = [{ id: 'scope', quantity: 2 }];
  const dates = ['2026-11-24', '2026-11-25'];

  it('subtracts booked units per hour and treats missing docs and hours as free', () => {
    const availability = buildAvailability(equipment, dates, [
      { equipmentId: 'scope', date: '2026-11-24', hours: { 10: 1, 11: 2 } },
      { equipmentId: 'other', date: '2026-11-24', hours: { 10: 1 } },
    ]);
    const day = availability.scope['2026-11-24'];
    expect(day[9]).toBe(2);
    expect(day[10]).toBe(1);
    expect(day[11]).toBe(0);
    expect(day[16]).toBe(2);
    expect(day).toHaveLength(17);
    expect(availability.scope['2026-11-25'][10]).toBe(2);
    expect(availability.other).toBeUndefined();
  });

  it('never goes below zero', () => {
    const availability = buildAvailability(equipment, dates, [
      { equipmentId: 'scope', date: '2026-11-25', hours: { 9: 5 } },
    ]);
    expect(availability.scope['2026-11-25'][9]).toBe(0);
  });
});
