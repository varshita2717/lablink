// Demo seed (SPEC Section 17): PURE dataset builder plus the Firestore writer.
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase.js';
import { invalidateInventory } from './inventory.js';
import { SLOT_END_HOUR, SLOT_START_HOUR } from './config.js';
import { addDays, horizonDates, isWorkingDay, nextWorkingDay } from './dates.js';

const MODERATE_NOTE =
  "Involves hot, sharp or powered equipment. Faculty supervision and PPE required. Follow your lab's SOP.";
const HIGH_NOTE =
  "Involves hot or corrosive materials. Faculty supervision, PPE and fume hood use required. Follow your lab's SOP.";

const LABS = [
  {
    id: 'lab-chemistry',
    name: 'Chemistry Lab',
    department: 'Chemistry',
    building: 'Science Block A',
  },
  { id: 'lab-embedded', name: 'Embedded Systems Lab', department: 'ECE', building: 'ECE Block' },
  { id: 'lab-signals', name: 'Signals Lab', department: 'ECE', building: 'ECE Block' },
  {
    id: 'lab-ai-robotics',
    name: 'AI & Robotics Lab',
    department: 'CSE-AIML',
    building: 'CS Block',
  },
  { id: 'lab-hpc', name: 'HPC Lab', department: 'CSE-AIML', building: 'CS Block' },
  {
    id: 'lab-fabrication',
    name: 'Fabrication Lab',
    department: 'Mechanical',
    building: 'Workshop',
  },
];

const USERS = [
  { id: 'seed-aarav', name: 'Aarav Sharma', role: 'student', department: 'ECE' },
  { id: 'seed-meera', name: 'Meera Iyer', role: 'student', department: 'ECE' },
  { id: 'seed-rohan', name: 'Rohan Das', role: 'student', department: 'ECE' },
  { id: 'seed-kavita', name: 'Dr. Kavita Rao', role: 'faculty', department: 'Chemistry' },
  { id: 'seed-anil', name: 'Dr. Anil Mehta', role: 'faculty', department: 'ECE' },
  { id: 'seed-admin', name: 'Lab Admin', role: 'admin', department: '' },
];

