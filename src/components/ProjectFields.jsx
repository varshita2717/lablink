import { MAX_DESCRIPTION, MAX_TITLE, STAGES, STAGE_LABELS } from '../lib/config.js';

/** DOM ids of the fields, so callers can move focus to the first invalid one. */
export const PROJECT_FIELD_IDS = {
  title: 'project-title',
  description: 'project-description',
  deadline: 'project-deadline',
  stage: 'project-stage',
  facultyGuideUid: 'project-guide',
};

/**
 * Labelled fields for a new project. Errors are announced (role="alert") and linked to their field
 * with aria-describedby.
 * @param {{ value: object, onChange: (field: string, value: string) => void,
 *           faculty: { uid: string, name: string }[], minDate: string, maxDate?: string,
 *           errors?: Record<string, string>, showDescription?: boolean }} props
 */
export default function ProjectFields({
  value,
  onChange,
  faculty,
  minDate,
  maxDate,
  errors = {},
  showDescription = false,
}) {
  const handle = (event) => onChange(event.target.name, event.target.value);
  const a11y = (field) => ({
    id: PROJECT_FIELD_IDS[field],
    name: field,
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${PROJECT_FIELD_IDS[field]}-error` : undefined,
  });
  const error = (field) =>
    errors[field] && (
      <p
        id={`${PROJECT_FIELD_IDS[field]}-error`}
        role="alert"
        className="mt-1 text-sm text-red-800"
      >
        {errors[field]}
      </p>
    );
  const label = (field, text) => (
    <label htmlFor={PROJECT_FIELD_IDS[field]} className="text-sm font-medium">
      {text}
    </label>
  );

  return (
    <fieldset className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold text-ink">New project</legend>
      <div className="sm:col-span-2">
        {label('title', `Project title (required, up to ${MAX_TITLE} characters)`)}
        <input
          {...a11y('title')}
          value={value.title}
          maxLength={MAX_TITLE}
          onChange={handle}
          className="field"
        />
        {error('title')}
      </div>
      {showDescription && (
        <div className="sm:col-span-2">
          {label('description', `Description (optional, up to ${MAX_DESCRIPTION} characters)`)}
          <textarea
            {...a11y('description')}
            rows={3}
            value={value.description}
            maxLength={MAX_DESCRIPTION}
            onChange={handle}
            className="field"
          />
          {error('description')}
        </div>
      )}
      <div>
        {label('deadline', 'Deadline (required)')}
        <input
          {...a11y('deadline')}
          type="date"
          min={minDate}
          max={maxDate}
          value={value.deadline}
          onChange={handle}
          className="field"
        />
        {error('deadline')}
      </div>
      <div>
        {label('stage', 'Stage (required)')}
        <select {...a11y('stage')} value={value.stage} onChange={handle} className="field">
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
        {error('stage')}
      </div>
      <div className="sm:col-span-2">
        {label('facultyGuideUid', 'Faculty guide (required)')}
        <select
          {...a11y('facultyGuideUid')}
          value={value.facultyGuideUid}
          onChange={handle}
          className="field"
        >
          <option value="">Choose a faculty guide</option>
          {faculty.map((member) => (
            <option key={member.uid} value={member.uid}>
              {member.name}
            </option>
          ))}
        </select>
        {error('facultyGuideUid')}
      </div>
    </fieldset>
  );
}
