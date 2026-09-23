import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useActivePresence } from '../hooks/useActivePresence.js';
import { useDocumentTitle, useInterval, useNow } from '../hooks/useUtils.js';
import { joinLiveSession, listSessionPresence } from '../services/presenceService.js';
import { BackLink, ErrorState, Eyebrow, LoadingBlock, Notice, StatusBadge } from '../components/ui.jsx';
import ActiveSessionTracker from '../components/ActiveSessionTracker.jsx';
import { Page } from '../layouts/AppLayout.jsx';
import { formatDate, formatTime } from '../utils/format.js';
import { homeFor, manageWorkshopPath } from '../utils/roles.js';

// Loads a provider script once (Jitsi's external_api.js is served per JaaS app).
const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(
      src,
      new Promise((resolve, reject) => {
        const el = document.createElement('script');
        el.src = src;
        el.async = true;
        el.onload = resolve;
        el.onerror = () => {
          scripts.delete(src);
          el.remove();
          reject(new Error('The video service could not be reached'));
        };
        document.head.appendChild(el);
      }),
    );
  }
  return scripts.get(src);
}

// Jitsi (JaaS): the call runs in Jitsi's iframe; its events tell us whether
// the local user is in the conference.
function useJitsiCall(containerRef, call, token, callbacks, setLoadError) {
  useEffect(() => {
    if (call.provider !== 'jitsi') return undefined;
    let cancelled = false;
    let api = null;
    (async () => {
      try {
        await loadScript(call.scriptUrl);
        if (cancelled) return;
        api = new window.JitsiMeetExternalAPI(call.domain, {
          roomName: call.roomName,
          jwt: token,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          configOverwrite: { prejoinConfig: { enabled: true }, disableDeepLinking: true, startWithAudioMuted: true },
        });
        api.addListener('videoConferenceJoined', () => callbacks.current.onInCallChange(true));
        api.addListener('videoConferenceLeft', () => callbacks.current.onInCallChange(false));
        api.addListener('readyToClose', () => callbacks.current.onInCallChange(false));
        api.addListener('errorOccurred', (e) => {
          if (e?.error?.isFatal) {
            callbacks.current.onInCallChange(false);
            setLoadError(e.error.message || e.error.name || 'The call was interrupted');
          }
        });
        // Using the call's own controls counts as activity (the page can't see
        // clicks inside the call iframe).
        const activity = () => callbacks.current.onActivity();
        ['audioMuteStatusChanged', 'videoMuteStatusChanged', 'raiseHandUpdated', 'incomingMessage', 'outgoingMessage'].forEach(
          (name) => api.addListener(name, activity),
        );
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || 'The live room could not be loaded');
      }
    })();
    return () => {
      cancelled = true;
      callbacks.current.onInCallChange(false);
      api?.dispose();
    };
  }, [call.provider, call.scriptUrl, call.domain, call.roomName, token]);
}

// Daily's SDK is loaded only when Daily is the provider. A previous frame must
// be fully destroyed before creating a new one (React StrictMode mounts effects twice).
let destroying = Promise.resolve();

function useDailyCall(containerRef, call, roomUrl, token, callbacks, setLoadError) {
  useEffect(() => {
    if (call.provider !== 'daily') return undefined;
    let cancelled = false;
    let frame = null;
    (async () => {
      await destroying;
      if (cancelled) return;
      try {
        const { default: DailyIframe } = await import('@daily-co/daily-js');
        if (cancelled) return;
        frame = DailyIframe.createFrame(containerRef.current, {
          showLeaveButton: true,
          iframeStyle: { width: '100%', height: '100%', border: '0', borderRadius: '28px' },
        });
        frame.on('joined-meeting', () => callbacks.current.onInCallChange(true));
        frame.on('left-meeting', () => callbacks.current.onInCallChange(false));
        frame.on('error', () => callbacks.current.onInCallChange(false));
        frame.on('participant-updated', (e) => e?.participant?.local && callbacks.current.onActivity());
        await frame.join({ url: roomUrl, token });
      } catch (err) {
        // Daily shows its own explanation inside the frame; we add ours below it.
        if (!cancelled) setLoadError(err?.errorMsg || err?.message || 'The live room could not be loaded');
      }
    })();
    return () => {
      cancelled = true;
      callbacks.current.onInCallChange(false);
      if (frame) destroying = frame.destroy().catch(() => {});
    };
  }, [call.provider, roomUrl, token]);
}

