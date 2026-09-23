import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { TextField, fieldErrors } from '../../components/Form.jsx';
import { Eyebrow, Notice, Orbit, Spinner } from '../../components/ui.jsx';
import { destinationAfterAuth, safeNext } from '../../utils/roles.js';

function AuthShell({ eyebrow, title, intro, children, footer }) {
  return (
    <div className="mx-auto grid max-w-[1280px] gap-12 px-4 pt-12 md:px-8 md:pt-24 lg:grid-cols-2 lg:gap-24">
      <div className="relative">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display mt-6 max-w-[12ch]">{title}</h1>
        <p className="mt-6 max-w-md text-[18px] text-charcoal">{intro}</p>
        <Orbit variant="arc" className="mt-16 h-40 w-full max-w-md" />
      </div>
      <div className="panel self-start bg-white md:p-12">
        {children}
        <p className="mt-8 border-t rule pt-6 text-charcoal">{footer}</p>
      </div>
    </div>
  );
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [form, setForm] = useState({ email: '', password: '' });
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);

  if (user) return <Navigate to={destinationAfterAuth(next, user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await run(() => login(form));
    if (result.ok) navigate(destinationAfterAuth(next, result.data), { replace: true });
  };

  const registerLink = `/register${next ? `?next=${encodeURIComponent(next)}` : ''}`;

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to continue"
      intro="Pick up where you left off: your workshops, sessions, attendance and certificates."
      footer={
        <>
          New here?{' '}
          <Link to={registerLink} className="font-medium link-ink">
            Create an account
          </Link>
        </>
      }
    >
      <h2 className="card-title mb-8">Sign in</h2>
      {next?.startsWith('/attendance/') && (
        <Notice className="mb-6">Sign in to mark your attendance. You&rsquo;ll return to the session right after.</Notice>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          error={errors.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          error={errors.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
        />
        {error && !Object.keys(errors).length && <Notice tone="error">{error.message}</Notice>}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
          {pending && <Spinner />}
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { user, register } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);

  if (user) return <Navigate to={destinationAfterAuth(next, user)} replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await run(() => register(form));
    if (!result.ok) return;
    // Institute (@cict.in) sign-ups are organizers, so a participant-only next path falls back to their dashboard.
    navigate(destinationAfterAuth(next, result.data), { replace: true });
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <AuthShell
      eyebrow="Join CICT workshops"
      title="Create your account"
      intro="One account for registering, checking in to sessions and keeping your certificates."
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-medium link-ink">
            Sign in
          </Link>
        </>
      }
    >
      <h2 className="card-title mb-8">Create account</h2>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        <TextField label="Full name" autoComplete="name" required value={form.name} error={errors.name} onChange={set('name')} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          error={errors.email}
          hint="CICT staff: use your @cict.in email to get organizer access."
          onChange={set('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={form.password}
          error={errors.password}
          hint="At least 8 characters."
          onChange={set('password')}
        />
        {error && !Object.keys(errors).length && <Notice tone="error">{error.message}</Notice>}
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
          {pending && <Spinner />}
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  );
}
