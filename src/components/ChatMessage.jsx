import { useEffect, useRef } from 'react';

const BUBBLES = {
  user: 'rounded-br-sm bg-indigo-600 text-white',
  assistant: 'rounded-bl-sm border border-slate-200 bg-white text-slate-900',
};
const AVATARS = {
  user: 'bg-indigo-100 text-indigo-800',
  assistant: 'bg-teal-100 text-teal-800',
};
const SPEAKERS = { user: 'You', assistant: 'Assistant' };

/**
 * One chat message, rendered as a plain React text node (never as HTML) with pre-wrap, beside a
 * decorative initials avatar.
 * @param {{ speaker: 'user' | 'assistant', text: string, initials?: string, focus?: boolean }} props
 *   `focus` moves keyboard focus here (used for results posted after a Confirm).
 */
export default function ChatMessage({ speaker, text, initials, focus = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  const isUser = speaker === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        aria-hidden="true"
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${AVATARS[speaker]}`}
      >
        {initials ?? (isUser ? 'You' : 'AI')}
      </span>
      <div
        ref={ref}
        tabIndex={focus ? -1 : undefined}
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap break-words shadow-sm ${BUBBLES[speaker]}`}
      >
        <span className="sr-only">{SPEAKERS[speaker]}: </span>
        {text}
      </div>
    </div>
  );
}
