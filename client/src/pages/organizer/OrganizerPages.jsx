import { useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  closeWorkshop,
  createWorkshop,
  deleteWorkshop,
  listWorkshops,
  publishWorkshop,
  updateWorkshop,
} from '../../services/workshopService.js';
import { listRegistrations } from '../../services/registrationService.js';
import { listSessions } from '../../services/sessionService.js';
import { getAttendanceSummary } from '../../services/attendanceService.js';
import { createAnnouncement, listAnnouncements } from '../../services/announcementService.js';
import { Page } from '../../layouts/AppLayout.jsx';
import {
  BackLink,
  DateDisc,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Notice,
  PageHeader,
  SectionHeader,
  Spinner,
  StatTile,
  StatusBadge,
} from '../../components/ui.jsx';
import { TextAreaField, TextField, fieldErrors } from '../../components/Form.jsx';
import { AnnouncementList, FormAnswers } from '../../components/workshop.jsx';
import WorkshopForm from '../../components/WorkshopForm.jsx';
import Icon from '../../components/Icon.jsx';
import {
  firstName,
  formatDateRange,
  formatDateTime,
  formatPercent,
  formatTime,
  isSessionUpcoming,
  modeLabel,
  sessionLiveStatus,
  sessionStart,
  workshopDisplayStatus,
} from '../../utils/format.js';
import { manageWorkshopPath } from '../../utils/roles.js';

const createAction = (
  <Link to="/organizer/workshops/create" className="btn btn-primary">
    <Icon name="plus" size={18} /> Create workshop
  </Link>
);

// ======================================================================
// Dashboard
// ======================================================================
async function loadOrganizerDashboard() {
  const workshops = await listWorkshops({ mine: true });
  const live = workshops.filter((w) => w.status !== 'DRAFT');
  const details = await Promise.all(
    live.map(async (w) => {
      const [sessions, summary] = await Promise.all([
        w.sessionCount ? listSessions(w.id).catch(() => []) : [],
        w.sessionCount && w.registeredCount ? getAttendanceSummary(w.id).catch(() => null) : null,
      ]);
      return { workshop: w, sessions, summary };
    }),
  );
  const upcoming = details
    .flatMap(({ workshop, sessions }) =>
      sessions.filter((s) => isSessionUpcoming(s)).map((s) => ({ ...s, workshopTitle: workshop.title })),
    )
    .sort((a, b) => sessionStart(a) - sessionStart(b))
    .slice(0, 5);
  return { workshops, details, upcoming };
}

