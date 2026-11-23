// Model-facing tools (SPEC 13.2): read or draft only. None of them writes to the database;
// writes happen only from a card's Confirm button. Every argument is validated before use.
import {
  DEFAULT_PLAN_WEEKS,
  DAYS_PER_WEEK,
  MAX_SESSIONS_PER_REQUEST,
  SLOT_END_HOUR,
  SLOT_START_HOUR,
} from '../config.js';
import { AppError } from '../errors.js';
import { daysBetween, horizonDates, nextWorkingDay } from '../dates.js';
import { formatHour, formatSession } from '../format.js';
import { collectSafetyNotes, needsApproval } from '../access.js';
import { planSessions } from '../planner.js';
import {
  validateCheckAvailabilityArgs,
  validateDraftPlanArgs,
  validateDraftProjectArgs,
  validateFindSlotsArgs,
  validateRecommendArgs,
} from '../validate.js';
import { recommendEquipment } from './recommend.js';

// ---------------------------------------------------------------- declarations

const str = (description) => ({ type: 'string', description });
const int = (description) => ({ type: 'integer', description });

const DECLARATIONS = {
  recommend_equipment: {
    name: 'recommend_equipment',
    description:
      'Recommend lab equipment for a project or experiment the user describes. Shows a card with access, hazard and availability.',
    parameters: {
      type: 'object',
      properties: {
        description: str('What the user wants to do, in their words (max 1000 characters).'),
      },
      required: ['description'],
    },
  },
  check_availability: {
    name: 'check_availability',
    description: 'Free hours of one equipment item on one working day, plus free substitutes.',
    parameters: {
      type: 'object',
      properties: {
        equipmentId: str('Equipment id from a previous tool result.'),
        date: str('YYYY-MM-DD, a working day within the next 14 days.'),
      },
      required: ['equipmentId', 'date'],
    },
  },
  find_slots: {
    name: 'find_slots',
    description:
      'Find sessions where all items are free together. Returns a planId to pass to draft_plan. Offers substitutes automatically.',
    parameters: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '1 to 8 items.',
          items: {
            type: 'object',
            properties: {
              equipmentId: str('Equipment id.'),
              qty: int('Units needed, at least 1.'),
            },
            required: ['equipmentId', 'qty'],
          },
        },
        sessionHours: int('Hours per session, 1 to 4.'),
        sessionsPerWeek: int('Sessions per week, 1 to 5.'),
        numWeeks: int('Optional: 1 or 2 weeks.'),
        deadline: str('Optional: project deadline, YYYY-MM-DD.'),
      },
      required: ['items', 'sessionHours', 'sessionsPerWeek'],
    },
  },
  get_my_projects: {
    name: 'get_my_projects',
    description: "List the user's projects (projectId, title, deadline, stage).",
  },
  draft_project: {
    name: 'draft_project',
    description: 'Draft a new project for the user to confirm. Does not create anything.',
    parameters: {
      type: 'object',
      properties: {
        title: str('Project title, max 120 characters.'),
        description: str('Short description, max 1000 characters.'),
        deadline: str('YYYY-MM-DD, after today.'),
        stage: {
          type: 'string',
          enum: ['idea', 'prototype', 'final'],
          description: 'Project stage.',
        },
        facultyGuideName: str("The faculty guide's name."),
      },
      required: ['title', 'description', 'deadline', 'stage', 'facultyGuideName'],
    },
  },
  draft_plan: {
    name: 'draft_plan',
    description:
      'Draft a booking or access request from a planId returned by find_slots, for one of the user’s projects. The user confirms it.',
    parameters: {
      type: 'object',
      properties: {
        planId: str('planId from find_slots.'),
        projectId: str('projectId from get_my_projects or a created project.'),
        justification: str('One or two sentences for the faculty guide, max 500 characters.'),
      },
      required: ['planId', 'projectId', 'justification'],
    },
  },
};

const READ_TOOLS = ['recommend_equipment', 'check_availability', 'find_slots'];
const STUDENT_TOOLS = [...READ_TOOLS, 'get_my_projects', 'draft_project', 'draft_plan'];

/**
 * Tool names available to a role: students get read and draft tools; staff get read tools only.
 * @param {string} role
 * @returns {string[]}
 */
export function toolNamesFor(role) {
  return role === 'student' ? STUDENT_TOOLS : READ_TOOLS;
}

/**
 * Function declarations for a role, in the Firebase AI Logic `tools` format.
 * @param {string} role
 * @returns {{ functionDeclarations: object[] }[]}
 */
export function toolDeclarationsFor(role) {
  return [{ functionDeclarations: toolNamesFor(role).map((name) => DECLARATIONS[name]) }];
}

