import { useEffect, useRef } from 'react';

const STYLES = {
  user: 'ml-auto bg-blue-800 text-white',
  assistant: 'mr-auto border border-slate-200 bg-white text-slate-900',
};
const SPEAKERS = { user: 'You', assistant: 'Assistant' };

/**
 * One chat message, rendered as a plain React text node (never as HTML) with pre-wrap.
 * @param {{ speaker: 'user' | 'assistant', text: string, focus?: boolean }} props
 *   `focus` moves keyboard focus here (used for results posted after a Confirm).
 */
export default function ChatMessage({ speaker, text, focus = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <div
      ref={ref}
      tabIndex={focus ? -1 : undefined}
      className={`max-w-[85%] rounded-lg px-4 py-2 whitespace-pre-wrap break-words ${STYLES[speaker]}`}
    >
      <span className="sr-only">{SPEAKERS[speaker]}: </span>
      {text}
    </div>
  );
}
