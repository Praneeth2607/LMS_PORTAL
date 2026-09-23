// Workshop-related display components shared by public, participant and organizer pages.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Badge, DateDisc, Notice, StatusBadge, Spinner, ProgressBar } from './ui.jsx';
import { useAction, useNow } from '../hooks/useUtils.js';
import { downloadCertificate, previewCertificate, verificationPath } from '../services/certificateService.js';
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatPercent,
  formatTime,
  modeLabel,
  registrationState,
  seatsLabel,
  sessionLiveStatus,
} from '../utils/format.js';

// ---------------------------------------------------------------- Catalogue card
export function WorkshopCard({ workshop, to = `/workshops/${workshop.id}` }) {
  const state = registrationState(workshop);
  return (
    <article className="group relative flex items-start gap-5 border-t rule py-8 md:gap-10 md:py-10">
      <DateDisc date={workshop.startDate} tone={workshop.status === 'CLOSED' ? 'cream' : 'white'} />
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{modeLabel(workshop.mode)}</p>
        <h3 className="card-title mt-3 md:text-[28px]">
          <Link
            to={to}
            className="rounded-sm decoration-dust underline-offset-4 after:absolute after:inset-0 after:rounded-[28px] group-hover:underline"
          >
            {workshop.title}
          </Link>
        </h3>
        <p className="mt-2 text-charcoal">
          {formatDateRange(workshop.startDate, workshop.endDate)}
          {workshop.venue ? ` · ${workshop.venue}` : workshop.mode === 'ONLINE' ? ' · Online' : ''}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Badge tone={state.tone}>{state.label}</Badge>
          {workshop.status !== 'CLOSED' && <span className="text-[14px] text-slate">{seatsLabel(workshop)}</span>}
          {workshop.organizerName && <span className="text-[14px] text-slate">by {workshop.organizerName}</span>}
        </div>
      </div>
      <span
        className="hidden h-14 w-14 shrink-0 place-items-center self-center rounded-full border-[1.5px] border-ink bg-white transition-colors group-hover:bg-ink group-hover:text-canvas sm:grid"
        aria-hidden="true"
      >
        <Icon name="arrowRight" />
      </span>
    </article>
  );
}

