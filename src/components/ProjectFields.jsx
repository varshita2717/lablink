import { MAX_TITLE, STAGES, STAGE_LABELS } from '../lib/config.js';

/**
 * Inline fields for a new project (manual request path, when the assistant is not used).
 * @param {{ value: { title: string, deadline: string, stage: string, facultyGuideUid: string },
 *           onChange: (field: string, value: string) => void, faculty: { uid: string, name: string }[],
 *           minDate: string }} props
 */
export default function ProjectFields({ value, onChange, faculty, minDate }) {
  const handle = (event) => onChange(event.target.name, event.target.value);
  return (
    <fieldset className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-2">
      <legend className="px-1 text-sm font-semibold text-ink">New project</legend>
      <div className="sm:col-span-2">
        <label htmlFor="project-title" className="text-sm font-medium">
          Project title (required)
        </label>
        <input
          id="project-title"
          name="title"
          value={value.title}
          maxLength={MAX_TITLE}
          onChange={handle}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="project-deadline" className="text-sm font-medium">
          Deadline (required)
        </label>
        <input
          id="project-deadline"
          name="deadline"
          type="date"
          min={minDate}
          value={value.deadline}
          onChange={handle}
          className="field"
        />
      </div>
      <div>
        <label htmlFor="project-stage" className="text-sm font-medium">
          Stage (required)
        </label>
        <select
          id="project-stage"
          name="stage"
          value={value.stage}
          onChange={handle}
          className="field"
        >
          {STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="project-guide" className="text-sm font-medium">
          Faculty guide (required)
        </label>
        <select
          id="project-guide"
          name="facultyGuideUid"
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
      </div>
    </fieldset>
  );
}
