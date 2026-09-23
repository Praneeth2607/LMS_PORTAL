import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle, useInterval, useNow } from '../../hooks/useUtils.js';
import { createSession, deleteSession, listSessions, startSession, updateSession } from '../../services/sessionService.js';
import { getAttendanceGrid, startAttendance, stopAttendance } from '../../services/attendanceService.js';
import { EmptyState, ErrorState, LoadingBlock, Notice, SectionHeader, Spinner, StatusBadge } from '../../components/ui.jsx';
import { SelectField, TextField, fieldErrors } from '../../components/Form.jsx';
import Modal from '../../components/Modal.jsx';
import Icon from '../../components/Icon.jsx';
import {
  attendanceWindowState,
  formatClock,
  formatCountdown,
  formatDate,
  formatDateTime,
  formatTime,
  sessionLiveStatus,
} from '../../utils/format.js';

// ---------------------------------------------------------------- Session form
function SessionForm({ workshop, initial, onSaved, onCancel }) {
  const [values, setValues] = useState({
    title: initial?.title || '',
    sessionDate: initial?.sessionDate || workshop.startDate,
    startTime: initial?.startTime || '10:00',
    endTime: initial?.endTime || '12:00',
    meetingLink: initial?.meetingLink && initial.meetingLink !== workshop.meetingLink ? initial.meetingLink : '',
  });
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);
  const bind = (name) => ({
    value: values[name],
    error: errors[name],
    onChange: (e) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  const onSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...values, meetingLink: values.meetingLink.trim() || null };
    const result = await run(() => (initial ? updateSession(initial.id, payload) : createSession(workshop.id, payload)));
    if (result.ok) onSaved(result.data);
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <TextField label="Session title" required maxLength={200} {...bind('title')} />
      <div className="grid gap-6 md:grid-cols-3">
        <TextField
          label="Date"
          type="date"
          required
          min={workshop.startDate}
          max={workshop.endDate}
          {...bind('sessionDate')}
        />
        <TextField label="Starts" type="time" required {...bind('startTime')} />
        <TextField label="Ends" type="time" required {...bind('endTime')} />
      </div>
      {workshop.mode !== 'OFFLINE' && (
        <TextField
          label="Meeting link for this session"
          type="url"
          placeholder="https://"
          hint="Optional. Leave empty to use the workshop's meeting link."
          {...bind('meetingLink')}
        />
      )}
      {error && !Object.keys(errors).length && <Notice tone="error">{error.message}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />} {initial ? 'Save session' : 'Add session'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Live attendance modal
const DURATIONS = [5, 10, 15, 30, 60].map((m) => ({ value: String(m), label: `${m} minutes` }));

function AttendanceModal({ session, workshop, onClose, onChanged }) {
  const windowClosed = attendanceWindowState(session) === 'CLOSED';
  const [duration, setDuration] = useState('15');
  const [live, setLive] = useState(null); // response from POST .../attendance/start
  const [stopped, setStopped] = useState(null); // response from POST .../attendance/stop
  const [present, setPresent] = useState(null); // [{ participantName, markedAt }]
  const [registered, setRegistered] = useState(null);
  const action = useAction();
  const now = useNow(1000, Boolean(live && !stopped));
  const remaining = live ? new Date(live.expiresAt).getTime() - now : 0;
  const expired = live && remaining <= 0;

  const refreshPresent = async () => {
    try {
      const grid = await getAttendanceGrid(workshop.id);
      setRegistered(grid.participants.length);
      setPresent(
        grid.participants
          .filter((p) => p.sessions[session.id]?.status === 'PRESENT')
          .map((p) => ({ name: p.participantName, markedAt: p.sessions[session.id].markedAt }))
          .sort((a, b) => new Date(b.markedAt) - new Date(a.markedAt)),
      );
    } catch {
      // Keep the last known list; the QR keeps working regardless.
    }
  };

  // Poll who has checked in while the QR is live (no websockets needed).
  useInterval(refreshPresent, live && !stopped ? 4000 : null);

  const start = async () => {
    const result = await action.run(() => startAttendance(session.id, Number(duration)));
    if (result.ok) {
      setLive(result.data);
      setStopped(null);
      refreshPresent();
      onChanged();
    }
  };

  const stop = async () => {
    const result = await action.run(() => stopAttendance(session.id));
    if (result.ok) {
      setStopped(result.data);
      onChanged();
    }
  };

  return (
    <Modal open onClose={onClose} title={session.title} wide={Boolean(live && !stopped)}>
      <p className="-mt-4 mb-8 text-charcoal">
        {formatDate(session.sessionDate)} · {formatTime(session.startTime)} – {formatTime(session.endTime)}
      </p>

      {action.error && (
        <Notice tone="error" className="mb-6">
          {action.error.message}
        </Notice>
      )}

      {!live && !stopped && (
        <div className="space-y-6">
          <p className="text-charcoal">
            Starting attendance creates a QR code and a short code for this session. Participants scan it (or type the
            code) to check in. Starting again replaces the previous code.
          </p>
          <SelectField label="Keep attendance open for" options={DURATIONS} value={duration} onChange={(e) => setDuration(e.target.value)} />
          <button type="button" className="btn btn-primary btn-lg" disabled={action.pending} onClick={start}>
            {action.pending ? <Spinner /> : <Icon name="qr" size={18} />} Start attendance
          </button>
        </div>
      )}

      {live && !stopped && (
        <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-center">
          <div className="rounded-panel bg-white p-6 shadow-lift md:p-8">
            <img
              src={live.qrCode}
              alt={`Attendance QR code for ${session.title}`}
              className={`mx-auto aspect-square w-full max-w-[440px] ${expired ? 'opacity-20' : ''}`}
            />
          </div>
          <div>
            <p className="text-[14px] font-bold uppercase tracking-[0.06em] text-slate">Or enter this code</p>
            <p className="mt-2 text-[56px] font-medium leading-none tracking-[0.12em] md:text-[64px]" aria-label={`Code ${live.attendanceCode.split('').join(' ')}`}>
              {live.attendanceCode}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3" aria-live="polite">
              {expired ? (
                <StatusBadge status="CLOSED" />
              ) : (
                <StatusBadge status="OPEN" />
              )}
              <span className="text-charcoal">
                {expired ? 'This code has expired.' : `Closes in ${formatCountdown(remaining)}`}
              </span>
            </div>
            <p className="mt-2 text-[14px] text-slate">Expires {formatDateTime(live.expiresAt)}</p>

            <div className="mt-8 border-t rule pt-6" aria-live="polite">
              <p className="text-[40px] font-medium leading-none tracking-[-0.03em]">
                {present ? present.length : '–'}
                {registered !== null && <span className="text-[20px] text-slate"> / {registered} present</span>}
              </p>
              {present?.length > 0 && (
                <ul className="mt-4 max-h-36 space-y-1 overflow-y-auto text-[15px] text-charcoal">
                  {present.slice(0, 8).map((p) => (
                    <li key={p.name}>{p.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              {expired ? (
                <button type="button" className="btn btn-primary" disabled={action.pending || windowClosed} onClick={start}>
                  {action.pending && <Spinner />} Start again with a new code
                </button>
              ) : (
                <button type="button" className="btn btn-primary" disabled={action.pending} onClick={stop}>
                  {action.pending ? <Spinner /> : <Icon name="stop" size={16} />} Stop attendance
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Close
              </button>
            </div>
            {!expired && <p className="mt-4 text-[14px] text-slate">Closing this window keeps attendance open until it expires.</p>}
          </div>
        </div>
      )}

      {stopped && (
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ink text-canvas" aria-hidden="true">
            <Icon name="check" size={26} strokeWidth={2} />
          </span>
          <p className="section-title mt-6">Attendance stopped</p>
          <p className="mt-2 text-charcoal">
            {stopped.presentCount} participant{stopped.presentCount === 1 ? '' : 's'} marked present for this session.
          </p>
          <button type="button" className="btn btn-primary mt-8" onClick={onClose}>
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}

// "2 hours" / "90 minutes" for a duration in milliseconds.
const formatGap = (ms) => {
  const minutes = Math.round(ms / 60_000);
  return minutes % 60 === 0 ? `${minutes / 60} hour${minutes === 60 ? '' : 's'}` : `${minutes} minutes`;
};

// ---------------------------------------------------------------- Start / join control
// status is the live lifecycle (see sessionLiveStatus). The server enforces the
// same rules when the button is pressed.
// Online/hybrid sessions run in the live room inside the portal.
function SessionStartControl({ session, status, online, draft, starting, onStart }) {
  if (status === 'COMPLETED') return null;
  if (status === 'ONGOING') {
    return online ? (
      <Link to={`/sessions/${session.id}/live`} className="btn btn-primary">
        <Icon name="video" size={18} /> Open live room
      </Link>
    ) : null;
  }
  const locked = status === 'SCHEDULED' || draft;
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={locked || starting}
      onClick={onStart}
      title={draft ? 'Publish the workshop first' : locked ? `Available from ${formatTime(session.startTime)}` : undefined}
    >
      {starting ? <Spinner /> : <Icon name={online ? 'video' : 'arrowRight'} size={18} />}
      {online ? 'Start & open live room' : 'Start session'}
    </button>
  );
}

// ---------------------------------------------------------------- Page
export default function SessionsPage() {
  const { workshop, reloadWorkshop } = useOutletContext();
  useDocumentTitle(`Sessions · ${workshop.title}`);
  const { data: sessions, error, loading, reload, setData } = useAsync(() => listSessions(workshop.id), [workshop.id]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [attendanceFor, setAttendanceFor] = useState(null);
  const [notice, setNotice] = useState(null);
  const [startingId, setStartingId] = useState(null);
  const action = useAction();
  // Re-render every 15s so "Start session" unlocks when a session's time arrives.
  const now = useNow(15000);
  const isOnline = workshop.mode !== 'OFFLINE';
  // QR/code attendance is for people in the room; online-only workshops record
  // attendance automatically from verified watch time in the live room.
  const usesQr = workshop.mode !== 'ONLINE';
  const navigate = useNavigate();

  const refresh = () => {
    reload({ silent: true });
    reloadWorkshop();
  };

  const onStopFromRow = async (session) => {
    const result = await action.run(() => stopAttendance(session.id));
    if (result.ok) {
      setNotice(`Attendance stopped for "${session.title}". ${result.data.presentCount} present.`);
      reload({ silent: true });
    }
  };

  // Online/hybrid: after starting, go straight into the live room.
  const onStart = async (session) => {
    setStartingId(session.id);
    const result = await action.run(() => startSession(session.id));
    setStartingId(null);
    if (!result.ok) return;
    if (isOnline) {
      navigate(`/sessions/${session.id}/live`);
      return;
    }
    // Show "Ongoing" immediately from the response; the reload below re-syncs the list.
    setData((list) => list.map((s) => (s.id === session.id ? result.data : s)));
    setNotice(`"${session.title}" is now ongoing.`);
    reload({ silent: true });
  };

  const onDelete = async (session) => {
    if (!window.confirm(`Delete "${session.title}"? Its attendance records will be removed and percentages recalculated.`)) return;
    const result = await action.run(() => deleteSession(session.id));
    if (result.ok) {
      setNotice(`Deleted "${session.title}".`);
      refresh();
    }
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Sessions"
        title="Schedule & attendance"
        action={
          !adding && (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Add session
            </button>
          )
        }
      />

      {workshop.status === 'DRAFT' && (
        <Notice className="mb-8">Publish the workshop before taking attendance. You can add sessions now.</Notice>
      )}
      {notice && (
        <Notice tone="success" className="mb-8">
          {notice}
        </Notice>
      )}
      {action.error && (
        <Notice tone="error" className="mb-8">
          {action.error.message}
        </Notice>
      )}

      {adding && (
        <section className="panel mb-10" aria-label="New session">
          <h3 className="card-title mb-6">New session</h3>
          <SessionForm
            workshop={workshop}
            onCancel={() => setAdding(false)}
            onSaved={(s) => {
              setAdding(false);
              setNotice(`Added "${s.title}".`);
              refresh();
            }}
          />
        </section>
      )}

      {loading && <LoadingBlock rows={3} label="Loading sessions" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {sessions?.length === 0 && !adding && (
        <EmptyState
          title="No sessions created"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              Add the first session
            </button>
          }
        >
          Attendance percentages are calculated across all sessions of the workshop.
        </EmptyState>
      )}

      {sessions?.length > 0 && (
        <ol className="divide-y divide-ink/10 border-y rule">
          {sessions.map((session, index) =>
            editingId === session.id ? (
              <li key={session.id} className="py-8">
                <h3 className="card-title mb-6">Edit session</h3>
                <SessionForm
                  workshop={workshop}
                  initial={session}
                  onCancel={() => setEditingId(null)}
                  onSaved={(s) => {
                    setEditingId(null);
                    setNotice(`Saved "${s.title}".`);
                    reload({ silent: true });
                  }}
                />
              </li>
            ) : (
              <li key={session.id} className="flex flex-col gap-5 py-7 lg:flex-row lg:items-center lg:gap-8">
                <div className="flex items-center gap-5 lg:w-60 lg:shrink-0">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white font-medium">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="font-medium">{formatDate(session.sessionDate)}</p>
                    <p className="text-[15px] text-slate">
                      {formatTime(session.startTime)} – {formatTime(session.endTime)}
                    </p>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-[18px] font-medium">{session.title}</p>
                    <StatusBadge status={sessionLiveStatus(session, now)} />
                  </div>
                  {attendanceWindowState(session, now) === 'CLOSED' && !session.attendanceOpen && (
                    <p className="mt-1 text-[14px] text-slate">
                      Attendance closed at {formatClock(session.attendanceClosesAt)} (
                      {formatGap(new Date(session.attendanceClosesAt) - new Date(session.endsAt))} after the session ended).
                    </p>
                  )}
                  {sessionLiveStatus(session, now) === 'SCHEDULED' && (
                    <p className="mt-1 text-[14px] text-slate">
                      You can start this session and take attendance from {formatTime(session.startTime)} on{' '}
                      {formatDate(session.sessionDate)}.
                    </p>
                  )}
                  {session.attendanceOpen && (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-charcoal">
                      <StatusBadge status="OPEN" />
                      Code <span className="font-medium tracking-[0.1em]">{session.attendanceCode}</span> · closes{' '}
                      {formatDateTime(session.attendanceExpiresAt)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SessionStartControl
                    session={session}
                    status={sessionLiveStatus(session, now)}
                    online={isOnline}
                    draft={workshop.status === 'DRAFT'}
                    starting={startingId === session.id}
                    onStart={() => onStart(session)}
                  />
                  {!usesQr ? null : session.attendanceOpen ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={attendanceWindowState(session, now) !== 'OPEN'}
                        onClick={() => setAttendanceFor(session)}
                      >
                        <Icon name="qr" size={18} /> New QR
                      </button>
                      <button type="button" className="btn btn-secondary" disabled={action.pending} onClick={() => onStopFromRow(session)}>
                        Stop
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={workshop.status === 'DRAFT' || attendanceWindowState(session, now) !== 'OPEN'}
                      title={
                        attendanceWindowState(session, now) === 'BEFORE'
                          ? `Available from ${formatTime(session.startTime)}`
                          : attendanceWindowState(session, now) === 'CLOSED'
                            ? 'Attendance window has closed'
                            : undefined
                      }
                      onClick={() => setAttendanceFor(session)}
                    >
                      <Icon name="qr" size={18} /> Start attendance
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon"
                    aria-label={`Edit ${session.title}`}
                    onClick={() => setEditingId(session.id)}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet btn-icon text-clay"
                    aria-label={`Delete ${session.title}`}
                    onClick={() => onDelete(session)}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {attendanceFor && (
        <AttendanceModal
          session={attendanceFor}
          workshop={workshop}
          onClose={() => setAttendanceFor(null)}
          onChanged={() => reload({ silent: true })}
        />
      )}
    </div>
  );
}