// [id, name, category, labId, quantity, accessLevel, hazardLevel, equivalentGroup, description, tags]
const EQUIPMENT_ROWS = [
  [
    'eq-flask-250',
    'Round-bottom flask 250 mL',
    'Glassware',
    'lab-chemistry',
    10,
    'open',
    'none',
    'round-bottom-flask',
    'Borosilicate round-bottom flask for heating and refluxing small volumes of liquid.',
    ['flask', 'glassware', 'heating', 'reflux', 'chemistry', 'acid'],
  ],
  [
    'eq-flask-500',
    'Round-bottom flask 500 mL',
    'Glassware',
    'lab-chemistry',
    6,
    'open',
    'none',
    'round-bottom-flask',
    'Larger borosilicate round-bottom flask for heating and refluxing liquids.',
    ['flask', 'glassware', 'heating', 'reflux', 'chemistry', 'acid'],
  ],
  [
    'eq-beaker-set',
    'Beaker set',
    'Glassware',
    'lab-chemistry',
    20,
    'open',
    'none',
    null,
    'Set of graduated borosilicate beakers (50 mL to 1 L) for mixing and measuring.',
    ['beaker', 'glassware', 'mixing', 'chemistry'],
  ],
  [
    'eq-burette-set',
    'Burette and stand set',
    'Glassware',
    'lab-chemistry',
    8,
    'open',
    'none',
    null,
    'Burette with stand and clamp for titrations and precise liquid dispensing.',
    ['burette', 'titration', 'glassware', 'chemistry'],
  ],
  [
    'eq-condenser',
    'Condenser setup',
    'Glassware',
    'lab-chemistry',
    4,
    'approval',
    'moderate',
    null,
    'Liebig condenser with tubing for reflux and distillation setups.',
    ['condenser', 'reflux', 'distillation', 'chemistry'],
  ],
  [
    'eq-temp-probe',
    'Temperature probe',
    'Measurement',
    'lab-chemistry',
    5,
    'open',
    'none',
    null,
    'Digital temperature probe with logger for monitoring reactions.',
    ['temperature', 'probe', 'sensor', 'measurement', 'chemistry'],
  ],
  [
    'eq-hot-plate',
    'Hot plate stirrer',
    'Heating',
    'lab-chemistry',
    4,
    'approval',
    'moderate',
    null,
    'Magnetic hot plate stirrer for heating and stirring solutions in beakers.',
    ['heating', 'stirrer', 'hot plate', 'chemistry'],
  ],
  [
    'eq-heating-mantle',
    'Heating mantle',
    'Heating',
    'lab-chemistry',
    3,
    'approval',
    'high',
    null,
    'Electric heating mantle for even heating of round-bottom flasks.',
    ['heating', 'mantle', 'flask', 'acid', 'chemistry'],
  ],
  [
    'eq-fume-hood',
    'Fume hood bench',
    'Workstation',
    'lab-chemistry',
    2,
    'approval',
    'high',
    null,
    'Ventilated fume hood workstation for work with volatile or corrosive chemicals.',
    ['fume hood', 'ventilation', 'acid', 'safety', 'chemistry'],
  ],
  [
    'eq-oscilloscope',
    'Digital Oscilloscope',
    'Measurement',
    'lab-signals',
    1,
    'approval',
    'none',
    null,
    'Four-channel 200 MHz digital storage oscilloscope for signal analysis.',
    ['oscilloscope', 'signals', 'measurement', 'electronics'],
  ],
  [
    'eq-multimeter',
    'Multimeter',
    'Measurement',
    'lab-embedded',
    10,
    'open',
    'none',
    null,
    'Digital multimeter for voltage, current, resistance and continuity checks.',
    ['multimeter', 'measurement', 'electronics', 'circuit'],
  ],
  [
    'eq-soldering',
    'Soldering station',
    'Workstation',
    'lab-embedded',
    4,
    'open',
    'moderate',
    null,
    'Temperature-controlled soldering station with fume extractor.',
    ['soldering', 'electronics', 'pcb', 'assembly'],
  ],
  [
    'eq-arduino-kit',
    'Arduino and ESP32 sensor kit',
    'Dev Kit',
    'lab-embedded',
    10,
    'open',
    'none',
    null,
    'Arduino Uno and ESP32 boards with common sensors for IoT prototypes.',
    ['arduino', 'esp32', 'iot', 'sensor', 'microcontroller'],
  ],
  [
    'eq-rpi-kit',
    'Raspberry Pi 5 kit',
    'Dev Kit',
    'lab-ai-robotics',
    6,
    'open',
    'none',
    null,
    'Raspberry Pi 5 with camera module, power supply and storage.',
    ['raspberry pi', 'linux', 'camera', 'iot', 'edge'],
  ],
  [
    'eq-jetson',
    'NVIDIA Jetson dev kit',
    'Dev Kit',
    'lab-ai-robotics',
    2,
    'approval',
    'none',
    null,
    'NVIDIA Jetson developer kit for edge AI and computer vision.',
    ['jetson', 'edge ai', 'vision', 'gpu', 'robotics'],
  ],
  [
    'eq-gpu-workstation',
    'GPU Workstation',
    'Computing',
    'lab-hpc',
    3,
    'approval',
    'none',
    null,
    'Workstation with a high-memory NVIDIA GPU for deep-learning training.',
    ['gpu', 'deep learning', 'training', 'computing', 'ai'],
  ],
  [
    'eq-3d-printer',
    '3D Printer',
    'Fabrication',
    'lab-fabrication',
    2,
    'approval',
    'none',
    null,
    'FDM 3D printer for PLA and PETG prototypes and enclosures.',
    ['3d printer', 'fabrication', 'prototype', 'enclosure'],
  ],
  [
    'eq-laser-cutter',
    'Laser Cutter',
    'Fabrication',
    'lab-fabrication',
    1,
    'approval',
    'moderate',
    null,
    'CO2 laser cutter for acrylic and plywood parts.',
    ['laser', 'cutter', 'fabrication', 'acrylic', 'parts'],
  ],
];

