import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useAuth from '../hooks/useAuth.js';
import useSlotSelection from '../hooks/useSlotSelection.js';
import { confirmPlan, createProject, loadMyProjects } from '../lib/requests.js';
import { loadFaculty } from '../lib/users.js';
import { MAX_JUSTIFICATION } from '../lib/config.js';
import { addDays, today } from '../lib/dates.js';
import { formatSession } from '../lib/format.js';
import ErrorMessage from './ErrorMessage.jsx';
import ProjectFields from './ProjectFields.jsx';
import SlotSelectionFields from './SlotSelectionFields.jsx';
import Spinner from './Spinner.jsx';

const NEW_PROJECT = 'new';
const EMPTY_PROJECT = { title: '', deadline: '', stage: 'prototype', facultyGuideUid: '' };

/** First problem with the form, as text for the alert; '' when it can be sent. */
function formProblem({ selection, unitsValid, projectId, newProject, justification }) {
  if (!selection) return 'Select a time on the grid.';
  if (!unitsValid) return 'Enter a valid number of units.';
  if (!projectId) return 'Choose a project or create a new one.';
  if (
    projectId === NEW_PROJECT &&
    (!newProject.title.trim() || !newProject.deadline || !newProject.facultyGuideUid)
  ) {
    return 'Give the new project a title, a deadline and a faculty guide.';
  }
  if (!justification.trim()) return 'Explain briefly why you need this equipment.';
  return '';
}

/**
 * Manual access request for approval equipment (works without the assistant): pick a time,
 * choose or create a project, justify, and send it to the faculty guide. Uses the same
 * confirmPlan path as the chat, so approval and hazard rules are recomputed from data.
 * @param {{ item: object, dates: string[], remainingByDate: Record<string, number[]> }} props
 */
export default function RequestForm({ item, dates, remainingByDate }) {
  const { user } = useAuth();
  const slots = useSlotSelection(item);
  const loader = useCallback(async () => {
    const [projects, faculty] = await Promise.all([loadMyProjects(user.uid), loadFaculty()]);
    return { projects, faculty };
  }, [user.uid]);
  const { data, error: loadError, loading, reload } = useAsync(loader);
  const [projectId, setProjectId] = useState('');
  const [newProject, setNewProject] = useState(EMPTY_PROJECT);
  const [justification, setJustification] = useState('');
  const [problem, setProblem] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');

  const createNewProject = () => {
    const guide = data.faculty.find((member) => member.uid === newProject.facultyGuideUid);
    const draft = { ...newProject, description: '', facultyGuideName: guide?.name ?? '' };
    return createProject(user, draft, today());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = formProblem({ ...slots, projectId, newProject, justification });
    setProblem(found);
    setSuccess('');
    if (found) return;
    setPending(true);
    setError(null);
    try {
      const id = projectId === NEW_PROJECT ? await createNewProject() : projectId;
      const plan = {
        project: { id },
        items: [{ equipmentId: item.id, qty: slots.qty }],
        sessions: [slots.selection],
        justification: justification.trim(),
      };
      await confirmPlan(plan, user);
      setSuccess(
        `Request for ${item.name} on ${formatSession(slots.selection)} sent for faculty approval.`,
      );
      slots.clear();
      setJustification('');
      if (projectId === NEW_PROJECT) {
        setProjectId(id);
        setNewProject(EMPTY_PROJECT);
        reload();
      }
    } catch (err) {
      console.error('Manual request failed', err);
      setError(err);
    } finally {
      setPending(false);
    }
  };

  if (loadError) return <ErrorMessage error={loadError} onRetry={reload} />;
  if (loading && !data) return <Spinner label="Loading your projects" />;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4" aria-busy={pending}>
      <SlotSelectionFields
        item={item}
        dates={dates}
        remainingByDate={remainingByDate}
        slots={slots}
      />
      <div className="max-w-md">
        <label htmlFor="request-project" className="font-medium">
          Project (required)
        </label>
        <select
          id="request-project"
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="field"
        >
          <option value="">Choose a project</option>
          {data.projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.title}
            </option>
          ))}
          <option value={NEW_PROJECT}>New project…</option>
        </select>
      </div>
      {projectId === NEW_PROJECT && (
        <ProjectFields
          value={newProject}
          onChange={(field, value) => setNewProject((current) => ({ ...current, [field]: value }))}
          faculty={data.faculty}
          minDate={addDays(today(), 1)}
        />
      )}
      <div>
        <label htmlFor="request-justification" className="font-medium">
          Why you need it (required, up to {MAX_JUSTIFICATION} characters)
        </label>
        <textarea
          id="request-justification"
          rows={3}
          maxLength={MAX_JUSTIFICATION}
          value={justification}
          onChange={(event) => setJustification(event.target.value)}
          className="field"
        />
      </div>
      {problem && (
        <p role="alert" className="text-sm text-red-800">
          {problem}
        </p>
      )}
      {error && <ErrorMessage error={error} />}
      <p aria-live="polite" className="text-green-900">
        {success && (
          <>
            {success}{' '}
            <Link to="/my-requests" className="font-semibold underline">
              Track it in My requests
            </Link>
          </>
        )}
      </p>
      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Sending…' : `Request approval for ${item.name}`}
      </button>
    </form>
  );
}
