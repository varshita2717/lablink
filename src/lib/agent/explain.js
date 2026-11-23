// Allocation explanation (SPEC Section 14). templateExplanation is PURE and shown first;
// explainAllocation asks the model for a short summary and falls back to the template.
import {
  AI_EXPLAIN_MAX_OUTPUT_TOKENS,
  MAX_EXPLANATION_CHARS,
  STAGE_LABELS,
  W_FAIRNESS,
  W_STAGE,
  W_URGENCY,
} from '../config.js';
import { generateText } from './agent.js';
import { buildExplainPrompt } from './prompts.js';
import { formatDate, formatSession, roundScore } from '../format.js';

const percent = (weight) => `${Math.round(weight * 100)}%`;
const score = (value) => roundScore(value).toFixed(2);

function describeWinner(entry) {
  const { urgency, fairness, stage, total } = entry.score;
  return (
    `${entry.studentName} (${entry.projectTitle}) is allocated with a score of ${score(total)}: ` +
    `urgency ${score(urgency)} (deadline ${formatDate(entry.deadline)}), ` +
    `fairness ${score(fairness)} (recent lab use) and stage ${score(stage)} ` +
    `(${STAGE_LABELS[entry.stage] ?? entry.stage}).`
  );
}

function describeLoser(entry) {
  const intro = `${entry.studentName} scored ${score(entry.score.total)}`;
  const alt = entry.alternatives;
  if (!alt || alt.sessions.length === 0) {
    return `${intro}; no alternative slots were found before the deadline, so the faculty guide should discuss options.`;
  }
  const sessions = alt.sessions.map(formatSession).join('; ');
  const swap = alt.substitutions.length
    ? `, using ${alt.substitutions.map((s) => s.replacement.name).join(' and ')} as a substitute`
    : '';
  const partial = alt.complete ? '' : ' (fewer sessions than requested)';
  return `${intro} and is offered ${sessions}${swap}${partial}.`;
}

/**
 * PURE: plain-English explanation of a resolution, built locally from the formula's output.
 * Shown immediately, and used as the fallback when the AI summary is unavailable.
 * @param {{ ranking: object[] }} resolution Output of resolveGroup.
 * @returns {string} Three or more short sentences; empty string for an empty ranking.
 */
export function templateExplanation(resolution) {
  const ranking = resolution?.ranking ?? [];
  if (ranking.length === 0) return '';
  const winners = ranking.filter((entry) => entry.isWinner);
  const losers = ranking.filter((entry) => !entry.isWinner);
  const parts = winners.length
    ? winners.map(describeWinner)
    : ['No request fits the remaining capacity, so nobody is allocated these hours.'];
  parts.push(...losers.map(describeLoser));
  parts.push(
    `Scores weight deadline urgency ${percent(W_URGENCY)}, fairness of recent use ` +
      `${percent(W_FAIRNESS)} and project stage ${percent(W_STAGE)}; the ranking comes from this formula.`,
  );
  return parts.join(' ');
}

/**
 * AI-written explanation of a resolution (3-4 sentences for faculty). Retries busy-model errors
 * like the chat does. Falls back to templateExplanation if the call fails, the text is empty or too
 * long, or it does not name the allocated student (a basic guard against invented facts).
 * @param {{ ranking: object[] }} resolution Output of resolveGroup.
 * @param {{ generate?: (prompt: string, options: object) => Promise<string>,
 *           onRetry?: (attempt: number, delayMs: number) => void }} [options]
 * @returns {Promise<{ text: string, source: 'ai' | 'template' }>}
 */
export async function explainAllocation(resolution, { generate = generateText, onRetry } = {}) {
  const fallback = { text: templateExplanation(resolution), source: 'template' };
  if (!resolution?.ranking?.length) return fallback;
  try {
    const raw = await generate(buildExplainPrompt(resolution), {
      maxOutputTokens: AI_EXPLAIN_MAX_OUTPUT_TOKENS,
      onRetry,
    });
    const text = String(raw ?? '').trim();
    const winner = resolution.ranking.find((entry) => entry.isWinner);
    const namesWinner = !winner || text.includes(winner.studentName.split(' ')[0]);
    if (!text || text.length > MAX_EXPLANATION_CHARS || !namesWinner) return fallback;
    return { text, source: 'ai' };
  } catch (error) {
    console.error('AI explanation unavailable; using the template', error);
    return fallback;
  }
}
