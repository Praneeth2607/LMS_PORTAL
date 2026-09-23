import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { checkHealth } from './services/api.js';

function Home() {
  const [status, setStatus] = useState({ state: 'loading', message: 'Checking API…' });

  useEffect(() => {
    checkHealth()
      .then((res) => setStatus({ state: 'ok', message: res.message }))
      .catch((err) => setStatus({ state: 'error', message: err.message || 'API unreachable' }));
  }, []);

  const badge = {
    loading: 'bg-slate-100 text-slate-600',
    ok: 'bg-emerald-100 text-emerald-700',
    error: 'bg-rose-100 text-rose-700',
  }[status.state];

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <p className="text-sm font-medium text-indigo-600">Aurex&apos;26 · Tech Comrades</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">CICT Workshop Management Portal</h1>
        <p className="mt-2 text-slate-600">
          Workshops, registrations, attendance and certificates, all in one place.
        </p>
        <div className={`mt-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${badge}`}>
          <span className="h-2 w-2 rounded-full bg-current" />
          {status.message}
        </div>
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center text-slate-600">
      Page not found
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