const req = (equipmentId, qty, role) => ({ equipmentId, qty, role });

const EXPERIMENTS = [
  {
    id: 'exp-acid-heating',
    title: 'Heating an acid solution to a set temperature',
    department: 'Chemistry',
    description: 'Controlled heating of an acid solution under reflux with temperature monitoring.',
    keywords: ['heat', 'acid', 'temperature', 'reflux', 'reaction'],
    hazardLevel: 'high',
    typicalSessionHours: 3,
    requiredEquipment: [
      req('eq-flask-250', 1, 'Reaction vessel'),
      req('eq-heating-mantle', 1, 'Heat source'),
      req('eq-condenser', 1, 'Reflux'),
      req('eq-temp-probe', 1, 'Temperature monitoring'),
      req('eq-fume-hood', 1, 'Ventilation'),
    ],
  },
  {
    id: 'exp-titration',
    title: 'Acid-base titration',
    department: 'Chemistry',
    description: 'Determine the concentration of a solution by titration.',
    keywords: ['titration', 'acid', 'base', 'concentration'],
    hazardLevel: 'moderate',
    typicalSessionHours: 2,
    requiredEquipment: [
      req('eq-burette-set', 1, 'Titrant delivery'),
      req('eq-beaker-set', 1, 'Sample containers'),
    ],
  },
  {
    id: 'exp-circuit',
    title: 'Basic circuit build and measurement',
    department: 'ECE',
    description: 'Build a circuit and measure voltages, currents and waveforms.',
    keywords: ['circuit', 'voltage', 'measurement', 'waveform'],
    hazardLevel: 'none',
    typicalSessionHours: 2,
    requiredEquipment: [
      req('eq-multimeter', 1, 'DC measurements'),
      req('eq-oscilloscope', 1, 'Waveforms'),
    ],
  },
  {
    id: 'exp-iot-node',
    title: 'IoT sensor node prototype',
    department: 'ECE',
    description: 'Prototype a wireless sensor node that reports readings to the cloud.',
    keywords: ['iot', 'sensor', 'wireless', 'esp32'],
    hazardLevel: 'moderate',
    typicalSessionHours: 2,
    requiredEquipment: [
      req('eq-arduino-kit', 1, 'Microcontroller and sensors'),
      req('eq-soldering', 1, 'Assembly'),
      req('eq-multimeter', 1, 'Debugging'),
    ],
  },
  {
    id: 'exp-edge-vision',
    title: 'Edge AI vision prototype',
    department: 'CSE-AIML',
    description: 'Run a computer-vision model on an edge device with a camera.',
    keywords: ['vision', 'edge', 'camera', 'ai', 'detection'],
    hazardLevel: 'none',
    typicalSessionHours: 3,
    requiredEquipment: [
      req('eq-jetson', 1, 'Inference device'),
      req('eq-rpi-kit', 1, 'Camera host'),
    ],
  },
  {
    id: 'exp-dl-training',
    title: 'Deep-learning model training',
    department: 'CSE-AIML',
    description: 'Train a neural network on a GPU.',
    keywords: ['deep learning', 'training', 'neural network', 'gpu'],
    hazardLevel: 'none',
    typicalSessionHours: 4,
    requiredEquipment: [req('eq-gpu-workstation', 1, 'Training')],
  },
  {
    id: 'exp-3d-enclosure',
    title: '3D-printed enclosure prototype',
    department: 'Mechanical',
    description: 'Design and print an enclosure for a device.',
    keywords: ['3d print', 'enclosure', 'case', 'prototype'],
    hazardLevel: 'none',
    typicalSessionHours: 3,
    requiredEquipment: [req('eq-3d-printer', 1, 'Printing')],
  },
  {
    id: 'exp-laser-parts',
    title: 'Laser-cut parts',
    department: 'Mechanical',
    description: 'Cut flat parts from acrylic or plywood.',
    keywords: ['laser', 'cut', 'acrylic', 'parts'],
    hazardLevel: 'moderate',
    typicalSessionHours: 1,
    requiredEquipment: [req('eq-laser-cutter', 1, 'Cutting')],
  },
];

