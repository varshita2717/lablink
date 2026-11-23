// Shared test data for request and conflict components.
export const REQUEST = {
  id: 'r1',
  projectId: 'p1',
  projectTitle: 'Radar signal analyser',
  studentUid: 'seed-aarav',
  studentName: 'Aarav Sharma',
  facultyUid: 'u1',
  items: [{ equipmentId: 'eq-oscilloscope', equipmentName: 'Digital Oscilloscope', qty: 1 }],
  sessions: [{ date: '2026-11-24', startHour: 10, endHour: 12 }],
  justification: 'Capture radar returns.',
  deadline: '2026-11-26',
  stage: 'final',
  hazardNote: '',
  status: 'pending',
  createdAt: 1,
};

export const RESOLUTION = {
  ranking: [
    {
      requestId: 'r1',
      studentUid: 'seed-aarav',
      studentName: 'Aarav Sharma',
      projectTitle: 'Radar signal analyser',
      deadline: '2026-11-26',
      stage: 'final',
      score: { urgency: 0.7857, fairness: 0.9, stage: 1, total: 0.8629 },
      rank: 1,
      isWinner: true,
      alternatives: null,
    },
    {
      requestId: 'r2',
      studentUid: 'seed-rohan',
      studentName: 'Rohan Das',
      projectTitle: 'Audio spectrum visualiser',
      deadline: '2026-11-30',
      stage: 'prototype',
      score: { urgency: 0.5, fairness: 0.75, stage: 0.7, total: 0.615 },
      rank: 2,
      isWinner: false,
      alternatives: {
        sessions: [{ date: '2026-11-25', startHour: 10, endHour: 12 }],
        substitutions: [],
        complete: true,
      },
    },
  ],
};
