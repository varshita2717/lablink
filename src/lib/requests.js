// Projects and access requests (Firestore): create, load, approve, reject, confirm allocation.
// FAST TRACK: no audit log and no "request changes" (Approve and Reject only).
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import {
  FAIRNESS_LOOKBACK_DAYS,
  MAX_COMMENT,
  MAX_DAYS_AHEAD,
  MAX_ITEMS_PER_PLAN,
  MAX_JUSTIFICATION,
  MAX_SESSIONS_PER_REQUEST,
} from './config.js';
import { AppError, ERROR_CODES, isAppError } from './errors.js';
import { addDays, horizonDates } from './dates.js';
import { collectSafetyNotes, needsApproval } from './access.js';
import { bookPlan, hoursByDate, loadAvailability, loadConfirmedBookings } from './booking.js';
import { buildSubstitutes, loadActiveEquipment } from './inventory.js';
import { countDistinctHours, findConflictGroups, resolveGroup } from './conflicts.js';
import { planSessions } from './planner.js';
import { validateDraftProjectArgs } from './validate.js';
import { loadFaculty } from './users.js';

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

const toList = (snapshot) =>
  snapshot.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, createdAt: data.createdAt?.toMillis?.() ?? 0 };
  });

// ---------------------------------------------------------------- loaders

/**
 * Loads a student's projects, newest first.
 * @param {string} uid
 * @returns {Promise<object[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export async function loadMyProjects(uid) {
  return toList(
    await getDocs(
      query(collection(db, 'projects'), where('ownerUid', '==', uid), orderBy('createdAt', 'desc')),
    ),
  );
}

/**
 * Loads a student's requests, newest first.
 * @param {string} uid
 * @returns {Promise<object[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export async function loadMyRequests(uid) {
  return toList(
    await getDocs(
      query(
        collection(db, 'requests'),
        where('studentUid', '==', uid),
        orderBy('createdAt', 'desc'),
      ),
    ),
  );
}

/**
 * Loads all pending requests, oldest first (staff only, by rules).
 * @returns {Promise<object[]>} Requests with numeric `createdAt` (milliseconds).
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export async function loadPendingRequests() {
  return toList(
    await getDocs(
      query(
        collection(db, 'requests'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'asc'),
      ),
    ),
  );
}

/**
 * Loads everything the approval queue and Conflicts page need, with one availability query.
 * @param {string} today
 * @returns {Promise<{ pending: object[], equipment: object[], equipmentById: object,
 *   availability: object, groups: { requestIds: string[], conflictedKeys: string[] }[] }>}
 * @throws {FirebaseError} If a query is rejected.
 */
export async function loadConflictContext(today) {
  const [pending, equipment] = await Promise.all([loadPendingRequests(), loadActiveEquipment()]);
  const equipmentById = byId(equipment);
  const involvedIds = new Set(pending.flatMap((r) => r.items.map((i) => i.equipmentId)));
  const involved = equipment.filter((item) => involvedIds.has(item.id));
  const availability = await loadAvailability(involved, horizonDates(today));
  const groups = findConflictGroups(pending, equipmentById, availability);
  return { pending, equipment, equipmentById, availability, groups };
}

/**
 * Loads each student's recent usage (fairness) and booked hours over the horizon (planning).
 * @param {string[]} studentUids
 * @param {string} today
 * @returns {Promise<{ hoursUsed30dByStudent: Record<string, number>,
 *   userHoursByStudent: Record<string, Record<string, number[]>> }>}
 * @throws {FirebaseError} If a query is rejected.
 */
export async function loadStudentContext(studentUids, today) {
  const from = addDays(today, -FAIRNESS_LOOKBACK_DAYS);
  const to = addDays(today, MAX_DAYS_AHEAD);
  const uids = [...new Set(studentUids)];
  const bookings = await Promise.all(uids.map((uid) => loadConfirmedBookings(uid, from, to)));
  const hoursUsed30dByStudent = {};
  const userHoursByStudent = {};
  uids.forEach((uid, i) => {
    hoursUsed30dByStudent[uid] = countDistinctHours(bookings[i], from, today);
    userHoursByStudent[uid] = hoursByDate(bookings[i].filter((b) => b.date > today));
  });
  return { hoursUsed30dByStudent, userHoursByStudent };
}

