import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { myWorkshops } from '../../services/registrationService.js';
import { listSessions } from '../../services/sessionService.js';
import { listAnnouncements } from '../../services/announcementService.js';
import { getWorkshop } from '../../services/workshopService.js';
import { myCertificates } from '../../services/certificateService.js';
import { Page } from '../../layouts/AppLayout.jsx';
import {
  BackLink,
  DateDisc,
  EmptyState,
  ErrorState,
  Eyebrow,
  LoadingBlock,
  PageHeader,
  ProgressBar,
  SectionHeader,
  StatTile,
  StatusBadge,
} from '../../components/ui.jsx';
import {
  AnnouncementList,
  AttendanceSummary,
  CertificateActions,
  CertificateStatus,
  MeetingInfo,
  SessionList,
} from '../../components/workshop.jsx';
import {
  firstName,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatPercent,
  formatTime,
  isSessionUpcoming,
  modeLabel,
  roleLabel,
  sessionLiveStatus,
  sessionStart,
} from '../../utils/format.js';

const browseAction = (
  <Link to="/workshops" className="btn btn-primary">
    Browse workshops
  </Link>
);

// ======================================================================
// Dashboard
// ======================================================================
async function loadDashboard() {
  const entries = await myWorkshops();
  const active = entries.filter((e) => e.registrationStatus === 'REGISTERED');
  // Sessions and announcements are per workshop in the API.
  const perWorkshop = await Promise.all(
    active.map(async (entry) => {
      const [sessions, announcements] = await Promise.all([
        listSessions(entry.workshop.id).catch(() => []),
        listAnnouncements(entry.workshop.id).catch(() => []),
      ]);
      return { entry, sessions, announcements };
    }),
  );
  const upcoming = perWorkshop
    .flatMap(({ entry, sessions }) =>
      sessions.filter((s) => isSessionUpcoming(s)).map((s) => ({ ...s, workshopTitle: entry.workshop.title })),
    )
    .sort((a, b) => sessionStart(a) - sessionStart(b))
    .slice(0, 5);
  const announcements = perWorkshop
    .flatMap(({ entry, announcements: list }) => list.map((a) => ({ ...a, workshopTitle: entry.workshop.title })))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);
  return { entries, active, upcoming, announcements };
}

