import { Link, useLocation } from 'react-router-dom';
import useAgent from '../hooks/useAgent.js';
import useAuth from '../hooks/useAuth.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { ERROR_CODES } from '../lib/errors.js';
import { friendlyError } from '../lib/format.js';
import ChatInput from '../components/ChatInput.jsx';
import ChatMessage from '../components/ChatMessage.jsx';
import EmptyState from '../components/EmptyState.jsx';
import EquipmentListCard from '../components/EquipmentListCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import PlanCard from '../components/PlanCard.jsx';
import ProjectDraftCard from '../components/ProjectDraftCard.jsx';
import PromptChips from '../components/PromptChips.jsx';
import Spinner from '../components/Spinner.jsx';

export const RETRYING_TEXT = 'The assistant is busy, retrying…';

/** Renders a card message by type. */
function renderCard(message, confirmCard, cancelCard) {
  const props = {
    card: message.card,
    onConfirm: () => confirmCard(message),
    onCancel: () => cancelCard(message),
  };
  if (message.card.type === 'equipmentList') return <EquipmentListCard data={message.card.data} />;
  if (message.card.type === 'projectDraft') return <ProjectDraftCard {...props} />;
  return <PlanCard {...props} />;
}

/** Up to two initials for the user's avatar (decorative). */
function initialsOf(name) {
  const letters = String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase());
  return letters.length ? letters.slice(0, 2).join('') : 'You';
}

/** Chat with the LabLink assistant: log, inline cards, prompt chips and an AI-unavailable fallback. */
export default function Chat() {
  useDocumentTitle('Assistant');
  const location = useLocation();
  const { user } = useAuth();
  const { messages, pending, retrying, error, send, confirmCard, cancelCard } = useAgent();
  const aiDown = error?.code === ERROR_CODES.AI_UNAVAILABLE;
  const userInitials = initialsOf(user?.name);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Lab assistant"
        description="Describe what you want to build. The assistant finds equipment, plans slots and prepares the booking; nothing happens until you press Confirm."
      />
      {location.state?.notice && (
        <p role="status" className="rounded-lg border border-line bg-cream px-4 py-2 text-maroon">
          {location.state.notice}
        </p>
      )}

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        aria-busy={pending}
        className="flex min-h-64 flex-col gap-4 rounded-xl border border-line bg-cream/70 p-4"
      >
        {messages.length === 0 && (
          <EmptyState title="No messages yet" icon="chat">
            Try a suggested prompt below, or describe your project in your own words.
          </EmptyState>
        )}
        {messages.map((message) =>
          message.role === 'card' ? (
            <div key={message.id}>{renderCard(message, confirmCard, cancelCard)}</div>
          ) : (
            <ChatMessage
              key={message.id}
              speaker={message.role}
              text={message.text}
              initials={message.role === 'user' ? userInitials : 'AI'}
              focus={message.focus}
            />
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2">
            <Spinner label={retrying ? RETRYING_TEXT : 'Assistant is typing'} />
            {retrying && (
              <p aria-hidden="true" className="text-sm text-muted">
                {RETRYING_TEXT}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900"
        >
          <p>{error.code ? friendlyError(error.code) : error.message}</p>
          {aiDown && (
            <Link to="/catalogue" className="btn-secondary mt-2">
              Open the catalogue
            </Link>
          )}
        </div>
      )}

      <div className="sticky bottom-0 z-10 space-y-3 rounded-xl border border-line bg-surface/95 p-4 shadow-md backdrop-blur">
        {messages.length === 0 && (
          <PromptChips onPick={(prompt) => send(prompt)} disabled={pending} />
        )}
        <ChatInput
          onSend={(text) => send(text)}
          disabled={pending}
          initialValue={location.state?.prefill ?? ''}
        />
      </div>
    </div>
  );
}