/** Demo conflict: three students, the oscilloscope, next working day 10:00-12:00 (Section 17). */
const CONFLICT = {
  equipmentId: 'eq-oscilloscope',
  startHour: 10,
  endHour: 12,
  guideId: 'seed-anil',
  students: [
    {
      userId: 'seed-aarav',
      title: 'Radar signal analyser',
      stage: 'final',
      deadlineDays: 3,
      pastHoursPerDay: [2],
    },
    {
      userId: 'seed-rohan',
      title: 'Audio spectrum visualiser',
      stage: 'prototype',
      deadlineDays: 7,
      pastHoursPerDay: [3, 2],
    },
    {
      userId: 'seed-meera',
      title: 'ECG signal filter',
      stage: 'prototype',
      deadlineDays: 10,
      pastHoursPerDay: [4, 4, 4, 3],
    },
  ],
};

const PAST_BOOKING_EQUIPMENT = 'eq-multimeter';

/**
 * Lists working days before `today`, most recent first.
 * @param {string} today
 * @param {number} count
 * @returns {string[]}
 */
function pastWorkingDays(today, count) {
  const days = [];
  for (let offset = -1; days.length < count; offset -= 1) {
    const date = addDays(today, offset);
    if (isWorkingDay(date)) days.push(date);
  }
  return days;
}

function buildEquipment() {
  const labsById = Object.fromEntries(LABS.map((lab) => [lab.id, lab]));
  return EQUIPMENT_ROWS.map(
    ([
      id,
      name,
      category,
      labId,
      quantity,
      accessLevel,
      hazardLevel,
      equivalentGroup,
      description,
      tags,
    ]) => ({
      id,
      name,
      category,
      description,
      tags,
      labId,
      labName: labsById[labId].name,
      department: labsById[labId].department,
      quantity,
      accessLevel,
      hazardLevel,
      safetyNote: { none: '', moderate: MODERATE_NOTE, high: HIGH_NOTE }[hazardLevel],
      equivalentGroup,
      status: 'active',
      proposedByUid: null,
      proposedByName: null,
      reason: null,
    }),
  );
}

function buildExperiments() {
  return EXPERIMENTS.map((exp) => ({
    ...exp,
    safetyNote: { none: '', moderate: MODERATE_NOTE, high: HIGH_NOTE }[exp.hazardLevel],
  }));
}

/** Round-bottom flask 250 mL fully booked on every working day of the horizon (substitution demo). */
function buildFlaskSlots(today, quantity) {
  const hours = {};
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) hours[String(hour)] = quantity;
  return horizonDates(today).map((date) => ({
    id: `eq-flask-250_${date}`,
    equipmentId: 'eq-flask-250',
    date,
    hours: { ...hours },
  }));
}