// ---------------------------------------------------------------- Sessions
// sessions: session objects from the API. For participants each carries
// myAttendanceStatus; attendanceOpen lets them jump to the marking page.
export function SessionList({ sessions, participantView = false }) {
  return (
    <ol className="divide-y divide-ink/10 border-y rule">
      {sessions.map((session, index) => (
        <li key={session.id} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex items-center gap-5 sm:w-64 sm:shrink-0">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-[15px] font-medium">
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
            <p className="text-[18px] font-medium tracking-[-0.01em]">{session.title}</p>
            {session.meetingLink && !participantView && (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="link mt-1 inline-flex min-h-11 items-center gap-1.5 text-[15px] sm:min-h-0"
              >
                Join online <Icon name="external" size={15} />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sessionLiveStatus(session) === 'ONGOING' && <StatusBadge status="ONGOING" />}
            {session.attendanceOpen && <StatusBadge status="OPEN" />}
            {participantView && (
              <StatusBadge status={session.myAttendanceStatus || (sessionPast(session) ? 'NOT_MARKED' : 'UPCOMING')} />
            )}
            {participantView && <JoinButton session={session} />}
            {participantView && session.attendanceOpen && session.myAttendanceStatus !== 'PRESENT' && (
              <Link to={`/attendance/${session.id}`} className="btn btn-primary">
                Mark attendance
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

const sessionPast = (s) => new Date(`${s.sessionDate}T${s.endTime}:00`) < new Date();

// ---------------------------------------------------------------- Join (participant)
// For sessions with a meeting link: enabled from the scheduled start time until
// the session ends. Re-checks the clock every 15s, so it unlocks without a reload.
export function JoinButton({ session }) {
  const now = useNow(15000);
  if (!session.meetingLink) return null;
  const status = sessionLiveStatus(session, now);
  if (status === 'COMPLETED') return null;
  if (status === 'SCHEDULED') {
    return (
      <button type="button" className="btn btn-secondary" disabled>
        <Icon name="clock" size={18} /> Join at {formatTime(session.startTime)}
      </button>
    );
  }
  return (
    <a href={session.meetingLink} target="_blank" rel="noreferrer" className="btn btn-primary">
      <Icon name="video" size={18} /> Join session
      <span className="sr-only"> {session.title} (opens in a new tab)</span>
    </a>
  );
}

// ---------------------------------------------------------------- Announcements
export function AnnouncementList({ announcements, showWorkshop = false }) {
  return (
    <ul className="space-y-4">
      {announcements.map((a) => (
        <li key={`${a.workshopId}-${a.id}`} className="tile">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-slate">
            <time dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
            <span aria-hidden="true">·</span>
            <span>{a.createdByName}</span>
            {showWorkshop && a.workshopTitle && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-charcoal">{a.workshopTitle}</span>
              </>
            )}
          </div>
          <h3 className="mt-3 text-[20px] font-medium tracking-[-0.01em]">{a.title}</h3>
          <p className="mt-2 whitespace-pre-line text-charcoal">{a.message}</p>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- Attendance summary (participant)
// attendance: { totalSessions, attendedSessions, percentage, threshold, eligible } from the API.
export function AttendanceSummary({ attendance }) {
  if (!attendance) return null;
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <p className="text-[48px] font-medium leading-none tracking-[-0.03em]">
          {attendance.completedSessions > 0 ? formatPercent(attendance.percentage) : '–'}
        </p>
        <p className="pb-1 text-right text-[15px] text-slate">
          {attendance.attendedSessions} of {attendance.completedSessions} completed sessions attended
          <span className="block">{attendance.totalSessions} sessions in this workshop</span>
        </p>
      </div>
      <div className="mt-5">
        <ProgressBar value={attendance.percentage} marker={attendance.threshold} label="Attendance" />
      </div>
      <p className="mt-3 text-[14px] text-slate">
        Based on completed sessions. Certificates need at least {attendance.threshold}% attendance.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Certificate status (participant)
// entry: an item from GET /api/my-workshops. Everything shown comes from the backend.
export function CertificateStatus({ entry }) {
  const { certificate, attendance } = entry;
  if (certificate) {
    return (
      <div>
        <StatusBadge status="ISSUED" />
        <p className="mt-4 text-charcoal">
          Certificate <span className="font-medium">{certificate.certificateId}</span> was issued on{' '}
          {formatDateTime(certificate.issuedAt)}.
        </p>
        <Link to={`/certificates/${certificate.certificateId}`} className="btn btn-primary mt-5">
          View certificate
        </Link>
      </div>
    );
  }
  if (attendance.totalSessions === 0) {
    return (
      <div>
        <StatusBadge status="PENDING" />
        <p className="mt-4 text-charcoal">Sessions haven&rsquo;t been scheduled yet, so there&rsquo;s no attendance to count.</p>
      </div>
    );
  }
  if (attendance.completedSessions === 0) {
    return (
      <div>
        <StatusBadge status="PENDING" />
        <p className="mt-4 text-charcoal">Your attendance will count once the first session has ended.</p>
      </div>
    );
  }
  if (attendance.eligible) {
    return (
      <div>
        <StatusBadge status="ELIGIBLE" />
        <p className="mt-4 text-charcoal">
          You meet the attendance requirement. Your certificate will appear here once the organizer issues it.
        </p>
      </div>
    );
  }
  return (
    <div>
      <StatusBadge status="NOT_ELIGIBLE" />
      <p className="mt-4 font-medium">Not eligible for certificate</p>
      <p className="mt-1 text-charcoal">
        {attendance.attendedSessions} of {attendance.completedSessions} completed sessions attended (
        {formatPercent(attendance.percentage)}). At least {attendance.threshold}% is required.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Certificate actions
export function CertificateActions({ certificate, showView = false }) {
  const download = useAction();
  const preview = useAction();
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={download.pending}
          onClick={() => download.run(() => downloadCertificate(certificate.certificateId))}
        >
          {download.pending ? <Spinner /> : <Icon name="download" size={18} />}
          Download PDF
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={preview.pending}
          onClick={() => preview.run(() => previewCertificate(certificate.certificateId))}
        >
          Preview
        </button>
        {showView && (
          <Link to={`/certificates/${certificate.certificateId}`} className="btn btn-secondary">
            Details
          </Link>
        )}
        <Link to={verificationPath(certificate)} className="btn btn-quiet">
          <Icon name="shield" size={18} /> Verify
        </Link>
      </div>
      {(download.error || preview.error) && (
        <Notice tone="error" className="mt-4">
          {(download.error || preview.error).message}
        </Notice>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Meeting / venue block
export function MeetingInfo({ workshop }) {
  const showsVenue = workshop.mode !== 'ONLINE';
  const showsLink = workshop.mode !== 'OFFLINE';
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {showsVenue && (
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
            <Icon name="pin" />
          </span>
          <div>
            <p className="text-[14px] text-slate">Venue</p>
            <p className="font-medium">{workshop.venue || 'To be announced'}</p>
          </div>
        </div>
      )}
      {showsLink && (
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
            <Icon name="video" />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] text-slate">Meeting link</p>
            {workshop.meetingLink ? (
              <a href={workshop.meetingLink} target="_blank" rel="noreferrer" className="link break-all font-medium">
                {workshop.meetingLink}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <p className="font-medium text-charcoal">Shared with registered participants</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Collapsible answers
export function FormAnswers({ formData }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(formData || {});
  if (!entries.length) return <span className="text-slate">–</span>;
  return (
    <div className="text-left">
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 font-medium underline decoration-dust underline-offset-4"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide' : 'View'} {entries.length} answer{entries.length === 1 ? '' : 's'}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={16} />
      </button>
      {open && (
        <dl className="mt-2 space-y-2 text-[15px]">
          {entries.map(([key, value]) => (
            <div key={key}>
              <dt className="text-slate">{key}</dt>
              <dd className="font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