export function ParticipantDashboard() {
  useDocumentTitle('Dashboard');
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(loadDashboard, []);

  return (
    <Page>
      <PageHeader
        eyebrow="Dashboard"
        title={`Good to see you, ${firstName(user.name)}`}
        description="Your workshops, upcoming sessions, attendance and certificates at a glance."
      />
      {loading && <LoadingBlock rows={4} label="Loading your dashboard" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.active.length === 0 && (
        <EmptyState title="No registrations yet" action={browseAction}>
          Find a workshop that interests you and reserve a seat. It will show up here.
        </EmptyState>
      )}
      {data && data.active.length > 0 && (
        <div className="space-y-20">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
            <StatTile label="Registered workshops" value={data.active.length} />
            <StatTile label="Upcoming sessions" value={data.upcoming.length} hint={data.upcoming.length === 5 ? 'Next five shown' : undefined} />
            <StatTile label="Certificates" value={data.entries.filter((e) => e.certificate).length} />
          </div>

          <section aria-labelledby="upcoming-title">
            <SectionHeader eyebrow="Sessions" title="Coming up" />
            {data.upcoming.length === 0 ? (
              <p className="text-slate">No upcoming sessions right now.</p>
            ) : (
              <ul className="divide-y divide-ink/10 border-y rule">
                {data.upcoming.map((s) => (
                  <li key={s.id} className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:gap-8">
                    <DateDisc date={s.sessionDate} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] text-slate">{s.workshopTitle}</p>
                      <p className="text-[18px] font-medium">{s.title}</p>
                      <p className="text-[15px] text-charcoal">
                        {formatTime(s.startTime)} – {formatTime(s.endTime)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {sessionLiveStatus(s) === 'ONGOING' && <StatusBadge status="ONGOING" />}
                      {s.attendanceOpen && s.myAttendanceStatus !== 'PRESENT' && (
                        <Link to={`/attendance/${s.id}`} className="btn btn-primary">
                          Mark attendance
                        </Link>
                      )}
                      {s.myAttendanceStatus === 'PRESENT' && <StatusBadge status="PRESENT" />}
                      {s.meetingLink && (
                        <a href={s.meetingLink} target="_blank" rel="noreferrer" className="btn btn-secondary">
                          Join online<span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="progress-title">
            <SectionHeader eyebrow="Attendance" title="Your progress" />
            <ul className="grid gap-4 md:grid-cols-2">
              {data.active.map((entry) => (
                <li key={entry.registrationId} className="tile flex flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <Link to={`/participant/workshops/${entry.workshop.id}`} className="card-title link-ink">
                      {entry.workshop.title}
                    </Link>
                    {entry.certificate ? (
                      <StatusBadge status="ISSUED" />
                    ) : entry.attendance.totalSessions > 0 ? (
                      <StatusBadge status={entry.attendance.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'} />
                    ) : null}
                  </div>
                  <p className="mt-2 text-[15px] text-slate">
                    {entry.attendance.attendedSessions} of {entry.attendance.totalSessions} sessions ·{' '}
                    {formatPercent(entry.attendance.percentage)}
                  </p>
                  <div className="mt-auto pt-6">
                    <ProgressBar
                      value={entry.attendance.percentage}
                      marker={entry.attendance.threshold}
                      label={`Attendance for ${entry.workshop.title}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="news-title">
            <SectionHeader eyebrow="Announcements" title="Latest updates" />
            {data.announcements.length === 0 ? (
              <p className="text-slate">No announcements yet.</p>
            ) : (
              <AnnouncementList announcements={data.announcements} showWorkshop />
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

// ======================================================================
// My workshops
// ======================================================================
export function MyWorkshopsPage() {
  useDocumentTitle('My workshops');
  const { data, error, loading, reload } = useAsync(myWorkshops, []);

  return (
    <Page>
      <PageHeader
        eyebrow="My workshops"
        title="Workshops you've joined"
        description="Registration status, attendance and certificates for every workshop you've signed up for."
        actions={
          <Link to="/workshops" className="btn btn-secondary">
            Browse workshops
          </Link>
        }
      />
      {loading && <LoadingBlock rows={3} label="Loading your workshops" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState title="No registrations yet" action={browseAction}>
          Workshops you register for will appear here.
        </EmptyState>
      )}
      {data?.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Workshop</th>
              <th scope="col">Dates</th>
              <th scope="col">Registration</th>
              <th scope="col">Attendance</th>
              <th scope="col">Certificate</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry) => (
              <tr key={entry.registrationId} className={entry.registrationStatus === 'CANCELLED' ? 'opacity-60' : ''}>
                <td data-label="">
                  <Link to={`/participant/workshops/${entry.workshop.id}`} className="text-[18px] font-medium link-ink">
                    {entry.workshop.title}
                  </Link>
                  <p className="text-[14px] text-slate">{modeLabel(entry.workshop.mode)}</p>
                </td>
                <td data-label="Dates">{formatDateRange(entry.workshop.startDate, entry.workshop.endDate)}</td>
                <td data-label="Registration">
                  <StatusBadge status={entry.registrationStatus} />
                </td>
                <td data-label="Attendance">
                  {entry.attendance.totalSessions ? (
                    <span>
                      <span className="font-medium">{formatPercent(entry.attendance.percentage)}</span>
                      <span className="text-slate">
                        {' '}
                        · {entry.attendance.attendedSessions}/{entry.attendance.totalSessions}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate">No sessions yet</span>
                  )}
                </td>
                <td data-label="Certificate">
                  {entry.certificate ? (
                    <Link to={`/certificates/${entry.certificate.certificateId}`} className="link-ink font-medium">
                      View
                    </Link>
                  ) : entry.attendance.totalSessions > 0 ? (
                    <StatusBadge status={entry.attendance.eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'} />
                  ) : (
                    <span className="text-slate">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  );
}

// ======================================================================
// My workshop detail
// ======================================================================
async function loadMyWorkshop(id) {
  const [entries, workshop, sessions, announcements] = await Promise.all([
    myWorkshops(),
    getWorkshop(id),
    listSessions(id),
    listAnnouncements(id).catch(() => []),
  ]);
  const entry = entries.find((e) => String(e.workshop.id) === String(id)) || null;
  return { entry, workshop, sessions, announcements };
}

export function MyWorkshopDetailPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useAsync(() => loadMyWorkshop(id), [id]);
  useDocumentTitle(data?.workshop.title);

  return (
    <Page>
      <BackLink to="/participant/workshops">My workshops</BackLink>
      {loading && <LoadingBlock rows={4} label="Loading workshop" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && !data.entry && (
        <EmptyState
          title="You're not registered for this workshop"
          action={
            <Link to={`/workshops/${id}`} className="btn btn-primary">
              View workshop
            </Link>
          }
        />
      )}
      {data?.entry && (
        <>
          <header className="mb-14">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <StatusBadge status={data.entry.registrationStatus} />
              <span className="eyebrow">{modeLabel(data.workshop.mode)}</span>
            </div>
            <h1 className="page-title max-w-4xl">{data.workshop.title}</h1>
            <p className="mt-4 text-[18px] text-charcoal">
              {formatDateRange(data.workshop.startDate, data.workshop.endDate)} · by {data.workshop.organizerName}
            </p>
            <Link to={`/workshops/${id}`} className="btn btn-secondary mt-8">
              Public workshop page
            </Link>
          </header>

          <div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
            <div className="min-w-0 space-y-20">
              <section aria-labelledby="sessions-title">
                <SectionHeader eyebrow="Sessions" title="Schedule & attendance" />
                {data.sessions.length ? (
                  <SessionList sessions={data.sessions} participantView={data.entry.registrationStatus === 'REGISTERED'} />
                ) : (
                  <EmptyState title="No sessions created yet">The organizer hasn&rsquo;t scheduled sessions yet.</EmptyState>
                )}
              </section>
              <section aria-labelledby="where-title">
                <SectionHeader eyebrow="Location" title="Where to be" />
                <MeetingInfo workshop={data.workshop} />
              </section>
              <section aria-labelledby="about-title">
                <SectionHeader eyebrow="About" title="Description" />
                <p className="whitespace-pre-line text-[18px] leading-[1.55] text-charcoal">
                  {data.workshop.description || 'No description provided.'}
                </p>
              </section>
              <section aria-labelledby="news-title">
                <SectionHeader eyebrow="Announcements" title="Updates" />
                {data.announcements.length ? (
                  <AnnouncementList announcements={data.announcements} />
                ) : (
                  <p className="text-slate">No announcements yet.</p>
                )}
              </section>
            </div>
            <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
              <section className="panel bg-white">
                <Eyebrow>Attendance</Eyebrow>
                <div className="mt-6">
                  <AttendanceSummary attendance={data.entry.attendance} />
                </div>
              </section>
              <section className="panel">
                <Eyebrow>Certificate</Eyebrow>
                <div className="mt-6">
                  <CertificateStatus entry={data.entry} />
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </Page>
  );
}

// ======================================================================
// Certificates
// ======================================================================
export function MyCertificatesPage() {
  useDocumentTitle('My certificates');
  const { data, error, loading, reload } = useAsync(
    () => Promise.all([myCertificates(), myWorkshops()]).then(([certificates, entries]) => ({ certificates, entries })),
    [],
  );
  const pending = data?.entries.filter((e) => e.registrationStatus === 'REGISTERED' && !e.certificate) || [];

  return (
    <Page>
      <PageHeader
        eyebrow="Certificates"
        title="Your certificates"
        description="Download your certificates or share the verification link. Each PDF carries a QR code anyone can scan."
      />
      {loading && <LoadingBlock rows={3} label="Loading certificates" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="space-y-20">
          {data.certificates.length === 0 ? (
            <EmptyState title="No certificates available" icon="certificate">
              Certificates are issued by the organizer to participants who attend at least 90% of sessions.
            </EmptyState>
          ) : (
            <ul className="space-y-6">
              {data.certificates.map((cert) => (
                <li key={cert.certificateId} className="panel bg-white">
                  <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
                    <div>
                      <Eyebrow>Certificate</Eyebrow>
                      <h2 className="card-title mt-4 md:text-[28px]">{cert.workshopTitle}</h2>
                      <p className="mt-2 text-charcoal">{formatDateRange(cert.startDate, cert.endDate)}</p>
                    </div>
                    <StatusBadge status="ISSUED" />
                  </div>
                  <dl className="mt-8 grid gap-6 border-t rule pt-6 sm:grid-cols-3">
                    <div>
                      <dt className="text-slate">Certificate ID</dt>
                      <dd className="mt-1 font-medium">{cert.certificateId}</dd>
                    </div>
                    <div>
                      <dt className="text-slate">Attendance</dt>
                      <dd className="mt-1 font-medium">{formatPercent(cert.attendancePercentage)}</dd>
                    </div>
                    <div>
                      <dt className="text-slate">Issued</dt>
                      <dd className="mt-1 font-medium">{formatDateTime(cert.issuedAt)}</dd>
                    </div>
                  </dl>
                  <div className="mt-8">
                    <CertificateActions certificate={cert} showView />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {pending.length > 0 && (
            <section aria-labelledby="status-title">
              <SectionHeader eyebrow="Status" title="Other workshops" />
              <ul className="grid gap-4 md:grid-cols-2">
                {pending.map((entry) => (
                  <li key={entry.registrationId} className="tile">
                    <Link to={`/participant/workshops/${entry.workshop.id}`} className="card-title link-ink">
                      {entry.workshop.title}
                    </Link>
                    <div className="mt-5">
                      <CertificateStatus entry={entry} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}

// ======================================================================
// Profile
// ======================================================================
export function ProfilePage() {
  useDocumentTitle('Profile');
  const { user, logout } = useAuth();
  return (
    <Page className="max-w-3xl">
      <PageHeader eyebrow="Profile" title={user.name} />
      <section className="panel">
        <dl className="divide-y divide-ink/10">
          {[
            ['Name', user.name],
            ['Email', user.email],
            ['Account type', roleLabel(user.role)],
            ['Member since', formatDate(user.createdAt?.slice(0, 10))],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-5 first:pt-0 last:pb-0 sm:grid-cols-[200px_1fr]">
              <dt className="text-slate">{label}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <button type="button" className="btn btn-secondary mt-8" onClick={logout}>
        Sign out
      </button>
    </Page>
  );
}
