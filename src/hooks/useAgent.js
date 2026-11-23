import { useContext } from 'react';
import { AgentContext } from '../context/AgentContext.jsx';

/**
 * Reads the chat agent context.
 * @returns {object} `{ messages, pending, error, send, confirmCard, cancelCard }`.
 * @throws {Error} If used outside AgentProvider.
 */
export default function useAgent() {
  const value = useContext(AgentContext);
  if (!value) throw new Error('useAgent must be used inside AgentProvider');
  return value;
}