// ---------------------------------------------------------------- writers

/**
 * Creates a pending access request from a plan built by code (never by the model).
 * @param {{ user: { uid: string, name: string }, project: object,
 *           items: { equipment: object, qty: number }[], sessions: object[],
 *           justification: string, experiment?: object | null }} input
 * @returns {Promise<string>} The new request ID.
 * @throws {AppError} INVALID_INPUT for bad counts or text; FirebaseError if rules reject it.
 */
export async function createRequest({
  user,
  project,
  items,
  sessions,
  justification,
  experiment = null,
}) {
  if (items.length < 1 || items.length > MAX_ITEMS_PER_PLAN)
    throw new AppError(ERROR_CODES.INVALID_INPUT);
  if (sessions.length < 1 || sessions.length > MAX_SESSIONS_PER_REQUEST) {
    throw new AppError(ERROR_CODES.INVALID_INPUT);
  }
  const text = String(justification ?? '')
    .trim()
    .slice(0, MAX_JUSTIFICATION);
  const notes = collectSafetyNotes(
    items.map((i) => i.equipment),
    experiment,
  );
  const ref = doc(collection(db, 'requests'));
  await setDoc(ref, {
    projectId: project.id,
    projectTitle: project.title,
    studentUid: user.uid,
    studentName: user.name,
    facultyUid: project.facultyGuideUid,
    items: items.map(({ equipment, qty }) => ({
      equipmentId: equipment.id,
      equipmentName: equipment.name,
      qty,
    })),
    sessions: sessions.map(({ date, startHour, endHour }) => ({ date, startHour, endHour })),
    justification: text,
    deadline: project.deadline,
    stage: project.stage,
    hazardNote: notes.join(' '),
    status: 'pending',
    score: null,
    scoreBreakdown: null,
    alternatives: [],
    facultyComment: '',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Booking entries for every item in every session of a request. */
function entriesFor(request, equipmentById) {
  return request.sessions.flatMap((session) =>
    request.items.map((item) => {
      const equipment = equipmentById[item.equipmentId];
      if (!equipment) throw new AppError(ERROR_CODES.EQUIPMENT_INACTIVE, item.equipmentId);
      return { equipment, ...session, qty: item.qty };
    }),
  );
}

const decision = (staff) => ({ decidedByUid: staff.uid, decidedAt: serverTimestamp() });
const breakdown = (score) => (score ? { score: score.total, scoreBreakdown: score } : {});

/** Books a request's plan and marks it approved in the same transaction. */
function bookRequest(request, equipmentById, staff, score = null) {
  return bookPlan({
    user: { uid: request.studentUid, name: request.studentName },
    requestId: request.id,
    projectId: request.projectId,
    entries: entriesFor(request, equipmentById),
    additionalWrites: (tx) =>
      tx.update(doc(db, 'requests', request.id), {
        status: 'approved',
        ...breakdown(score),
        ...decision(staff),
      }),
  });
}

/** Fresh alternatives for a request that could not be booked. */
async function freshAlternatives(request, equipment, today) {
  const ids = request.items.map((i) => i.equipmentId);
  const substitutes = buildSubstitutes(equipment, ids);
  const relevant = new Set([
    ...ids,
    ...Object.values(substitutes)
      .flat()
      .map((s) => s.equipmentId),
  ]);
  const availability = await loadAvailability(
    equipment.filter((item) => relevant.has(item.id)),
    horizonDates(today),
  );
  const { userHoursByStudent } = await loadStudentContext([request.studentUid], today);
  const first = request.sessions[0];
  const plan = planSessions({
    items: request.items.map(({ equipmentId, qty }) => ({ equipmentId, qty })),
    sessionHours: first.endHour - first.startHour,
    totalSessions: request.sessions.length,
    maxPerWeek: request.sessions.length,
    deadline: request.deadline,
    today,
    availability,
    userHoursByDate: userHoursByStudent[request.studentUid],
    substitutes,
  });
  return { sessions: plan.sessions, substitutions: plan.substitutions, complete: plan.complete };
}

/**
 * Approves a non-conflicted request: books all its items and sessions atomically with the status
 * change. On SLOT_FULL it marks the request `conflict_lost` with fresh alternatives instead.
 * @param {object} request A pending request (from loadPendingRequests).
 * @param {{ uid: string }} staff The signed-in faculty or admin.
 * @param {string} today
 * @returns {Promise<{ status: 'approved' | 'conflict_lost', alternatives?: object }>}
 * @throws {AppError | FirebaseError} Any error other than SLOT_FULL.
 */
export async function approveRequest(request, staff, today) {
  const equipment = await loadActiveEquipment();
  const equipmentById = byId(equipment);
  try {
    await bookRequest(request, equipmentById, staff);
    return { status: 'approved' };
  } catch (error) {
    if (!isAppError(error, ERROR_CODES.SLOT_FULL)) throw error;
    const alternatives = await freshAlternatives(request, equipment, today);
    await updateDoc(doc(db, 'requests', request.id), {
      status: 'conflict_lost',
      alternatives,
      ...decision(staff),
    });
    return { status: 'conflict_lost', alternatives };
  }
}

/**
 * Rejects a request with a required comment.
 * @param {string} requestId
 * @param {{ uid: string }} staff
 * @param {string} comment 1 to MAX_COMMENT characters after trimming.
 * @returns {Promise<void>}
 * @throws {AppError} INVALID_INPUT for an empty or too-long comment; FirebaseError if rejected.
 */
export async function rejectRequest(requestId, staff, comment) {
  const text = String(comment ?? '').trim();
  if (text.length === 0 || text.length > MAX_COMMENT) throw new AppError(ERROR_CODES.INVALID_INPUT);
  await updateDoc(doc(db, 'requests', requestId), {
    status: 'rejected',
    facultyComment: text,
    ...decision(staff),
  });
}

/**
 * Resolves one conflict group with the formula (PURE resolveGroup over loaded data).
 * @param {object[]} requests The group's pending requests.
 * @param {object} context From loadConflictContext.
 * @param {string} today
 * @returns {Promise<{ ranking: object[] }>}
 * @throws {FirebaseError} If a query is rejected.
 */
export async function resolveConflict(requests, context, today) {
  const ids = requests.flatMap((r) => r.items.map((i) => i.equipmentId));
  const substitutes = buildSubstitutes(context.equipment, ids);
  const substituteIds = Object.values(substitutes)
    .flat()
    .map((s) => s.equipmentId);
  const extra = context.equipment.filter(
    (item) => substituteIds.includes(item.id) && !context.availability[item.id],
  );
  const availability = {
    ...context.availability,
    ...(await loadAvailability(extra, horizonDates(today))),
  };
  const students = await loadStudentContext(
    requests.map((r) => r.studentUid),
    today,
  );
  return resolveGroup({ requests, availability, substitutes, today, ...students });
}

/**
 * Confirms an allocation: books each winner (approved, with scores) in rank order, then marks
 * losers `conflict_lost` with scores and alternatives in one batch. A winner that hits SLOT_FULL
 * becomes a loser with fresh alternatives.
 * @param {{ ranking: object[] }} resolution From resolveConflict.
 * @param {Record<string, object>} requestsById
 * @param {{ uid: string }} staff
 * @param {string} today
 * @returns {Promise<{ approved: string[], lost: string[], failedWinners: string[] }>}
 * @throws {AppError | FirebaseError} Any error other than SLOT_FULL.
 */
export async function confirmAllocation(resolution, requestsById, staff, today) {
  const equipment = await loadActiveEquipment();
  const equipmentById = byId(equipment);
  const approved = [];
  const failedWinners = [];
  const losers = resolution.ranking.filter((entry) => !entry.isWinner);
  for (const entry of resolution.ranking.filter((e) => e.isWinner)) {
    try {
      await bookRequest(requestsById[entry.requestId], equipmentById, staff, entry.score);
      approved.push(entry.requestId);
    } catch (error) {
      if (!isAppError(error, ERROR_CODES.SLOT_FULL)) throw error;
      const request = requestsById[entry.requestId];
      failedWinners.push(entry.requestId);
      losers.push({ ...entry, alternatives: await freshAlternatives(request, equipment, today) });
    }
  }
  if (losers.length) {
    const batch = writeBatch(db);
    for (const entry of losers) {
      batch.update(doc(db, 'requests', entry.requestId), {
        status: 'conflict_lost',
        ...breakdown(entry.score),
        alternatives: entry.alternatives,
        ...decision(staff),
      });
    }
    await batch.commit();
  }
  return { approved, lost: losers.map((e) => e.requestId), failedWinners };
}

// ---------------------------------------------------------------- chat Confirm handlers

/**
 * Creates a project from a confirmed ProjectDraftCard. Re-validates the draft and the guide.
 * @param {{ uid: string, name: string }} user The signed-in student.
 * @param {{ title: string, description: string, deadline: string, stage: string,
 *           facultyGuideUid: string }} draft
 * @param {string} today
 * @returns {Promise<string>} The new project ID.
 * @throws {AppError} INVALID_INPUT for a bad draft or unknown guide; FirebaseError if rejected.
 */
export async function createProject(user, draft, today) {
  const valid = validateDraftProjectArgs(draft, today);
  const guide = (await loadFaculty()).find((member) => member.uid === draft.facultyGuideUid);
  if (!guide) throw new AppError(ERROR_CODES.INVALID_INPUT, 'Unknown faculty guide');
  const ref = doc(collection(db, 'projects'));
  await setDoc(ref, {
    title: valid.title,
    description: valid.description,
    ownerUid: user.uid,
    ownerName: user.name,
    facultyGuideUid: guide.uid,
    facultyGuideName: guide.name,
    deadline: valid.deadline,
    stage: valid.stage,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Confirms a PlanCard (SPEC 13.4). needsApproval is recomputed from current data: if any item
 * needs approval the whole plan becomes one pending request; otherwise it is booked directly.
 * @param {{ project: { id: string }, items: { equipmentId: string, qty: number }[],
 *           sessions: object[], justification: string }} plan Built by code from stored planner output.
 * @param {{ uid: string, name: string }} user
 * @returns {Promise<{ type: 'request', requestId: string } | { type: 'booked', bookingIds: string[] }>}
 * @throws {AppError} NOT_AUTHORIZED for someone else's project; EQUIPMENT_INACTIVE; booking errors.
 */
export async function confirmPlan(plan, user) {
  const [equipment, projects] = await Promise.all([
    loadActiveEquipment(),
    loadMyProjects(user.uid),
  ]);
  const project = byId(projects)[plan.project.id];
  if (!project) throw new AppError(ERROR_CODES.NOT_AUTHORIZED, 'Not your project');
  const equipmentById = byId(equipment);
  const items = plan.items.map(({ equipmentId, qty }) => {
    const item = equipmentById[equipmentId];
    if (!item) throw new AppError(ERROR_CODES.EQUIPMENT_INACTIVE, equipmentId);
    return { equipment: item, qty };
  });
  if (needsApproval(items.map((i) => i.equipment))) {
    const requestId = await createRequest({
      user,
      project,
      items,
      sessions: plan.sessions,
      justification: plan.justification,
    });
    return { type: 'request', requestId };
  }
  const entries = plan.sessions.flatMap((session) =>
    items.map(({ equipment: item, qty }) => ({ equipment: item, ...session, qty })),
  );
  const bookingIds = await bookPlan({ user, projectId: project.id, entries });
  return { type: 'booked', bookingIds };
}
