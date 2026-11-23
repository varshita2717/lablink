import { describe, expect, it, vi } from 'vitest';
import {
  createToolRunner,
  normaliseFacultyName,
  toolDeclarationsFor,
  toolNamesFor,
} from '../agent/tools.js';
import { buildAvailability, hoursByDate } from '../booking.js';
import { buildSubstitutes } from '../inventory.js';
import { buildSeedData } from '../seed.js';
import { addDays, daysBetween } from '../dates.js';

vi.mock('../firebase.js', () => ({ db: {} }));

const TODAY = '2026-11-23';
const seed = buildSeedData(TODAY);
const PROJECT = {
  id: 'proj-acid',
  title: 'Acid Reaction Study',
  deadline: addDays(TODAY, 12),
  stage: 'prototype',
  facultyGuideUid: 'seed-kavita',
  facultyGuideName: 'Dr. Kavita Rao',
};
const ACID_JSON = JSON.stringify({
  matchedExperimentId: 'exp-acid-heating',
  items: seed.experiments[0].requiredEquipment.map(({ equipmentId, qty, role }) => ({
    equipmentId,
    qty,
    role,
    reason: 'Needed for heating an acid',
  })),
});

function makeRunner(role = 'student', overrides = {}) {
  const deps = {
    loadActiveEquipment: async () => seed.equipment,
    loadExperiments: async () => seed.experiments,
    loadAvailability: async (equipment, dates) => buildAvailability(equipment, dates, seed.slots),
    loadConfirmedBookings: async () => [],
    loadMyProjects: async () => [PROJECT],
    loadFaculty: async () => [
      { uid: 'seed-kavita', name: 'Dr. Kavita Rao' },
      { uid: 'seed-anil', name: 'Dr. Anil Mehta' },
    ],
    buildSubstitutes,
    hoursByDate,
    generateRecommendationJson: vi.fn(async () => ACID_JSON),
    ...overrides,
  };
  const plans = new Map();
  const runner = createToolRunner({ user: { uid: 'student-1', role }, today: TODAY, plans, deps });
  return { runner, plans, deps };
}

const ACID_ITEMS = seed.experiments[0].requiredEquipment.map(({ equipmentId, qty }) => ({
  equipmentId,
  qty,
}));

describe('tool registration by role', () => {
  it('gives students read and draft tools, staff read tools only', () => {
    expect(toolNamesFor('student')).toEqual([
      'recommend_equipment',
      'check_availability',
      'find_slots',
      'get_my_projects',
      'draft_project',
      'draft_plan',
    ]);
    expect(toolNamesFor('faculty')).toEqual([
      'recommend_equipment',
      'check_availability',
      'find_slots',
    ]);
    const names = toolDeclarationsFor('admin')[0].functionDeclarations.map((d) => d.name);
    expect(names).toEqual(toolNamesFor('admin'));
  });

  it('refuses tools the role does not have', async () => {
    const { runner } = makeRunner('faculty');
    expect(await runner.run('draft_plan', {})).toEqual({
      response: { error: 'Unknown tool: draft_plan' },
    });
    expect(await runner.run('book_everything', {})).toEqual({
      response: { error: 'Unknown tool: book_everything' },
    });
  });
});

describe('demo prompt 1: recommend_equipment', () => {
  it('returns an EquipmentListCard with the flask substitute, safety note and approval flag', async () => {
    const { runner } = makeRunner();
    const { response, card } = await runner.run('recommend_equipment', {
      description: 'I want to heat an acid to 200°C for my project',
    });
    expect(card.type).toBe('equipmentList');
    expect(response.needsApproval).toBe(true);
    expect(response.safetyNotes.length).toBeGreaterThan(0);
    const flask = response.items.find((i) => i.equipmentId === 'eq-flask-250');
    expect(flask.availableTomorrow).toBe(false);
    expect(flask.substitutes.map((s) => s.equipmentId)).toEqual(['eq-flask-500']);
  });

  it('allows one recommendation call per user message', async () => {
    const { runner, deps } = makeRunner();
    await runner.run('recommend_equipment', { description: 'heat an acid' });
    const second = await runner.run('recommend_equipment', { description: 'heat an acid' });
    expect(second.response.error).toMatch(/Only one recommendation/);
    expect(deps.generateRecommendationJson).toHaveBeenCalledTimes(1);
    runner.beginMessage();
    await runner.run('recommend_equipment', { description: 'build a circuit' });
    expect(deps.generateRecommendationJson).toHaveBeenCalledTimes(2);
  });

  it('returns { error } for invalid arguments', async () => {
    const { runner } = makeRunner();
    expect(
      (await runner.run('recommend_equipment', { description: 7 })).response.error,
    ).toBeTruthy();
  });
});

describe('check_availability', () => {
  it('lists free hours and only free substitutes', async () => {
    const { runner } = makeRunner();
    const { response } = await runner.run('check_availability', {
      equipmentId: 'eq-flask-250',
      date: '2026-11-24',
    });
    expect(response.freeHours).toEqual([]);
    expect(response.substitutes[0]).toMatchObject({ equipmentId: 'eq-flask-500' });
    expect(response.substitutes[0].freeHours[0]).toEqual({ hour: '09:00', free: 6 });
  });

  it('rejects unknown equipment and weekend dates', async () => {
    const { runner } = makeRunner();
    expect(
      (await runner.run('check_availability', { equipmentId: 'eq-ghost', date: '2026-11-24' }))
        .response.error,
    ).toMatch(/unknown equipmentId/);
    expect(
      (await runner.run('check_availability', { equipmentId: 'eq-flask-250', date: '2026-11-28' }))
        .response.error,
    ).toBeTruthy();
  });
});

