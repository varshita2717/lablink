import { useCallback, useState } from 'react';
import useAsync from '../hooks/useAsync.js';
import useAuth from '../hooks/useAuth.js';
import { createProject } from '../lib/requests.js';
import { loadFaculty } from '../lib/users.js';
import { MAX_DESCRIPTION, MAX_PROJECT_DEADLINE_DAYS, MAX_TITLE, STAGES } from '../lib/config.js';
import { addDays, today } from '../lib/dates.js';
import { friendlyError } from '../lib/format.js';
import { validateDeadline, validateEnum, validateId, validateText } from '../lib/validate.js';
import ProjectFields, { PROJECT_FIELD_IDS } from './ProjectFields.jsx';
import Spinner from './Spinner.jsx';

const EMPTY = { title: '', description: '', deadline: '', stage: 'prototype', facultyGuideUid: '' };
const FIELD_ORDER = ['title', 'description', 'deadline', 'stage', 'facultyGuideUid'];

/** Field errors from the shared validators (validate.js); an empty object when valid. */
function fieldErrors(value, facultyById, todayDate) {
  const checks = {
    title: () => validateText(value.title, MAX_TITLE, { field: 'Title' }),
    description: () =>
      validateText(value.description, MAX_DESCRIPTION, { field: 'Description', required: false }),
    deadline: () => validateDeadline(value.deadline, todayDate),
    stage: () => validateEnum(value.stage, STAGES, 'Stage'),
    facultyGuideUid: () => validateId(value.facultyGuideUid, facultyById, 'faculty guide'),
  };
  const messages = {
    deadline: `Choose a deadline from tomorrow up to ${MAX_PROJECT_DEADLINE_DAYS} days ahead.`,
    facultyGuideUid: 'Choose a faculty guide.',
  };
  const errors = {};
  for (const field of FIELD_ORDER) {
    try {
      checks[field]();
    } catch (error) {
      errors[field] =
        messages[field] ?? `${error.message.charAt(0).toUpperCase()}${error.message.slice(1)}.`;
    }
  }
  return errors;
}

/**
 * Inline "New project" card. Saves through requests.js createProject (the same handler the chat's
 * ProjectDraftCard uses), so validation and the Firestore rules are shared.
 * @param {{ onCreated: (projectId: string) => void, onCancel: () => void, id?: string }} props
 */
export default function NewProjectForm({ onCreated, onCancel, id }) {
  const { user } = useAuth();
  const loader = useCallback(() => loadFaculty(), []);
  const { data: faculty, error: loadError, loading } = useAsync(loader);
  const [value, setValue] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const now = today();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const facultyById = Object.fromEntries((faculty ?? []).map((member) => [member.uid, member]));
    const found = fieldErrors(value, facultyById, now);
    setErrors(found);
    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      document.getElementById(PROJECT_FIELD_IDS[firstInvalid])?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const guide = facultyById[value.facultyGuideUid];
      const projectId = await createProject(user, { ...value, facultyGuideName: guide.name }, now);
      onCreated(projectId);
    } catch (err) {
      console.error('Project creation failed', err);
      setSaveError(err);
      setSaving(false);
    }
  };

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      noValidate
      aria-busy={saving}
      className="card space-y-4 p-5"
    >
      <h3 className="text-lg font-semibold text-ink">New project</h3>
      {loading && !faculty && <Spinner label="Loading faculty" />}
      {loadError && (
        <p role="alert" className="text-sm text-red-800">
          {friendlyError(loadError)}
        </p>
      )}
      {faculty && (
        <ProjectFields
          value={value}
          onChange={(field, next) => setValue((current) => ({ ...current, [field]: next }))}
          faculty={faculty}
          minDate={addDays(now, 1)}
          maxDate={addDays(now, MAX_PROJECT_DEADLINE_DAYS)}
          errors={errors}
          showDescription
        />
      )}
      {saveError && (
        <p role="alert" className="text-sm text-red-800">
          {friendlyError(saveError)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={saving || !faculty} className="btn-primary">
          {saving ? 'Saving…' : 'Create project'}
        </button>
        <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
