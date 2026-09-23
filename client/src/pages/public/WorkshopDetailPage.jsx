import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { getWorkshop } from '../../services/workshopService.js';
import { listSessions } from '../../services/sessionService.js';
import { listAnnouncements } from '../../services/announcementService.js';
import { cancelRegistration } from '../../services/registrationService.js';
import {
  BackLink,
  Badge,
  DateDisc,
  EmptyState,
  ErrorState,
  Eyebrow,
  Facts,
  LoadingBlock,
  Notice,
  Orbit,
  Spinner,
} from '../../components/ui.jsx';
import { AnnouncementList, MeetingInfo, SessionList } from '../../components/workshop.jsx';
import RegistrationForm from '../../components/RegistrationForm.jsx';
import { formatDateRange, modeLabel, registrationState, seatsLabel } from '../../utils/format.js';
import { manageWorkshopPath } from '../../utils/roles.js';

function RegistrationPanel({ workshop, onChange }) {
  const { user } = useAuth();
  const [justRegistered, setJustRegistered] = useState(false);
  const cancel = useAction();
  const here = `/workshops/${workshop.id}`;
  const full = workshop.capacity && workshop.registeredCount >= workshop.capacity;

  if (workshop.isRegistered) {
    return (
      <div>
        {justRegistered ? (
          <Notice tone="success" title="You're registered">
            Your seat is confirmed. Session details and the meeting link are now available below and in My Workshops.
          </Notice>
        ) : (
          <Badge tone="strong">You&rsquo;re registered</Badge>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/participant/workshops/${workshop.id}`} className="btn btn-primary">
            Open in My Workshops
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={cancel.pending}
            onClick={async () => {
              if (!window.confirm('Cancel your registration for this workshop?')) return;
              const result = await cancel.run(() => cancelRegistration(workshop.id));
              if (result.ok) {
                setJustRegistered(false);
                onChange();
              }
            }}
          >
            {cancel.pending && <Spinner />} Cancel registration
          </button>
        </div>
        {cancel.error && (
          <Notice tone="error" className="mt-4">
            {cancel.error.message}
          </Notice>
        )}
      </div>
    );
  }

  if (workshop.status === 'CLOSED') return <p className="text-charcoal">Registration for this workshop is closed.</p>;
  if (workshop.status === 'DRAFT') return <p className="text-charcoal">This workshop is a draft and not open yet.</p>;
  if (full) return <p className="text-charcoal">This workshop is full.</p>;

  if (!user) {
    return (
      <div>
        <p className="text-charcoal">Sign in with a participant account to register.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/login?next=${encodeURIComponent(here)}`} className="btn btn-primary">
            Sign in to register
          </Link>
          <Link to={`/register?next=${encodeURIComponent(here)}`} className="btn btn-secondary">
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  if (user.role !== 'PARTICIPANT') {
    return (
      <div>
        <p className="text-charcoal">Registration is for participant accounts.</p>
        {workshop.canManage && (
          <Link to={manageWorkshopPath(workshop.id)} className="btn btn-primary mt-6">
            Manage this workshop
          </Link>
        )}
      </div>
    );
  }

  return (
    <RegistrationForm
      workshop={workshop}
      onRegistered={() => {
        setJustRegistered(true);
        onChange();
      }}
    />
  );
}

export default function WorkshopDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const workshopQuery = useAsync(() => getWorkshop(id), [id, user?.id]);
  const sessionsQuery = useAsync(() => listSessions(id), [id, user?.id]);
  const announcementsQuery = useAsync(() => listAnnouncements(id), [id]);
  const workshop = workshopQuery.data;
  useDocumentTitle(workshop?.title);

  const refresh = () => {
    workshopQuery.reload({ silent: true });
    sessionsQuery.reload({ silent: true });
  };

  if (workshopQuery.loading) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 pt-16 md:px-8">
        <LoadingBlock rows={4} label="Loading workshop" />
      </div>
    );
  }
  if (workshopQuery.error) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 pt-16 md:px-8">
        <BackLink to="/workshops">All workshops</BackLink>
        <ErrorState error={workshopQuery.error} onRetry={workshopQuery.reload} />
      </div>
    );
  }

  const state = registrationState(workshop);

  return (
    <article>
      {/* Header + hero */}
      <header className="relative overflow-hidden">
        <div className="mx-auto max-w-[1280px] px-4 pt-10 md:px-8 md:pt-16">
          <BackLink to="/workshops">All workshops</BackLink>
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
            <div>
              <Eyebrow>{modeLabel(workshop.mode)} workshop</Eyebrow>
              <h1 className="display mt-6 max-w-4xl">{workshop.title}</h1>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Badge tone={state.tone}>{state.label}</Badge>
                {workshop.canManage && (
                  <Link to={manageWorkshopPath(workshop.id)} className="btn btn-secondary">
                    Manage workshop
                  </Link>
                )}
              </div>
            </div>
            <div className="relative hidden justify-self-center lg:block">
              <Orbit variant="ring" className="absolute -inset-10 h-[calc(100%+80px)] w-[calc(100%+80px)]" />
              <DateDisc date={workshop.startDate} size="lg" tone="ink" />
            </div>
          </div>
          <div className="mt-12 rounded-panel bg-lifted p-6 md:mt-16 md:p-10">
            <Facts
              items={[
                { label: 'Dates', value: formatDateRange(workshop.startDate, workshop.endDate), icon: 'calendar' },
                { label: 'Format', value: modeLabel(workshop.mode), icon: workshop.mode === 'ONLINE' ? 'video' : 'pin' },
                { label: 'Seats', value: seatsLabel(workshop), icon: 'users' },
                { label: 'Organizer', value: workshop.organizerName, icon: 'megaphone' },
              ]}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-16 px-4 pt-16 md:px-8 md:pt-24 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-20">
        <div className="min-w-0 space-y-20">
          <section aria-labelledby="about-title">
            <Eyebrow>About</Eyebrow>
            <h2 id="about-title" className="section-title mt-4">
              What you&rsquo;ll do
            </h2>
            <p className="mt-6 whitespace-pre-line text-[18px] leading-[1.55] text-charcoal">
              {workshop.description || 'Details will be shared by the organizer soon.'}
            </p>
          </section>

          <section aria-labelledby="sessions-title">
            <Eyebrow>Sessions</Eyebrow>
            <h2 id="sessions-title" className="section-title mb-8 mt-4">
              Schedule
            </h2>
            {sessionsQuery.loading && <LoadingBlock rows={2} label="Loading sessions" />}
            {sessionsQuery.error && <ErrorState error={sessionsQuery.error} onRetry={sessionsQuery.reload} />}
            {sessionsQuery.data?.length === 0 && (
              <EmptyState title="No sessions scheduled yet">The organizer will publish the schedule soon.</EmptyState>
            )}
            {sessionsQuery.data?.length > 0 && (
              <SessionList sessions={sessionsQuery.data} participantView={workshop.isRegistered} />
            )}
          </section>

          <section aria-labelledby="where-title">
            <Eyebrow>Location</Eyebrow>
            <h2 id="where-title" className="section-title mb-8 mt-4">
              Where to be
            </h2>
            <MeetingInfo workshop={workshop} />
          </section>

          <section aria-labelledby="news-title">
            <Eyebrow>Announcements</Eyebrow>
            <h2 id="news-title" className="section-title mb-8 mt-4">
              Updates from the organizer
            </h2>
            {announcementsQuery.loading && <LoadingBlock rows={1} label="Loading announcements" />}
            {announcementsQuery.error && <ErrorState error={announcementsQuery.error} onRetry={announcementsQuery.reload} />}
            {announcementsQuery.data?.length === 0 && <p className="text-slate">No announcements yet.</p>}
            {announcementsQuery.data?.length > 0 && <AnnouncementList announcements={announcementsQuery.data} />}
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <section className="panel bg-white" aria-labelledby="register-title">
            <Eyebrow>Registration</Eyebrow>
            <h2 id="register-title" className="card-title mb-6 mt-4">
              {workshop.isRegistered ? 'Your registration' : 'Reserve your seat'}
            </h2>
            <RegistrationPanel workshop={workshop} onChange={refresh} />
          </section>
          <section className="panel" aria-labelledby="cert-title">
            <Eyebrow>Certificate</Eyebrow>
            <h2 id="cert-title" className="card-title mt-4">
              Earn a verifiable certificate
            </h2>
            <p className="mt-3 text-charcoal">
              Participants who attend at least 90% of the sessions receive a certificate with a QR code that anyone can
              scan to confirm it&rsquo;s genuine.
            </p>
          </section>
        </aside>
      </div>
    </article>
  );
}
