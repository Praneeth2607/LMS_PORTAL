import { useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { getSession } from '../../services/sessionService.js';
import { getWorkshop } from '../../services/workshopService.js';
import { markAttendance } from '../../services/attendanceService.js';
import { ErrorState, Eyebrow, LoadingBlock, Spinner } from '../../components/ui.jsx';
import Icon from '../../components/Icon.jsx';
import { formatDate, formatDateTime, formatTime } from '../../utils/format.js';
import { homeFor } from '../../utils/roles.js';

// Maps backend errors from POST /sessions/:id/attendance/mark to a state.
function outcomeFor(error, usedToken) {
  switch (error.status) {
    case 409:
      return { key: 'already', title: 'Already marked', icon: 'check' };
    case 410:
      return { key: 'expired', title: 'This QR code has expired', icon: 'clock' };
    case 403:
      return { key: 'not-registered', title: "You're not registered for this workshop", icon: 'users' };
    case 401:
      return { key: 'auth', title: 'Sign in required', icon: 'shield' };
    case 404:
      return { key: 'missing', title: 'Session not found', icon: 'alert' };
    case 400:
      return /not open/i.test(error.message)
        ? { key: 'closed', title: 'Attendance isn’t open', icon: 'clock' }
        : { key: 'invalid', title: usedToken ? 'Invalid QR code' : 'Invalid code', icon: 'close' };
    default:
      return { key: 'error', title: 'Something went wrong', icon: 'alert' };
  }
}

function StatusCircle({ icon, strong }) {
  return (
    <span
      className={`grid h-20 w-20 place-items-center rounded-full ${strong ? 'bg-ink text-canvas' : 'bg-white text-ink'}`}
      aria-hidden="true"
    >
      <Icon name={icon} size={30} strokeWidth={strong ? 2 : 1.75} />
    </span>
  );
}

export default function AttendancePage() {
  useDocumentTitle('Mark attendance');
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const token = params.get('token');
  const { user, ready } = useAuth();
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const mark = useAction();

  const sessionQuery = useAsync(async () => {
    const session = await getSession(sessionId);
    const workshop = await getWorkshop(session.workshopId).catch(() => null);
    return { session, workshop };
  }, [sessionId, user?.id]);

  const submit = async (payload) => {
    const res = await mark.run(() => markAttendance(sessionId, payload));
    if (res.ok) setResult(res.data);
  };

  const here = `${location.pathname}${location.search}`;
  const session = sessionQuery.data?.session;
  const workshop = sessionQuery.data?.workshop;
  const outcome = mark.error ? outcomeFor(mark.error, Boolean(token)) : null;

  let body;
  if (!ready || sessionQuery.loading) {
    body = <LoadingBlock rows={2} label="Loading session" />;
  } else if (sessionQuery.error) {
    body = <ErrorState error={sessionQuery.error} title="Session not found" />;
  } else if (result) {
    body = (
      <div className="text-center" role="status">
        <div className="flex justify-center">
          <StatusCircle icon="check" strong />
        </div>
        <h2 className="section-title mt-8">You&rsquo;re marked present</h2>
        <p className="mt-3 text-charcoal">
          {result.sessionTitle} · {result.workshopTitle}
        </p>
        <p className="mt-1 text-slate">Recorded {formatDateTime(result.markedAt)}</p>
        <Link to={`/participant/workshops/${result.workshopId}`} className="btn btn-primary mt-10">
          View my attendance
        </Link>
      </div>
    );
  } else if (!user) {
    body = (
      <div className="text-center">
        <div className="flex justify-center">
          <StatusCircle icon="shield" />
        </div>
        <h2 className="section-title mt-8">Sign in to mark attendance</h2>
        <p className="mt-3 text-charcoal">You&rsquo;ll come straight back here after signing in.</p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to={`/login?next=${encodeURIComponent(here)}`} className="btn btn-primary btn-lg">
            Sign in
          </Link>
          <Link to={`/register?next=${encodeURIComponent(here)}`} className="btn btn-secondary btn-lg">
            Create account
          </Link>
        </div>
      </div>
    );
  } else if (user.role !== 'PARTICIPANT') {
    body = (
      <div className="text-center">
        <h2 className="section-title">Attendance is for participants</h2>
        <p className="mt-3 text-charcoal">
          You&rsquo;re signed in as an {user.role.toLowerCase()}. Participants scan this code to check in.
        </p>
        <Link to={homeFor(user)} className="btn btn-secondary mt-8">
          Back to dashboard
        </Link>
      </div>
    );
  } else if (outcome?.key === 'already') {
    body = (
      <div className="text-center" role="status">
        <div className="flex justify-center">
          <StatusCircle icon="check" strong />
        </div>
        <h2 className="section-title mt-8">{outcome.title}</h2>
        <p className="mt-3 text-charcoal">{mark.error.message}</p>
        <Link to={`/participant/workshops/${session.workshopId}`} className="btn btn-primary mt-10">
          View my attendance
        </Link>
      </div>
    );
  } else {
    body = (
      <div>
        {outcome && (
          <div className="mb-10 rounded-[28px] border border-clay bg-white p-6" role="alert">
            <div className="flex items-center gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-clay text-clay" aria-hidden="true">
                <Icon name={outcome.icon} />
              </span>
              <div>
                <p className="text-[20px] font-medium">{outcome.title}</p>
                <p className="text-charcoal">{mark.error.message}</p>
              </div>
            </div>
            {outcome.key === 'expired' && (
              <p className="mt-4 text-charcoal">Ask the organizer to show a fresh QR code, or enter the code on screen below.</p>
            )}
            {outcome.key === 'not-registered' && (
              <Link to={`/workshops/${session.workshopId}`} className="btn btn-secondary mt-4">
                View workshop
              </Link>
            )}
          </div>
        )}

        {token && !outcome && (
          <div className="text-center">
            <div className="flex justify-center">
              <StatusCircle icon="qr" />
            </div>
            <h2 className="section-title mt-8">Ready to check in</h2>
            <p className="mt-3 text-charcoal">Confirm to record your attendance for this session.</p>
            <button
              type="button"
              className="btn btn-primary btn-lg mt-10 w-full sm:w-auto"
              disabled={mark.pending}
              onClick={() => submit({ token })}
            >
              {mark.pending && <Spinner />}
              {mark.pending ? 'Marking attendance…' : 'Mark me present'}
            </button>
          </div>
        )}

        {(!token || outcome) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) submit({ code: code.trim() });
            }}
          >
            <h2 className="card-title">Enter the attendance code</h2>
            <p className="mt-2 text-charcoal">Type the 6-character code shown on the organizer&rsquo;s screen.</p>
            <label htmlFor="attendance-code" className="sr-only">
              Attendance code
            </label>
            <input
              id="attendance-code"
              className="input mt-6 text-center font-medium uppercase tracking-[0.3em] !text-[28px]"
              maxLength={8}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              placeholder="••••••"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button type="submit" className="btn btn-primary btn-lg mt-6 w-full" disabled={mark.pending || !code.trim()}>
              {mark.pending && <Spinner />}
              {mark.pending ? 'Marking attendance…' : 'Mark me present'}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-12 md:pt-20">
      <div className="text-center">
        <Eyebrow>Attendance</Eyebrow>
        {session && (
          <>
            <h1 className="mt-5 text-[28px] font-medium leading-tight tracking-[-0.02em] md:text-[36px]">{session.title}</h1>
            <p className="mt-2 text-charcoal">
              {workshop?.title && <span className="block font-medium">{workshop.title}</span>}
              {formatDate(session.sessionDate)} · {formatTime(session.startTime)} – {formatTime(session.endTime)}
            </p>
          </>
        )}
      </div>
      <div className="panel mt-10 bg-lifted md:p-12">{body}</div>
    </div>
  );
}
