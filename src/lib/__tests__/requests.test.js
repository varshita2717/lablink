import { beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmAllocation, rejectRequest } from '../requests.js';
import { bookPlan } from '../booking.js';
import { AppError, ERROR_CODES } from '../errors.js';
import { updateDoc, writeBatch } from 'firebase/firestore';

const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue() };
vi.mock('../firebase.js', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, name, id) => ({ path: `${name}/${id}` })),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  serverTimestamp: () => 'now',
  setDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(),
  where: vi.fn(),
  writeBatch: vi.fn(() => batch),
}));
vi.mock('../booking.js', () => ({
  bookPlan: vi.fn(),
  hoursByDate: vi.fn(() => ({})),
  loadAvailability: vi.fn(async () => ({})),
  loadConfirmedBookings: vi.fn(async () => []),
}));
vi.mock('../inventory.js', () => ({
  buildSubstitutes: vi.fn(() => ({})),
  loadActiveEquipment: vi.fn(async () => [
    { id: 'eq-oscilloscope', name: 'Digital Oscilloscope', quantity: 1, status: 'active' },
  ]),
}));

const TODAY = '2026-11-23';
const request = (id, studentName) => ({
  id,
  projectId: `p-${id}`,
  projectTitle: `Project ${id}`,
  studentUid: `u-${id}`,
  studentName,
  items: [{ equipmentId: 'eq-oscilloscope', equipmentName: 'Digital Oscilloscope', qty: 1 }],
  sessions: [{ date: '2026-11-24', startHour: 10, endHour: 12 }],
  deadline: '2026-11-30',
  stage: 'prototype',
});
const requestsById = {
  aarav: request('aarav', 'Aarav Sharma'),
  rohan: request('rohan', 'Rohan Das'),
  meera: request('meera', 'Meera Iyer'),
};
const entry = (id, rank, isWinner) => ({
  requestId: id,
  rank,
  isWinner,
  score: { urgency: 0.5, fairness: 0.5, stage: 0.7, total: 0.5 },
  alternatives: isWinner ? null : { sessions: [], substitutions: [], complete: false },
});
const resolution = {
  ranking: [entry('aarav', 1, true), entry('rohan', 2, false), entry('meera', 3, false)],
};
const staff = { uid: 'faculty-1' };

describe('confirmAllocation', () => {
  beforeEach(() => {
    vi.mocked(bookPlan).mockReset();
    batch.update.mockClear();
    batch.commit.mockClear();
  });

  it('books the winner only, with the approval in the same transaction, and marks losers in one batch', async () => {
    vi.mocked(bookPlan).mockResolvedValue(['b1']);
    const result = await confirmAllocation(resolution, requestsById, staff, TODAY);
    expect(result).toEqual({ approved: ['aarav'], lost: ['rohan', 'meera'], failedWinners: [] });
    expect(bookPlan).toHaveBeenCalledTimes(1);
    const call = vi.mocked(bookPlan).mock.calls[0][0];
    expect(call.user).toEqual({ uid: 'u-aarav', name: 'Aarav Sharma' });
    expect(call.requestId).toBe('aarav');
    expect(call.entries).toHaveLength(1);
    const tx = { update: vi.fn() };
    call.additionalWrites(tx);
    expect(tx.update).toHaveBeenCalledWith(
      { path: 'requests/aarav' },
      expect.objectContaining({ status: 'approved', score: 0.5, decidedByUid: 'faculty-1' }),
    );
    expect(writeBatch).toHaveBeenCalledTimes(1);
    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.update).toHaveBeenCalledWith(
      { path: 'requests/rohan' },
      expect.objectContaining({ status: 'conflict_lost', alternatives: expect.any(Object) }),
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('turns a winner whose slot was taken into a loser with fresh alternatives', async () => {
    vi.mocked(bookPlan).mockRejectedValue(new AppError(ERROR_CODES.SLOT_FULL));
    const result = await confirmAllocation(resolution, requestsById, staff, TODAY);
    expect(result.approved).toEqual([]);
    expect(result.failedWinners).toEqual(['aarav']);
    expect(result.lost).toEqual(['rohan', 'meera', 'aarav']);
    expect(batch.update).toHaveBeenCalledTimes(3);
  });

  it('rethrows other errors without writing losers', async () => {
    vi.mocked(bookPlan).mockRejectedValue(new AppError(ERROR_CODES.NOT_AUTHORIZED));
    await expect(confirmAllocation(resolution, requestsById, staff, TODAY)).rejects.toMatchObject({
      code: ERROR_CODES.NOT_AUTHORIZED,
    });
    expect(batch.commit).not.toHaveBeenCalled();
  });
});

describe('rejectRequest', () => {
  it('requires a non-empty comment of at most 500 characters', async () => {
    await expect(rejectRequest('r1', staff, '   ')).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT,
    });
    await expect(rejectRequest('r1', staff, 'x'.repeat(501))).rejects.toMatchObject({
      code: ERROR_CODES.INVALID_INPUT,
    });
    await rejectRequest('r1', staff, ' Use Friday. ');
    expect(updateDoc).toHaveBeenCalledWith(
      { path: 'requests/r1' },
      expect.objectContaining({
        status: 'rejected',
        facultyComment: 'Use Friday.',
        decidedByUid: 'faculty-1',
      }),
    );
  });
});