export function OrganizerDashboard() {
  useDocumentTitle('Organizer dashboard');
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(loadOrganizerDashboard, []);

  return (
    <Page>
      <PageHeader
        eyebrow="Organizer"
        title={`Welcome, ${firstName(user.name)}`}
        description="Your workshops, registrations, upcoming sessions and attendance."
        actions={createAction}
      />
      {loading && <LoadingBlock rows={4} label="Loading dashboard" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.workshops.length === 0 && (
        <EmptyState title="No workshops yet" action={createAction}>
          Create your first workshop. It stays a draft until you publish it.
        </EmptyState>
      )}
      {data && data.workshops.length > 0 && (
        <div className="space-y-20">
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatTile label="Workshops" value={data.workshops.length} />
            <StatTile label="Published" value={data.workshops.filter((w) => w.status === 'PUBLISHED').length} />
            <StatTile label="Registrations" value={data.workshops.reduce((n, w) => n + w.registeredCount, 0)} />
            <StatTile label="Sessions" value={data.workshops.reduce((n, w) => n + w.sessionCount, 0)} />
          </div>

          <section>
            <SectionHeader eyebrow="Sessions" title="Coming up" />
            {data.upcoming.length === 0 ? (
              <p className="text-slate">No upcoming sessions in your published workshops.</p>
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
                    <StatusBadge status={sessionLiveStatus(s)} />
                    {s.attendanceOpen && <StatusBadge status="OPEN" />}
                    <Link to={manageWorkshopPath(s.workshopId, 'sessions')} className="btn btn-secondary">
                      Manage session
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader eyebrow="Attendance" title="Overview" />
            {data.details.filter((d) => d.summary).length === 0 ? (
              <p className="text-slate">Attendance appears once a published workshop has sessions and registrations.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Workshop</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Sessions completed</th>
                    <th scope="col">Eligible for certificate</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.details
                    .filter((d) => d.summary)
                    .map(({ workshop, summary }) => (
                      <tr key={workshop.id}>
                        <td data-label="">
                          <span className="font-medium">{workshop.title}</span>
                        </td>
                        <td data-label="Registered">{workshop.registeredCount}</td>
                        <td data-label="Sessions completed">
                          {summary.completedSessions} / {summary.totalSessions}
                        </td>
                        <td data-label="Eligible">
                          {summary.eligibleCount} of {summary.participants.length}
                        </td>
                        <td data-label="">
                          <Link to={manageWorkshopPath(workshop.id, 'attendance')} className="link-ink font-medium">
                            Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}

// ======================================================================
// Workshop list (organizer: own; also reused for admin with all workshops)
// ======================================================================
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'CLOSED', label: 'Closed' },
];

export function WorkshopTable({ workshops, showOrganizer = false }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th scope="col">Workshop</th>
          {showOrganizer && <th scope="col">Organizer</th>}
          <th scope="col">Dates</th>
          <th scope="col">Status</th>
          <th scope="col">Registered</th>
          <th scope="col">Sessions</th>
          <th scope="col">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {workshops.map((w) => (
          <tr key={w.id}>
            <td data-label="">
              <Link to={manageWorkshopPath(w.id)} className="text-[18px] font-medium link-ink">
                {w.title}
              </Link>
              <p className="text-[14px] text-slate">{modeLabel(w.mode)}</p>
            </td>
            {showOrganizer && <td data-label="Organizer">{w.organizerName}</td>}
            <td data-label="Dates">{formatDateRange(w.startDate, w.endDate)}</td>
            <td data-label="Status">
              <StatusBadge status={workshopDisplayStatus(w)} />
            </td>
            <td data-label="Registered">
              {w.registeredCount}
              {w.capacity ? <span className="text-slate"> / {w.capacity}</span> : null}
            </td>
            <td data-label="Sessions">{w.sessionCount}</td>
            <td data-label="">
              <Link to={manageWorkshopPath(w.id)} className="btn btn-secondary">
                Manage
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function WorkshopListView({ loader, title, description, showOrganizer, actions }) {
  const [filter, setFilter] = useState('');
  const { data, error, loading, reload } = useAsync(loader, []);
  // Filter on the displayed status, so running closed workshops sit under Ongoing.
  const rows = (data || []).filter((w) => !filter || workshopDisplayStatus(w) === filter);

  return (
    <Page>
      <PageHeader eyebrow="Workshops" title={title} description={description} actions={actions} />
      <div role="group" aria-label="Filter by status" className="mb-10 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={`btn px-5 ${filter === f.value ? 'btn-primary' : 'btn-secondary border-ink/20'}`}
          >
            {f.label}
            {data && (
              <span className="opacity-60">{f.value ? data.filter((w) => workshopDisplayStatus(w) === f.value).length : data.length}</span>
            )}
          </button>
        ))}
      </div>
      {loading && <LoadingBlock rows={4} label="Loading workshops" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && rows.length === 0 && (
        <EmptyState title={data.length ? 'Nothing in this view' : 'No workshops yet'} action={!data.length && actions}>
          {data.length ? 'Try another filter.' : 'Create a workshop to get started.'}
        </EmptyState>
      )}
      {rows.length > 0 && <WorkshopTable workshops={rows} showOrganizer={showOrganizer} />}
    </Page>
  );
}

export function OrganizerWorkshopsPage() {
  useDocumentTitle('My workshops');
  return (
    <WorkshopListView
      loader={() => listWorkshops({ mine: true })}
      title="Your workshops"
      description="Drafts are only visible to you until published."
      actions={createAction}
    />
  );
}

// ======================================================================
// Create / edit
// ======================================================================
export function CreateWorkshopPage() {
  useDocumentTitle('Create workshop');
  const navigate = useNavigate();
  return (
    <Page className="max-w-4xl">
      <BackLink to="/organizer/workshops">Your workshops</BackLink>
      <PageHeader
        eyebrow="New workshop"
        title="Create a workshop"
        description="It's saved as a draft. You can add sessions and publish when it's ready."
      />
      <WorkshopForm
        submitLabel="Create draft"
        onSubmit={async (payload) => {
          const workshop = await createWorkshop(payload);
          navigate(manageWorkshopPath(workshop.id), { state: { created: true } });
        }}
        onCancel={() => navigate('/organizer/workshops')}
      />
    </Page>
  );
}

export function EditWorkshopPage() {
  const { workshop, reloadWorkshop } = useOutletContext();
  const navigate = useNavigate();
  useDocumentTitle(`Edit · ${workshop.title}`);
  return (
    <div>
      <SectionHeader eyebrow="Edit" title="Workshop details" />
      {workshop.registeredCount > 0 && (
        <Notice className="mb-8">
          {workshop.registeredCount} participant{workshop.registeredCount === 1 ? ' has' : 's have'} already registered.
          Changes to the registration form only apply to new registrations.
        </Notice>
      )}
      <WorkshopForm
        initial={workshop}
        submitLabel="Save changes"
        onSubmit={async (payload) => {
          await updateWorkshop(workshop.id, payload);
          await reloadWorkshop();
          navigate(manageWorkshopPath(workshop.id), { state: { saved: true } });
        }}
        onCancel={() => navigate(manageWorkshopPath(workshop.id))}
      />
    </div>
  );
}

// ======================================================================
// Overview (status actions)
// ======================================================================
export function WorkshopOverviewPage() {
  const { workshop, reloadWorkshop } = useOutletContext();
  const navigate = useNavigate();
  const { user } = useAuth();
  const action = useAction();
  const location = useLocation();
  const [message, setMessage] = useState(() =>
    location.state?.created ? 'Workshop created as a draft. Add sessions, then publish.' : location.state?.saved ? 'Changes saved.' : null,
  );
  useDocumentTitle(workshop.title);

  const perform = async (fn, success) => {
    setMessage(null);
    const result = await action.run(fn);
    if (result.ok) {
      setMessage(success);
      reloadWorkshop();
    }
  };

  const onDelete = async () => {
    if (!window.confirm(`Delete "${workshop.title}"? This also removes its sessions, registrations and announcements.`)) return;
    const result = await action.run(() => deleteWorkshop(workshop.id));
    if (result.ok) navigate(user.role === 'ADMIN' ? '/admin/workshops' : '/organizer/workshops');
  };

  const steps = [
    { done: true, label: 'Create the workshop' },
    { done: workshop.sessionCount > 0, label: 'Add sessions', to: 'sessions' },
    { done: workshop.status !== 'DRAFT', label: 'Publish so participants can register' },
    { done: workshop.registeredCount > 0, label: 'Receive registrations', to: 'participants' },
  ];

  return (
    <div className="space-y-16">
      {message && <Notice tone="success">{message}</Notice>}
      {action.error && (
        <Notice tone="error" title={action.error.message}>
          {action.error.errors?.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {action.error.errors.map((e) => (
                <li key={e.field}>{e.message}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
        <StatTile
          label="Registered"
          value={workshop.registeredCount}
          hint={workshop.capacity ? `of ${workshop.capacity} seats` : 'Unlimited seats'}
        />
        <StatTile label="Sessions" value={workshop.sessionCount} />
        <StatTile label="Status" value={<StatusBadge status={workshopDisplayStatus(workshop)} className="!text-[16px]" />} />
      </div>

      <section className="panel">
        <h2 className="card-title">Publishing</h2>
        <p className="mt-2 text-charcoal">
          {workshop.status === 'DRAFT' && 'Only you and admins can see this draft. Publish it to open registration.'}
          {workshop.status === 'PUBLISHED' && 'Visible in the catalogue and open for registration.'}
          {workshop.status === 'CLOSED' &&
            (workshopDisplayStatus(workshop) === 'ONGOING'
              ? 'The workshop is ongoing and registration is closed. Attendance and certificates still work.'
              : 'Registration is closed. Attendance and certificates still work.')}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {workshop.status !== 'PUBLISHED' && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={action.pending}
              onClick={() => perform(() => publishWorkshop(workshop.id), 'Workshop published. Registration is open.')}
            >
              {action.pending && <Spinner />} {workshop.status === 'CLOSED' ? 'Reopen registration' : 'Publish workshop'}
            </button>
          )}
          {workshop.status === 'PUBLISHED' && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={action.pending}
              onClick={() => perform(() => closeWorkshop(workshop.id), 'Registration closed.')}
            >
              Close registration
            </button>
          )}
          {workshop.status !== 'DRAFT' && (
            <Link to={`/workshops/${workshop.id}`} className="btn btn-quiet">
              View public page <Icon name="arrowUpRight" size={16} />
            </Link>
          )}
        </div>
      </section>

      <section>
        <SectionHeader eyebrow="Checklist" title="Getting ready" />
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.label} className="flex min-h-11 items-center gap-4">
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${step.done ? 'bg-ink text-canvas' : 'border border-dust bg-white'}`}
                aria-hidden="true"
              >
                {step.done && <Icon name="check" size={16} strokeWidth={2} />}
              </span>
              <span className={step.done ? 'text-slate line-through decoration-dust' : 'font-medium'}>
                {step.to && !step.done ? (
                  <Link to={step.to} className="link-ink">
                    {step.label}
                  </Link>
                ) : (
                  step.label
                )}
                <span className="sr-only">{step.done ? ' (done)' : ' (to do)'}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionHeader
          eyebrow="Registration form"
          title="What participants fill in"
          action={
            <Link to="edit" className="btn btn-secondary">
              <Icon name="edit" size={18} /> Edit
            </Link>
          }
        />
        {workshop.registrationFields.length === 0 ? (
          <p className="text-slate">No extra fields. Participants register with their account details only.</p>
        ) : (
          <ul className="divide-y divide-ink/10 border-y rule">
            {workshop.registrationFields.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <span className="font-medium">
                  {f.fieldName}
                  {f.required && <span className="ml-2 text-[14px] font-normal text-slate">Required</span>}
                </span>
                <span className="text-[14px] text-slate">
                  {f.fieldType.toLowerCase()}
                  {f.options ? `: ${f.options.join(', ')}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t rule pt-10">
        <h2 className="card-title">Delete workshop</h2>
        <p className="mt-2 text-charcoal">
          Permanently removes the workshop with its sessions, registrations and announcements. Not possible once
          certificates are issued.
        </p>
        <button type="button" className="btn btn-danger mt-6" disabled={action.pending} onClick={onDelete}>
          <Icon name="trash" size={18} /> Delete workshop
        </button>
      </section>
    </div>
  );
}

// ======================================================================
// Participants
// ======================================================================
export function ParticipantsPage() {
  const { workshop } = useOutletContext();
  const [status, setStatus] = useState('REGISTERED');
  useDocumentTitle(`Participants · ${workshop.title}`);
  const { data, error, loading, reload } = useAsync(async () => {
    const [registrations, summary] = await Promise.all([
      listRegistrations(workshop.id, status || undefined),
      workshop.sessionCount ? getAttendanceSummary(workshop.id).catch(() => null) : null,
    ]);
    const byParticipant = new Map((summary?.participants || []).map((p) => [p.participantId, p]));
    return registrations.map((r) => ({ ...r, attendance: byParticipant.get(r.participantId) }));
  }, [workshop.id, status]);

  return (
    <div>
      <SectionHeader eyebrow="Participants" title="Registrations" />
      <div role="group" aria-label="Filter registrations" className="mb-8 flex flex-wrap gap-2">
        {[
          ['REGISTERED', 'Registered'],
          ['CANCELLED', 'Cancelled'],
          ['', 'All'],
        ].map(([value, label]) => (
          <button
            key={label}
            type="button"
            aria-pressed={status === value}
            onClick={() => setStatus(value)}
            className={`btn px-5 ${status === value ? 'btn-primary' : 'btn-secondary border-ink/20'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {loading && <LoadingBlock rows={4} label="Loading registrations" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState title="No registrations yet" icon="users">
          {workshop.status === 'DRAFT'
            ? 'Publish the workshop so participants can register.'
            : 'Registrations will appear here as participants sign up.'}
        </EmptyState>
      )}
      {data?.length > 0 && (
        <>
          <p className="mb-4 text-slate">
            {data.length} {status ? status.toLowerCase() : 'total'}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Participant</th>
                <th scope="col">Registered</th>
                <th scope="col">Status</th>
                <th scope="col">Attendance</th>
                <th scope="col">Answers</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td data-label="">
                    <p className="font-medium">{r.participantName}</p>
                    <p className="text-[14px] text-slate">{r.participantEmail}</p>
                  </td>
                  <td data-label="Registered">{formatDateTime(r.registeredAt)}</td>
                  <td data-label="Status">
                    <StatusBadge status={r.status} />
                  </td>
                  <td data-label="Attendance">
                    {r.attendance ? (
                      <span>
                        {formatPercent(r.attendance.percentage)}
                        <span className="text-slate">
                          {' '}
                          · {r.attendance.attendedSessions}/{r.attendance.completedSessions} completed
                        </span>
                      </span>
                    ) : (
                      <span className="text-slate">–</span>
                    )}
                  </td>
                  <td data-label="Answers">
                    <FormAnswers formData={r.formData} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

// ======================================================================
// Announcements
// ======================================================================
export function AnnouncementsPage() {
  const { workshop } = useOutletContext();
  useDocumentTitle(`Announcements · ${workshop.title}`);
  const { data, error, loading, reload } = useAsync(() => listAnnouncements(workshop.id), [workshop.id]);
  const [form, setForm] = useState({ title: '', message: '' });
  const [posted, setPosted] = useState(false);
  const action = useAction();
  const errors = fieldErrors(action.error);

  const onSubmit = async (e) => {
    e.preventDefault();
    setPosted(false);
    const result = await action.run(() => createAnnouncement(workshop.id, form));
    if (result.ok) {
      setForm({ title: '', message: '' });
      setPosted(true);
      reload({ silent: true });
    }
  };

  return (
    <div className="space-y-16">
      <section className="panel">
        <h2 className="card-title">Post an announcement</h2>
        <p className="mt-2 text-charcoal">Visible on the workshop page and in participants&rsquo; dashboards.</p>
        <form onSubmit={onSubmit} noValidate className="mt-8 space-y-6">
          <TextField
            label="Title"
            required
            maxLength={200}
            value={form.title}
            error={errors.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <TextAreaField
            label="Message"
            required
            maxLength={5000}
            value={form.message}
            error={errors.message}
            onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
          />
          {action.error && !Object.keys(errors).length && <Notice tone="error">{action.error.message}</Notice>}
          {posted && <Notice tone="success">Announcement posted.</Notice>}
          <button type="submit" className="btn btn-primary" disabled={action.pending}>
            {action.pending && <Spinner />} Post announcement
          </button>
        </form>
      </section>

      <section>
        <SectionHeader eyebrow="Announcements" title="Posted" />
        {loading && <LoadingBlock rows={2} label="Loading announcements" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data?.length === 0 && <EmptyState title="No announcements" icon="megaphone" />}
        {data?.length > 0 && <AnnouncementList announcements={data} />}
      </section>
    </div>
  );
}
