import { Link, useLocation } from 'react-router-dom';
import useAgent from '../hooks/useAgent.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { ERROR_CODES } from '../lib/errors.js';
import { friendlyError } from '../lib/format.js';
import ChatInput from '../components/ChatInput.jsx';
import ChatMessage from '../components/ChatMessage.jsx';
import EquipmentListCard from '../components/EquipmentListCard.jsx';
import PlanCard from '../components/PlanCard.jsx';
import ProjectDraftCard from '../components/ProjectDraftCard.jsx';
import PromptChips from '../components/PromptChips.jsx';
import Spinner from '../components/Spinner.jsx';

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

/** Chat with the LabLink assistant: log, inline cards, prompt chips and an AI-unavailable fallback. */
export default function Chat() {
  useDocumentTitle('Assistant');
  const location = useLocation();
  const { messages, pending, error, send, confirmCard, cancelCard } = useAgent();
  const aiDown = error?.code === ERROR_CODES.AI_UNAVAILABLE;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Lab assistant</h1>
      {location.state?.notice && (
        <p
          role="status"
          className="rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-blue-900"
        >
          {location.state.notice}
        </p>
      )}
      <p className="text-slate-700">
        Describe what you want to build. The assistant finds equipment, plans slots and prepares the
        booking; nothing happens until you press Confirm.
      </p>

      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        aria-busy={pending}
        className="flex min-h-40 flex-col gap-3 rounded-lg border border-slate-200 bg-slate-100 p-3"
      >
        {messages.length === 0 && (
          <p className="text-slate-700">No messages yet. Try a suggested prompt below.</p>
        )}
        {messages.map((message) =>
          message.role === 'card' ? (
            <div key={message.id}>{renderCard(message, confirmCard, cancelCard)}</div>
          ) : (
            <ChatMessage
              key={message.id}
              speaker={message.role}
              text={message.text}
              focus={message.focus}
            />
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2 text-slate-700">
            <Spinner label="Assistant is typing" />
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-900"
        >
          <p>{error.code ? friendlyError(error.code) : error.message}</p>
          {aiDown && (
            <Link to="/catalogue" className="font-semibold underline">
              Open the catalogue
            </Link>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <PromptChips onPick={(prompt) => send(prompt)} disabled={pending} />
      )}
      <ChatInput
        onSend={(text) => send(text)}
        disabled={pending}
        initialValue={location.state?.prefill ?? ''}
      />
    </div>
  );
}
