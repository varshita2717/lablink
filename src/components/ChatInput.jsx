import { useState } from 'react';
import { MAX_CHAT_INPUT } from '../lib/config.js';

/**
 * Labelled message box: Enter sends, Shift+Enter adds a new line. Disabled while a reply is pending.
 * @param {{ onSend: (text: string) => void, disabled: boolean, initialValue?: string }} props
 */
export default function ChatInput({ onSend, disabled, initialValue = '' }) {
  const [text, setText] = useState(initialValue);
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex-1">
        <label htmlFor="chat-input" className="text-sm font-medium text-slate-700">
          Message the assistant (Enter to send, Shift+Enter for a new line)
        </label>
        <textarea
          id="chat-input"
          rows={2}
          maxLength={MAX_CHAT_INPUT}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          className="field resize-y"
        />
      </div>
      <button
        type="submit"
        aria-label="Send message"
        disabled={!canSend}
        className="btn-primary mb-0.5"
      >
        Send
      </button>
    </form>
  );
}
