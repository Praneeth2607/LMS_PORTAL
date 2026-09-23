import { Badge, Eyebrow, Notice, ProgressBar } from './ui.jsx';
import Icon from './Icon.jsx';
import Modal from './Modal.jsx';

// Participant panel on the live session page. `presence` is the object returned
// by useActivePresence(); everything shown comes from the server's figures.
function TrackingBadge({ presence, inCall, liveState }) {
  if (liveState === 'ENDED') return <Badge tone="muted">Session ended</Badge>;
  if (liveState === 'BEFORE') return <Badge tone="neutral">Not started yet</Badge>;
  if (!inCall) return <Badge tone="neutral">Join the call to start tracking</Badge>;
  if (!presence.isTabActive) return <Badge tone="muted">Paused · tab switched</Badge>;
  if (presence.isIdle) return <Badge tone="muted">Paused · idle</Badge>;
  return <Badge tone="accent">Active · tracking</Badge>;
}

export default function ActiveSessionTracker({ presence, inCall, liveState }) {
  const { status, config } = presence;
  const minutesLeft = Math.max(0, Math.ceil((status?.requiredMinutes ?? 0) - (status?.activeMinutes ?? 0)));

  return (
    <section className="panel bg-white" aria-labelledby="presence-title" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Eyebrow>Your attendance</Eyebrow>
        {config?.demoMode && <Badge tone="neutral">Demo mode · 5s = 15 min</Badge>}
      </div>
      <h2 id="presence-title" className="card-title mt-4">
        Verified watch time
      </h2>

      <div className="mt-5">
        <TrackingBadge presence={presence} inCall={inCall} liveState={liveState} />
      </div>

      <div className="mt-8 flex items-end justify-between gap-4">
        <p className="text-[44px] font-medium leading-none tracking-[-0.03em]">
          {presence.activeMinutes}
          <span className="text-[18px] text-slate"> min</span>
        </p>
        <p className="pb-1 text-right text-[15px] text-slate">
          of {status?.requiredMinutes ?? '–'} min needed
          <span className="block">
            ({config?.thresholdPercent ?? 75}% of {status?.durationMinutes ?? '–'} min)
          </span>
        </p>
      </div>
      <div className="mt-5">
        <ProgressBar value={presence.progressPercent} label="Progress towards attendance" />
      </div>

      <div className="mt-8 border-t rule pt-6">
        {presence.attendanceRecorded ? (
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-canvas" aria-hidden="true">
              <Icon name="check" size={22} strokeWidth={2} />
            </span>
            <div>
              <p className="font-medium">Attendance recorded</p>
              <p className="text-[15px] text-slate">You&rsquo;re marked present for this session.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-dust bg-canvas" aria-hidden="true">
              <Icon name="shield" size={20} />
            </span>
            <div>
              <p className="font-medium">Attendance locked</p>
              <p className="text-[15px] text-slate">
                Keep watching with this tab open: about {minutesLeft} more minute{minutesLeft === 1 ? '' : 's'} and
                you&rsquo;re marked present automatically.
              </p>
            </div>
          </div>
        )}
      </div>

      <ul className="mt-8 space-y-2 text-[14px] text-slate">
        <li>Time counts only while you&rsquo;re in the call with this tab open and active.</li>
        <li>Switching tabs or minimising pauses it; it resumes when you come back.</li>
      </ul>

      {presence.error && (
        <Notice tone="error" className="mt-6">
          {presence.error.message}
        </Notice>
      )}

      {/* "Are you still there?" after the idle timeout (only while the session is live and you're in the call). */}
      <Modal open={presence.isIdle && inCall && liveState === 'LIVE'} onClose={presence.confirmPresent} title="Are you still there?">
        <p className="text-charcoal">
          Your watch time is paused because there has been no activity for a while. Confirm you&rsquo;re here to keep
          counting.
        </p>
        <button type="button" className="btn btn-primary btn-lg mt-8 w-full" onClick={presence.confirmPresent}>
          I&rsquo;m here
        </button>
      </Modal>
    </section>
  );
}