// ---------------------------------------------------------------- helpers

const byId = (list) => Object.fromEntries(list.map((item) => [item.id, item]));

const freeHours = (remaining) => {
  const hours = [];
  for (let hour = SLOT_START_HOUR; hour < SLOT_END_HOUR; hour += 1) {
    if ((remaining?.[hour] ?? 0) >= 1)
      hours.push({ hour: formatHour(hour), free: remaining[hour] });
  }
  return hours;
};

/** Normalises a faculty name for matching: case-insensitive, ignoring "Dr." and extra spaces. */
export function normaliseFacultyName(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/\bdr\.?\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Number of weeks to plan when the model did not say: min(2, ceil(days to deadline / 7)), else 2. */
function defaultWeeks(today, deadline) {
  if (!deadline) return DEFAULT_PLAN_WEEKS;
  return Math.max(
    1,
    Math.min(DEFAULT_PLAN_WEEKS, Math.ceil(daysBetween(today, deadline) / DAYS_PER_WEEK)),
  );
}

// ---------------------------------------------------------------- implementations

async function recommend(ctx, args) {
  const { description } = validateRecommendArgs(args);
  if (ctx.state.recommendedThisMessage) {
    return { response: { error: 'Only one recommendation per message. Use the previous result.' } };
  }
  ctx.state.recommendedThisMessage = true;
  const [equipment, experiments] = await Promise.all([
    ctx.deps.loadActiveEquipment(),
    ctx.deps.loadExperiments(),
  ]);
  const date = nextWorkingDay(ctx.today);
  const result = await recommendEquipment(description, {
    equipment,
    experiments,
    date,
    availability: await ctx.deps.loadAvailability(equipment, [date]),
    substitutesById: ctx.deps.buildSubstitutes(
      equipment,
      equipment.map((item) => item.id),
    ),
    generateJson: (text) => ctx.deps.generateRecommendationJson(text, equipment, experiments),
  });
  return { response: result, card: { type: 'equipmentList', data: result } };
}

async function checkAvailability(ctx, args) {
  const equipment = await ctx.deps.loadActiveEquipment();
  const equipmentById = byId(equipment);
  const { equipmentId, date } = validateCheckAvailabilityArgs(args, equipmentById, ctx.today);
  const substitutes = ctx.deps.buildSubstitutes(equipment, [equipmentId])[equipmentId] ?? [];
  const involved = [
    equipmentById[equipmentId],
    ...substitutes.map((s) => equipmentById[s.equipmentId]),
  ];
  const availability = await ctx.deps.loadAvailability(involved, [date]);
  return {
    response: {
      equipmentId,
      name: equipmentById[equipmentId].name,
      date,
      freeHours: freeHours(availability[equipmentId][date]),
      substitutes: substitutes
        .map((s) => ({ ...s, freeHours: freeHours(availability[s.equipmentId][date]) }))
        .filter((s) => s.freeHours.length > 0),
    },
  };
}

async function findSlots(ctx, args) {
  const equipment = await ctx.deps.loadActiveEquipment();
  const equipmentById = byId(equipment);
  const input = validateFindSlotsArgs(args, equipmentById, ctx.today);
  const weeks = input.numWeeks ?? defaultWeeks(ctx.today, input.deadline);
  const dates = horizonDates(ctx.today);
  const ids = input.items.map((item) => item.equipmentId);
  const substitutes = ctx.deps.buildSubstitutes(equipment, ids);
  const involvedIds = new Set([
    ...ids,
    ...Object.values(substitutes)
      .flat()
      .map((s) => s.equipmentId),
  ]);
  const [availability, bookings] = await Promise.all([
    ctx.deps.loadAvailability(
      equipment.filter((item) => involvedIds.has(item.id)),
      dates,
    ),
    ctx.deps.loadConfirmedBookings(ctx.user.uid, dates[0], dates[dates.length - 1]),
  ]);
  const plan = planSessions({
    items: input.items,
    sessionHours: input.sessionHours,
    totalSessions: Math.min(input.sessionsPerWeek * weeks, MAX_SESSIONS_PER_REQUEST),
    maxPerWeek: input.sessionsPerWeek,
    deadline: input.deadline,
    today: ctx.today,
    availability,
    userHoursByDate: ctx.deps.hoursByDate(bookings),
    substitutes,
  });
  const planId = `plan-${ctx.plans.size + 1}`;
  ctx.plans.set(planId, plan);
  const name = (id) => equipmentById[id]?.name ?? id;
  return {
    response: {
      planId,
      requested: plan.requested,
      found: plan.found,
      complete: plan.complete,
      sessions: plan.sessions.map(formatSession),
      items: plan.items.map((item) => ({ ...item, name: name(item.equipmentId) })),
      substitutions: plan.substitutions.map((s) => ({
        original: name(s.originalEquipmentId),
        replacement: s.replacement.name,
      })),
      unavailableItems: plan.unavailableItems.map(name),
    },
  };
}

async function getMyProjects(ctx) {
  const projects = await ctx.deps.loadMyProjects(ctx.user.uid);
  return {
    response: {
      projects: projects.map(({ id, title, deadline, stage }) => ({
        projectId: id,
        title,
        deadline,
        stage,
      })),
    },
  };
}

async function draftProject(ctx, args) {
  const draft = validateDraftProjectArgs(args, ctx.today);
  const faculty = await ctx.deps.loadFaculty();
  const wanted = normaliseFacultyName(draft.facultyGuideName);
  const guide = faculty.find((member) => normaliseFacultyName(member.name) === wanted);
  if (!guide) {
    return {
      response: {
        error: 'No faculty member matches that name.',
        availableFaculty: faculty.map((f) => f.name),
      },
    };
  }
  return {
    response: {
      status: 'drafted',
      note: 'Shown to the user with a Confirm button. Not created yet.',
    },
    card: {
      type: 'projectDraft',
      data: { ...draft, facultyGuideUid: guide.uid, facultyGuideName: guide.name },
    },
  };
}

async function draftPlan(ctx, args) {
  const [projects, equipment] = await Promise.all([
    ctx.deps.loadMyProjects(ctx.user.uid),
    ctx.deps.loadActiveEquipment(),
  ]);
  const { planId, projectId, justification } = validateDraftPlanArgs(
    args,
    Object.fromEntries(ctx.plans),
    byId(projects),
  );
  const plan = ctx.plans.get(planId);
  if (plan.found === 0)
    return {
      response: { error: 'This plan has no sessions. Ask the user to change the request.' },
    };
  const equipmentById = byId(equipment);
  if (plan.items.some((item) => !equipmentById[item.equipmentId])) {
    return { response: { error: 'An item in this plan is no longer available.' } };
  }
  const items = plan.items.map(({ equipmentId, qty }) => ({
    ...equipmentById[equipmentId],
    equipmentId,
    qty,
  }));
  const project = byId(projects)[projectId];
  const data = {
    planId,
    project,
    items: items.map(({ equipmentId, name, qty, accessLevel, hazardLevel }) => ({
      equipmentId,
      name,
      qty,
      accessLevel,
      hazardLevel,
    })),
    sessions: plan.sessions,
    substitutions: plan.substitutions.map((s) => ({
      ...s,
      originalName: equipmentById[s.originalEquipmentId]?.name ?? s.originalEquipmentId,
    })),
    complete: plan.complete,
    requested: plan.requested,
    found: plan.found,
    safetyNotes: collectSafetyNotes(items),
    needsApproval: needsApproval(items),
    justification,
  };
  return {
    response: {
      status: 'drafted',
      needsApproval: data.needsApproval,
      sessions: plan.sessions.map(formatSession),
      substitutions: plan.substitutions.map((s) => s.replacement.name),
      note: 'Shown to the user with a Confirm button. Nothing is booked or submitted yet.',
    },
    card: { type: 'plan', data },
  };
}

const IMPLEMENTATIONS = {
  recommend_equipment: recommend,
  check_availability: checkAvailability,
  find_slots: findSlots,
  get_my_projects: getMyProjects,
  draft_project: draftProject,
  draft_plan: draftPlan,
};

/**
 * Creates the tool runner for one chat session. Plans from find_slots are stored in `plans`.
 * @param {{ user: { uid: string, role: string }, today: string, plans: Map<string, object>,
 *           deps: object }} context `deps` supplies data loaders and the recommendation call.
 * @returns {{ beginMessage: () => void,
 *             run: (name: string, args: unknown) => Promise<{ response: object, card?: object }> }}
 */
export function createToolRunner({ user, today, plans, deps }) {
  const ctx = { user, today, plans, deps, state: { recommendedThisMessage: false } };
  const allowed = new Set(toolNamesFor(user.role));
  return {
    beginMessage() {
      ctx.state.recommendedThisMessage = false;
    },
    async run(name, args) {
      if (!allowed.has(name)) return { response: { error: `Unknown tool: ${name}` } };
      try {
        return await IMPLEMENTATIONS[name](ctx, args);
      } catch (error) {
        if (error instanceof AppError) return { response: { error: error.message } };
        console.error(`Tool ${name} failed`, error);
        return { response: { error: 'The tool failed. Try again or ask the user.' } };
      }
    },
  };
}
