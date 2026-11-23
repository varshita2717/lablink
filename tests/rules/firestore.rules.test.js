// @vitest-environment node
// Firestore security rules (SPEC Appendix A), minimum cases from Section 2.4.1.
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

let env;

const user = (name, role) => ({ name, role, department: '', createdAt: serverTimestamp() });
const equipment = (overrides = {}) => ({
  name: 'Digital Oscilloscope',
  category: 'Measurement',
  description: 'Scope',
  tags: [],
  labId: 'lab-signals',
  labName: 'Signals Lab',
  department: 'ECE',
  quantity: 1,
  accessLevel: 'approval',
  hazardLevel: 'none',
  safetyNote: '',
  equivalentGroup: null,
  status: 'active',
  createdAt: serverTimestamp(),
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lablink',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'config/app'), { demoMode: true });
    await setDoc(doc(db, 'users/alice'), user('Alice', 'student'));
    await setDoc(doc(db, 'users/bob'), user('Bob', 'student'));
    await setDoc(doc(db, 'users/fac'), user('Dr. Rao', 'faculty'));
    await setDoc(doc(db, 'users/admin'), user('Lab Admin', 'admin'));
    await setDoc(doc(db, 'equipment/scope'), equipment());
    await setDoc(doc(db, 'bookings/bob-1'), {
      equipmentId: 'scope',
      equipmentName: 'Digital Oscilloscope',
      date: '2026-11-24',
      startHour: 10,
      endHour: 12,
      qty: 1,
      userUid: 'bob',
      userName: 'Bob',
      requestId: null,
      projectId: null,
      status: 'confirmed',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'requests/alice-1'), {
      projectId: 'p1',
      projectTitle: 'Radar',
      studentUid: 'alice',
      studentName: 'Alice',
      facultyUid: 'fac',
      items: [{ equipmentId: 'scope', equipmentName: 'Digital Oscilloscope', qty: 1 }],
      sessions: [{ date: '2026-11-24', startHour: 10, endHour: 12 }],
      justification: '',
      deadline: '2026-11-30',
      stage: 'final',
      hazardNote: '',
      status: 'pending',
      score: null,
      scoreBreakdown: null,
      alternatives: [],
      facultyComment: '',
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'auditLog/entry-1'), {
      action: 'REQUEST_APPROVED',
      actorUid: 'fac',
      actorName: 'Dr. Rao',
      targetType: 'request',
      targetId: 'alice-1',
      details: {},
      formulaVersion: '1.0',
      createdAt: serverTimestamp(),
    });
  });
});

const as = (uid) => env.authenticatedContext(uid).firestore();

describe('reads', () => {
  it('denies unauthenticated reads', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'equipment/scope')));
    await assertSucceeds(getDoc(doc(as('alice'), 'equipment/scope')));
  });

  it("denies a student reading another student's booking", async () => {
    await assertFails(getDoc(doc(as('alice'), 'bookings/bob-1')));
    await assertSucceeds(getDoc(doc(as('bob'), 'bookings/bob-1')));
    await assertSucceeds(getDoc(doc(as('fac'), 'bookings/bob-1')));
  });
});

describe('users', () => {
  it('denies a student creating their own user doc as admin; allows it as student', async () => {
    const db = as('newbie');
    await assertFails(setDoc(doc(db, 'users/newbie'), user('New', 'admin')));
    await assertSucceeds(setDoc(doc(db, 'users/newbie'), user('New', 'student')));
  });

  it('allows a role switch only when demoMode is true', async () => {
    await assertSucceeds(updateDoc(doc(as('alice'), 'users/alice'), { role: 'faculty' }));
    await env.withSecurityRulesDisabled((context) =>
      setDoc(doc(context.firestore(), 'config/app'), { demoMode: false }),
    );
    await assertFails(updateDoc(doc(as('bob'), 'users/bob'), { role: 'admin' }));
  });
});

describe('requests', () => {
  it("denies a student setting a request's status; allows staff", async () => {
    await assertFails(updateDoc(doc(as('alice'), 'requests/alice-1'), { status: 'approved' }));
    await assertSucceeds(updateDoc(doc(as('fac'), 'requests/alice-1'), { status: 'approved' }));
  });
});

describe('slots', () => {
  const slot = (hours) => ({
    equipmentId: 'scope',
    date: '2026-11-24',
    hours,
    updatedAt: serverTimestamp(),
  });

  it('denies a slot hours value greater than the equipment quantity', async () => {
    await assertFails(setDoc(doc(as('alice'), 'slots/scope_2026-11-24'), slot({ 10: 2 })));
    await assertSucceeds(setDoc(doc(as('alice'), 'slots/scope_2026-11-24'), slot({ 10: 1 })));
  });
});

describe('equipment', () => {
  it('denies high hazard with open access (hazard invariant), even for admins', async () => {
    await assertFails(
      setDoc(
        doc(as('admin'), 'equipment/mantle'),
        equipment({ hazardLevel: 'high', accessLevel: 'open' }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(as('admin'), 'equipment/mantle'),
        equipment({ hazardLevel: 'high', accessLevel: 'approval' }),
      ),
    );
  });

  it('allows a proposal only with status "proposed" and accessLevel "approval"', async () => {
    const proposal = (overrides = {}) => ({
      name: 'Spectrometer',
      description: 'For optics',
      category: 'Measurement',
      reason: 'Needed for my project',
      status: 'proposed',
      accessLevel: 'approval',
      proposedByUid: 'alice',
      proposedByName: 'Alice',
      createdAt: serverTimestamp(),
      ...overrides,
    });
    const db = as('alice');
    await assertFails(setDoc(doc(db, 'equipment/p1'), proposal({ status: 'active' })));
    await assertFails(setDoc(doc(db, 'equipment/p2'), proposal({ accessLevel: 'open' })));
    await assertSucceeds(setDoc(doc(db, 'equipment/p3'), proposal()));
  });
});

describe('append-only and no-delete data', () => {
  it('denies any update or delete of auditLog', async () => {
    await assertFails(updateDoc(doc(as('fac'), 'auditLog/entry-1'), { action: 'EDITED' }));
    await assertFails(deleteDoc(doc(as('admin'), 'auditLog/entry-1')));
  });

  it('denies deletes on bookings', async () => {
    await assertFails(deleteDoc(doc(as('bob'), 'bookings/bob-1')));
    await assertFails(deleteDoc(doc(as('admin'), 'bookings/bob-1')));
  });
});
