import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { TextAreaField, TextField, fieldErrors } from '../../components/Form.jsx';
import { Eyebrow, Notice, Orbit, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { destinationAfterAuth, homeFor, safeNext } from '../../utils/roles.js';
import { clearAuthNotice, readAuthNotice } from '../../services/api.js';
import { requestOrganizerAccess } from '../../services/authService.js';

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
        {footer && <p className="mt-8 border-t rule pt-6 text-charcoal">{footer}</p>}
      </div>
    </div>
  );
}

const SIGN_IN_TABS = [
  { key: 'participant', label: 'Participant' },
  { key: 'organizer', label: 'Organizer' },
];

export function LoginPage() {
  useDocumentTitle('Sign in');
  const { user, login } = useAuth();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  // ?as=organizer, or a return path into the organizer/admin area, opens the Organizer tab.
  const explicitTab = params.get('as');
  const tab =
    explicitTab === 'organizer' || (!explicitTab && /^\/(organizer|admin)(\/|$)/.test(next || ''))
      ? 'organizer'
      : 'participant';
  const [form, setForm] = useState({ email: '', password: '' });
  const [sessionNotice, setSessionNotice] = useState(readAuthNotice);
  useEffect(clearAuthNotice, []); // show it once
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);

  if (user) return <Navigate to={destinationAfterAuth(next, user)} replace />;

  const switchTab = (key) => {
    setParams(
      (p) => {
        const updated = new URLSearchParams(p);
        updated.set('as', key);
        return updated;
      },
      { replace: true },
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSessionNotice(null);
    // The server only accepts accounts that match the tab (participants on
    // Participant; organizers and admins on Organizer).
    const result = await run(() => login({ ...form, portal: tab === 'organizer' ? 'ORGANIZER' : 'PARTICIPANT' }));
    if (result.ok) navigate(destinationAfterAuth(next, result.data), { replace: true });
  };

  const registerLink = `/register${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  const isOrganizer = tab === 'organizer';

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to continue"
      intro={
        isOrganizer
          ? 'Manage your workshops, sessions, attendance and certificates.'
          : 'Pick up where you left off: your workshops, sessions, attendance and certificates.'
      }
      footer={
        isOrganizer ? (
          <>
            Don&rsquo;t have organizer access?{' '}
            <Link to="/request-organizer-access" className="font-medium link-ink">
              Request organizer access
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link to={registerLink} className="font-medium link-ink">
              Create an account
            </Link>
          </>
        )
      }
    >
      <div role="group" aria-label="Account type" className="mb-8 grid grid-cols-2 gap-1 rounded-full bg-canvas p-1">
        {SIGN_IN_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => switchTab(t.key)}
            className={`min-h-11 rounded-full px-4 font-medium transition-colors ${
              tab === t.key ? 'bg-ink text-canvas' : 'text-charcoal hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <h2 className="card-title mb-8">{isOrganizer ? 'Organizer sign in' : 'Sign in'}</h2>
      {sessionNotice && (
        <Notice tone={/suspended/i.test(sessionNotice) ? 'error' : 'info'} className="mb-6">
          {sessionNotice}
        </Notice>
      )}
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
          {pending ? 'Signing in…' : isOrganizer ? 'Sign in as organizer' : 'Sign in'}
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
    if (result.ok) navigate(destinationAfterAuth(next, result.data), { replace: true });
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
          <span className="mt-2 block">
            Want to run workshops?{' '}
            <Link to="/request-organizer-access" className="font-medium link-ink">
              Request organizer access
            </Link>
          </span>
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

// /request-organizer-access: people without an account ask an admin for an
// organizer account. The password they choose becomes the account password
// once an admin approves.
export function OrganizerRequestPage() {
  useDocumentTitle('Request organizer access');
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', designation: '', reason: '' });
  const [sent, setSent] = useState(null);
  const sentHeading = useRef(null);
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);

  // The confirmation is much shorter than the form: bring it into view and
  // move focus to it so it isn't left off-screen or under the sticky nav.
  useEffect(() => {
    if (!sent) return;
    window.scrollTo({ top: 0 });
    sentHeading.current?.focus();
  }, [sent]);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await run(() => requestOrganizerAccess(form));
    if (result.ok) setSent(result.data);
  };

  return (
    <AuthShell
      eyebrow="For CICT staff"
      title="Request organizer access"
      intro="Organizers create workshops, schedule sessions, take attendance by QR code and issue certificates. An admin reviews every request."
      footer={
        !sent && (
          <>
            Already approved?{' '}
            <Link to="/login?as=organizer" className="font-medium link-ink">
              Sign in as organizer
            </Link>
          </>
        )
      }
    >
      {sent ? (
        <div role="status">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-ink text-canvas" aria-hidden="true">
            <Icon name="check" size={24} strokeWidth={2} />
          </span>
          <h2 ref={sentHeading} tabIndex={-1} className="card-title mt-6 focus:outline-none">
            Request sent
          </h2>
          <p className="mt-3 text-charcoal">
            Thanks, {sent.name.split(' ')[0]}. An admin will review your request. Once it&rsquo;s approved, sign in on the
            Organizer tab with <span className="font-medium">{sent.email}</span> and the password you just chose.
          </p>
          <Link to="/login?as=organizer" className="btn btn-primary mt-8">
            Go to organizer sign in
          </Link>
        </div>
      ) : (
        <>
          <h2 className="card-title mb-8">Your details</h2>
          <form onSubmit={onSubmit} noValidate className="space-y-6">
            <TextField label="Full name" autoComplete="name" required value={form.name} error={errors.name} onChange={set('name')} />
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              error={errors.email}
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
              hint="At least 8 characters. You'll use it to sign in once approved."
              onChange={set('password')}
            />
            <TextField
              label="Designation"
              required
              maxLength={120}
              placeholder="e.g. Assistant Professor, CSE"
              value={form.designation}
              error={errors.designation}
              onChange={set('designation')}
            />
            <TextAreaField
              label="Why do you need organizer access?"
              required
              maxLength={1000}
              hint="A sentence or two, e.g. the workshops you plan to run."
              value={form.reason}
              error={errors.reason}
              onChange={set('reason')}
            />
            {error && !Object.keys(errors).length && <Notice tone="error">{error.message}</Notice>}
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={pending}>
              {pending && <Spinner />}
              {pending ? 'Sending request…' : 'Send request'}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
