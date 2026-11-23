import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync.js';
import useAuth from '../hooks/useAuth.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { loadMyProjects, loadMyRequests } from '../lib/requests.js';
import { STAGE_LABELS } from '../lib/config.js';
import { formatDate } from '../lib/format.js';
import AlternativesList from '../components/AlternativesList.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import RequestDetails from '../components/RequestDetails.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Spinner from '../components/Spinner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

/** A student's projects and access requests with status, comments and alternatives. */
export default function MyRequests() {
  useDocumentTitle('My requests');
  const { user } = useAuth();
  const loader = useCallback(async () => {
    const [projects, requests] = await Promise.all([
      loadMyProjects(user.uid),
      loadMyRequests(user.uid),
    ]);
    return { projects, requests };
  }, [user.uid]);
  const { data, error, loading, reload } = useAsync(loader);

  return (
    <div aria-busy={loading}>
      <PageHeader
        title="My projects and requests"
        description="Your projects and the access requests sent to faculty, with their status."
      >
        <button type="button" onClick={reload} disabled={loading} className="btn-secondary">
          Refresh
        </button>
      </PageHeader>
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner label="Loading requests" />}
      {data && (
        <>
          <section aria-labelledby="projects-heading" className="mt-6">
            <h2 id="projects-heading" className="text-xl font-semibold">
              Projects
            </h2>
            {data.projects.length === 0 ? (
              <EmptyState title="No projects yet" icon="flask">
                Describe your project to the assistant and it will help you register it.
                <div className="mt-3">
                  <Link to="/" className="btn-primary">
                    Open the assistant
                  </Link>
                </div>
              </EmptyState>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {data.projects.map((project) => (
                  <li key={project.id} className="card p-5">
                    <p className="font-semibold">{project.title}</p>
                    <p className="text-sm text-slate-700">
                      Deadline {formatDate(project.deadline)} · {STAGE_LABELS[project.stage]} ·
                      Guide {project.facultyGuideName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section aria-labelledby="requests-heading" className="mt-8">
            <h2 id="requests-heading" className="text-xl font-semibold">
              Requests
            </h2>
            {data.requests.length === 0 ? (
              <EmptyState title="No requests yet" icon="inbox">
                Equipment that needs approval is requested through the assistant.
                <div className="mt-3">
                  <Link to="/catalogue" className="btn-primary">
                    Browse the catalogue
                  </Link>
                </div>
              </EmptyState>
            ) : (
              <ul className="mt-3 space-y-3">
                {data.requests.map((request) => (
                  <li key={request.id} className="card p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{request.projectTitle}</h3>
                      <StatusBadge status={request.status} />
                    </div>
                    <RequestDetails request={request} />
                    {request.facultyComment && (
                      <p className="mt-3 text-sm">
                        <span className="font-semibold">Faculty comment: </span>
                        {request.facultyComment}
                      </p>
                    )}
                    {request.status === 'conflict_lost' && (
                      <div className="mt-3 rounded-lg border border-orange-300 bg-orange-50 p-3 text-sm text-orange-950">
                        <p className="font-semibold">
                          Another request was allocated these hours. Suggested alternatives:
                        </p>
                        <AlternativesList alternatives={request.alternatives} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
