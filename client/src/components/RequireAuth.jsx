import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { homeFor } from '../utils/roles.js';
import { LoadingBlock } from './ui.jsx';
import Icon from './Icon.jsx';

// Route guard. Redirects guests to /login?next=… and blocks wrong roles.
// The backend enforces the same rules; this only keeps the UI honest.
export default function RequireAuth({ roles }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-10">
        <LoadingBlock label="Checking your session" />
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
        <span className="mb-6 grid h-16 w-16 place-items-center rounded-full bg-white" aria-hidden="true">
          <Icon name="shield" size={26} />
        </span>
        <h1 className="section-title">This area isn&rsquo;t available to your account</h1>
        <p className="mt-3 text-slate">You&rsquo;re signed in as {user.name}. Head back to your own dashboard.</p>
        <Link to={homeFor(user)} className="btn btn-primary mt-8">
          Go to my dashboard
        </Link>
      </div>
    );
  }

  return <Outlet />;
}