function buildConflict(today, usersById, equipmentById) {
  const date = nextWorkingDay(today);
  const guide = usersById[CONFLICT.guideId];
  const scope = equipmentById[CONFLICT.equipmentId];
  const pastDays = pastWorkingDays(
    today,
    Math.max(...CONFLICT.students.map((s) => s.pastHoursPerDay.length)),
  );
  const multimeter = equipmentById[PAST_BOOKING_EQUIPMENT];
  const projects = [];
  const requests = [];
  const bookings = [];
  for (const student of CONFLICT.students) {
    const owner = usersById[student.userId];
    const projectId = `seed-project-${student.userId.replace('seed-', '')}`;
    const deadline = addDays(today, student.deadlineDays);
    projects.push({
      id: projectId,
      title: student.title,
      description: `${student.title} (demo project).`,
      ownerUid: owner.id,
      ownerName: owner.name,
      facultyGuideUid: guide.id,
      facultyGuideName: guide.name,
      deadline,
      stage: student.stage,
    });
    requests.push({
      id: `seed-request-${student.userId.replace('seed-', '')}`,
      projectId,
      projectTitle: student.title,
      studentUid: owner.id,
      studentName: owner.name,
      facultyUid: guide.id,
      items: [{ equipmentId: scope.id, equipmentName: scope.name, qty: 1 }],
      sessions: [{ date, startHour: CONFLICT.startHour, endHour: CONFLICT.endHour }],
      justification: `Need the oscilloscope to capture and analyse signals for "${student.title}".`,
      deadline,
      stage: student.stage,
      hazardNote: '',
      status: 'pending',
      score: null,
      scoreBreakdown: null,
      alternatives: [],
      facultyComment: '',
    });
    student.pastHoursPerDay.forEach((hours, index) => {
      bookings.push({
        id: `seed-booking-${student.userId.replace('seed-', '')}-${index + 1}`,
        equipmentId: multimeter.id,
        equipmentName: multimeter.name,
        date: pastDays[index],
        startHour: SLOT_START_HOUR,
        endHour: SLOT_START_HOUR + hours,
        qty: 1,
        userUid: owner.id,
        userName: owner.name,
        requestId: null,
        projectId: null,
        status: 'confirmed',
      });
    });
  }
  return { projects, requests, bookings };
}

/**
 * Builds the complete demo dataset (SPEC Section 17). Every record carries its document `id`.
 * @param {string} today `YYYY-MM-DD` seed day.
 * @returns {{ users: object[], labs: object[], equipment: object[], experiments: object[],
 *             slots: object[], projects: object[], requests: object[], bookings: object[] }}
 * @throws {AppError} INVALID_INPUT for a bad date.
 */
export function buildSeedData(today) {
  const equipment = buildEquipment();
  const equipmentById = Object.fromEntries(equipment.map((item) => [item.id, item]));
  const usersById = Object.fromEntries(USERS.map((user) => [user.id, user]));
  return {
    users: USERS.map((user) => ({ ...user })),
    labs: LABS.map((lab) => ({ ...lab })),
    equipment,
    experiments: buildExperiments(),
    slots: buildFlaskSlots(today, equipmentById['eq-flask-250'].quantity),
    ...buildConflict(today, usersById, equipmentById),
  };
}

const withoutId = ({ id, ...rest }) => [id, rest];

/**
 * Seeds the demo dataset for today. Admin only (enforced by rules). Aborts if any equipment exists,
 * so clear the collections in the Firebase console before reseeding on demo day.
 * Written in three batches because rules `get()` sees the state before a batch: equipment and
 * faculty users must exist before slot and project writes are validated against them.
 * @param {string} today `YYYY-MM-DD` seed day.
 * @returns {Promise<{ seeded: boolean, message: string }>}
 * @throws {FirebaseError} If a read or batch write is rejected.
 */
export async function seedDatabase(today) {
  const existing = await getDocs(query(collection(db, 'equipment'), limit(1)));
  if (!existing.empty) {
    return {
      seeded: false,
      message:
        'Equipment already exists. Clear the collections in the Firebase console, then seed again.',
    };
  }
  const data = buildSeedData(today);
  const writeAll = async (groups) => {
    const batch = writeBatch(db);
    for (const [name, records, stampField] of groups) {
      for (const record of records) {
        const [id, fields] = withoutId(record);
        batch.set(doc(db, name, id), { ...fields, [stampField]: serverTimestamp() });
      }
    }
    await batch.commit();
  };
  await writeAll([
    ['users', data.users, 'createdAt'],
    ['labs', data.labs, 'createdAt'],
    ['equipment', data.equipment, 'createdAt'],
    ['experiments', data.experiments, 'createdAt'],
  ]);
  await writeAll([
    ['slots', data.slots, 'updatedAt'],
    ['projects', data.projects, 'createdAt'],
    ['bookings', data.bookings, 'createdAt'],
  ]);
  await writeAll([['requests', data.requests, 'createdAt']]);
  invalidateInventory();
  return {
    seeded: true,
    message: `Seeded ${data.equipment.length} equipment items, ${data.experiments.length} experiments and the demo conflict.`,
  };
}
