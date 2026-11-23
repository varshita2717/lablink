// Firestore access for user profiles and the console-managed demo flag.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { MAX_NAME, ROLES } from './config.js';
import { AppError, ERROR_CODES } from './errors.js';

/**
 * Loads the user's profile, creating it on first sign-in as a student.
 * Only `name`, `role`, `department` and `createdAt` are stored (no email: data minimisation).
 * @param {{ uid: string, displayName?: string | null }} authUser Firebase Auth user.
 * @param {string} fallbackName Name used when the account has none (e.g. "Guest").
 * @returns {Promise<{ uid: string, name: string, role: string, department: string }>}
 * @throws {FirebaseError} If Firestore rejects the read or write.
 */
export async function ensureUserDoc(authUser, fallbackName) {
  const ref = doc(db, 'users', authUser.uid);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    const { name, role, department } = snapshot.data();
    return { uid: authUser.uid, name, role, department };
  }
  const name = (authUser.displayName || fallbackName).trim().slice(0, MAX_NAME) || fallbackName;
  const profile = { name, role: 'student', department: '' };
  await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  return { uid: authUser.uid, ...profile };
}

/**
 * Reads `config/app.demoMode`. A missing doc or unreadable config means demo mode is off.
 * @returns {Promise<boolean>}
 */
export async function loadDemoMode() {
  try {
    const snapshot = await getDoc(doc(db, 'config', 'app'));
    return snapshot.exists() && snapshot.data().demoMode === true;
  } catch (error) {
    console.error('Could not read demo mode', error);
    return false;
  }
}

/**
 * Switches the signed-in user's own role. Rules allow this only when `config/app.demoMode` is true.
 * @param {string} uid The signed-in user's ID.
 * @param {string} role One of ROLES.
 * @returns {Promise<void>}
 * @throws {AppError} INVALID_INPUT for an unknown role; FirebaseError if rules deny the write.
 */
export async function setDemoRole(uid, role) {
  if (!ROLES.includes(role)) throw new AppError(ERROR_CODES.INVALID_INPUT, `Unknown role: ${role}`);
  await updateDoc(doc(db, 'users', uid), { role });
}

/**
 * Lists faculty users (used to match a project's guide).
 * @returns {Promise<{ uid: string, name: string, department: string }[]>}
 * @throws {FirebaseError} If Firestore rejects the query.
 */
export async function loadFaculty() {
  const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'faculty')));
  return snapshot.docs.map((d) => ({
    uid: d.id,
    name: d.data().name,
    department: d.data().department,
  }));
}