describe('demo prompt 2: draft_project', () => {
  const args = {
    title: 'Acid Reaction Study',
    description: 'Heating an acid under supervision',
    deadline: addDays(TODAY, 12),
    stage: 'prototype',
  };

  it('matches the guide ignoring "Dr." and case, and returns a ProjectDraftCard', async () => {
    const { runner } = makeRunner();
    const { response, card } = await runner.run('draft_project', {
      ...args,
      facultyGuideName: 'kavita rao',
    });
    expect(response.status).toBe('drafted');
    expect(card).toEqual({
      type: 'projectDraft',
      data: { ...args, facultyGuideName: 'Dr. Kavita Rao', facultyGuideUid: 'seed-kavita' },
    });
    expect(normaliseFacultyName('  Dr.   Kavita  RAO ')).toBe('kavita rao');
  });

  it('returns the faculty list when no guide matches', async () => {
    const { runner } = makeRunner();
    const { response, card } = await runner.run('draft_project', {
      ...args,
      facultyGuideName: 'Prof. Nobody',
    });
    expect(card).toBeUndefined();
    expect(response).toEqual({
      error: 'No faculty member matches that name.',
      availableFaculty: ['Dr. Kavita Rao', 'Dr. Anil Mehta'],
    });
  });
});

describe('demo prompt 3: find_slots then draft_plan', () => {
  it('plans 4 spread-out sessions with the flask substitution and drafts an approval plan', async () => {
    const { runner, plans } = makeRunner();
    const slots = await runner.run('find_slots', {
      items: ACID_ITEMS,
      sessionHours: 3,
      sessionsPerWeek: 2,
      deadline: PROJECT.deadline,
    });
    expect(slots.response).toMatchObject({
      planId: 'plan-1',
      requested: 4,
      found: 4,
      complete: true,
    });
    expect(slots.response.substitutions).toEqual([
      { original: 'Round-bottom flask 250 mL', replacement: 'Round-bottom flask 500 mL' },
    ]);
    expect(plans.has('plan-1')).toBe(true);

    const projects = await runner.run('get_my_projects', {});
    expect(projects.response.projects).toEqual([
      {
        projectId: 'proj-acid',
        title: 'Acid Reaction Study',
        deadline: PROJECT.deadline,
        stage: 'prototype',
      },
    ]);

    const { response, card } = await runner.run('draft_plan', {
      planId: 'plan-1',
      projectId: 'proj-acid',
      justification: 'Supervised heating study.',
    });
    expect(response.needsApproval).toBe(true);
    expect(card.type).toBe('plan');
    expect(card.data.sessions).toEqual(plans.get('plan-1').sessions);
    expect(card.data.sessions).toHaveLength(4);
    for (let i = 1; i < 4; i += 1) {
      expect(
        daysBetween(card.data.sessions[i - 1].date, card.data.sessions[i].date),
      ).toBeGreaterThanOrEqual(1);
    }
    expect(card.data.substitutions[0]).toMatchObject({
      originalName: 'Round-bottom flask 250 mL',
      replacement: { equipmentId: 'eq-flask-500' },
    });
    expect(card.data.items.map((i) => i.equipmentId)).toContain('eq-flask-500');
    expect(card.data.safetyNotes.length).toBeGreaterThan(0);
  });

  it('defaults to 2 weeks without a deadline and caps the session count', async () => {
    const { runner } = makeRunner();
    const { response } = await runner.run('find_slots', {
      items: [{ equipmentId: 'eq-multimeter', qty: 1 }],
      sessionHours: 1,
      sessionsPerWeek: 5,
    });
    expect(response.requested).toBe(10);
  });

  it('never accepts a plan or project the model made up', async () => {
    const { runner } = makeRunner();
    const invented = await runner.run('draft_plan', { planId: 'plan-99', projectId: 'proj-acid' });
    expect(invented.response.error).toMatch(/unknown planId/);
    await runner.run('find_slots', {
      items: [{ equipmentId: 'eq-multimeter', qty: 1 }],
      sessionHours: 2,
      sessionsPerWeek: 1,
    });
    const notMine = await runner.run('draft_plan', {
      planId: 'plan-1',
      projectId: 'someone-elses',
    });
    expect(notMine.response.error).toMatch(/unknown projectId/);
  });

  it('rejects invalid find_slots arguments with { error }', async () => {
    const { runner } = makeRunner();
    const { response } = await runner.run('find_slots', {
      items: [{ equipmentId: 'eq-oscilloscope', qty: 3 }],
      sessionHours: 3,
      sessionsPerWeek: 2,
    });
    expect(response.error).toMatch(/qty/);
  });

  it('reports unexpected failures without crashing the loop', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { runner } = makeRunner('student', {
      loadMyProjects: async () => {
        throw new Error('network');
      },
    });
    expect((await runner.run('get_my_projects', {})).response.error).toMatch(/tool failed/);
    vi.restoreAllMocks();
  });
});