// Embeds the call and reports whether the local user is in it.
function VideoCall({ call, roomUrl, token, onInCallChange, onActivity }) {
  const containerRef = useRef(null);
  const [loadError, setLoadError] = useState(null);
  const callbacks = useRef({ onInCallChange, onActivity });
  callbacks.current = { onInCallChange, onActivity };
  useJitsiCall(containerRef, call, token, callbacks, setLoadError);
  useDailyCall(containerRef, call, roomUrl, token, callbacks, setLoadError);

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-[28px] bg-ink md:min-h-[480px]">
        <div ref={containerRef} className="absolute inset-0 [&>iframe]:rounded-[28px]" data-testid="live-call" />
      </div>
      {loadError && (
        <Notice tone="error" className="mt-4" title="The call couldn’t start">
          {loadError}. If this keeps happening, ask the organizer to check the video service account.
        </Notice>
      )}
    </div>
  );
}

// Organizer/admin panel: everyone's verified watch time, refreshed every 10s.
function PresenceOverview({ sessionId }) {
  const { data, error, reload } = useAsync(() => listSessionPresence(sessionId), [sessionId]);
  useInterval(() => reload({ silent: true }), 10_000);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <LoadingBlock rows={3} label="Loading participants" />;
  const watching = data.participants.filter((p) => p.watchingNow).length;
  return (
    <section className="panel bg-white" aria-labelledby="overview-title">
      <Eyebrow>Participants</Eyebrow>
      <h2 id="overview-title" className="card-title mt-4">
        {watching} watching now
      </h2>
      <p className="mt-2 text-[15px] text-slate">
        Attendance is recorded automatically at {data.requiredMinutes} min ({data.config.thresholdPercent}% of{' '}
        {data.durationMinutes} min).
      </p>
      <ul className="mt-6 divide-y divide-ink/10">
        {data.participants.map((p) => (
          <li key={p.participantId} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-medium">{p.participantName}</p>
              <p className="text-[14px] text-slate">
                {p.activeMinutes} min · {p.progressPercent}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.watchingNow && <StatusBadge status="WATCHING" />}
              <StatusBadge status={p.attendanceStatus || 'NOT_MARKED'} />
            </div>
          </li>
        ))}
        {data.participants.length === 0 && <li className="py-4 text-slate">No registered participants.</li>}
      </ul>
    </section>
  );
}

// Participant side: tracker bound to the call state.
function ParticipantPanel({ join, inCall, onActivityRef }) {
  const now = useNow(5000);
  const endsAt = new Date(join.session.endsAt).getTime();
  const startsAt = new Date(join.session.startsAt).getTime();
  const liveState = now < startsAt ? 'BEFORE' : now >= endsAt ? 'ENDED' : 'LIVE';
  const presence = useActivePresence({
    sessionId: join.session.id,
    inCall,
    live: liveState === 'LIVE',
    initialStatus: join.presence,
  });
  onActivityRef.current = presence.markActivity;
  return <ActiveSessionTracker presence={presence} inCall={inCall} liveState={liveState} />;
}

// /sessions/:id/live: the session's video call inside the portal.
export default function SessionLivePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: join, error, loading, reload } = useAsync(() => joinLiveSession(id), [id]);
  const [inCall, setInCall] = useState(false);
  const onActivityRef = useRef(() => {});
  useDocumentTitle(join ? `Live · ${join.session.title}` : 'Live session');

  const back = join?.isOwner
    ? manageWorkshopPath(join.session.workshopId, 'sessions')
    : join
      ? `/participant/workshops/${join.session.workshopId}`
      : homeFor(user);

  return (
    <Page>
      <BackLink to={back}>{join?.isOwner ? 'Sessions' : 'Back to workshop'}</BackLink>
      {loading && <LoadingBlock rows={4} label="Opening the live room" />}
      {error && (
        <ErrorState
          error={error}
          onRetry={reload}
          title={error.status === 503 ? 'Live video isn’t set up yet' : error.status === 409 ? 'The live room isn’t open' : undefined}
        />
      )}
      {join && (
        <>
          <header className="mb-10">
            <Eyebrow>{join.session.workshopTitle}</Eyebrow>
            <h1 className="page-title mt-4">{join.session.title}</h1>
            <p className="mt-3 text-[18px] text-charcoal">
              {formatDate(join.session.sessionDate)} · {formatTime(join.session.startTime)} – {formatTime(join.session.endTime)}
            </p>
          </header>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <VideoCall
              call={join.call || { provider: 'daily' }}
              roomUrl={join.roomUrl}
              token={join.token}
              onInCallChange={setInCall}
              onActivity={() => onActivityRef.current()}
            />
            <div className="space-y-6">
              {join.isOwner ? (
                <>
                  <PresenceOverview sessionId={join.session.id} />
                  <Link to={manageWorkshopPath(join.session.workshopId, 'attendance')} className="btn btn-secondary w-full">
                    Attendance &amp; certificates
                  </Link>
                </>
              ) : (
                <ParticipantPanel join={join} inCall={inCall} onActivityRef={onActivityRef} />
              )}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}
