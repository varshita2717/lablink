/** The three rehearsed demo prompts (SPEC 13.6). */
export const DEMO_PROMPTS = [
  "I want to heat an acid to 200°C for my project but I don't know what equipment I need.",
  'Register my project: Acid Reaction Study, deadline in 12 days, prototype stage, guide Dr. Kavita Rao.',
  'I need 3 hours, 2 sessions a week.',
];

/**
 * Suggested prompts as buttons.
 * @param {{ onPick: (prompt: string) => void, disabled: boolean, prompts?: string[] }} props
 */
export default function PromptChips({ onPick, disabled, prompts = DEMO_PROMPTS }) {
  return (
    <ul aria-label="Suggested prompts" className="flex flex-wrap gap-2">
      {prompts.map((prompt) => (
        <li key={prompt}>
          <button
            type="button"
            onClick={() => onPick(prompt)}
            disabled={disabled}
            className="rounded-full border border-indigo-200 bg-white px-4 py-2 text-left text-sm font-medium text-indigo-800 shadow-sm hover:border-indigo-600 hover:bg-indigo-50 disabled:opacity-60 motion-safe:transition-colors"
          >
            {prompt}
          </button>
        </li>
      ))}
    </ul>
  );
}
