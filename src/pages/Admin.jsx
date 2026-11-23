import { useState } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import { seedDatabase } from '../lib/seed.js';
import { today } from '../lib/dates.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import Spinner from '../components/Spinner.jsx';

/** Admin page. FAST TRACK scope: the demo seed button only. */
export default function Admin() {
  useDocumentTitle('Admin');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSeed = async () => {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await seedDatabase(today()));
    } catch (err) {
      console.error('Seeding failed', err);
      setError(err);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Admin</h1>
      <section
        aria-labelledby="seed-heading"
        className="mt-6 rounded-lg border border-slate-200 bg-white p-5"
      >
        <h2 id="seed-heading" className="text-lg font-semibold">
          Demo data
        </h2>
        <p className="mt-2 text-slate-700">
          Loads the demo labs, equipment, experiments, users and the seeded oscilloscope conflict,
          with dates relative to today. It stops if any equipment already exists.
        </p>
        <button
          type="button"
          onClick={handleSeed}
          disabled={pending}
          className="mt-4 rounded-md bg-blue-800 px-4 py-2 font-semibold text-white hover:bg-blue-900 disabled:opacity-60"
        >
          Seed demo data
        </button>
        <div aria-live="polite" className="mt-4">
          {pending && <Spinner label="Seeding demo data" />}
          {result && (
            <p className={result.seeded ? 'text-green-900' : 'text-amber-900'}>{result.message}</p>
          )}
        </div>
        {error && <ErrorMessage error={error} />}
      </section>
    </div>
  );
}
