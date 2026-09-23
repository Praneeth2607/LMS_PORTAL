import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useAction, useDocumentTitle } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { createUser, deleteUser, getStats, listUsers, reactivateUser, suspendUser } from '../../services/adminService.js';
import { listWorkshops } from '../../services/workshopService.js';
import { listWorkshopCertificates } from '../../services/certificateService.js';
import { Page } from '../../layouts/AppLayout.jsx';
import {
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
import { SelectField, TextField, fieldErrors } from '../../components/Form.jsx';
import Icon from '../../components/Icon.jsx';
import { WorkshopListView } from '../organizer/OrganizerPages.jsx';
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatPercent,
  roleLabel,
  workshopDisplayStatus,
} from '../../utils/format.js';
import { manageWorkshopPath } from '../../utils/roles.js';

// ======================================================================
// Dashboard (numbers straight from GET /api/admin/stats)
// ======================================================================
export function AdminDashboard() {
  useDocumentTitle('Admin dashboard');
  const { data, error, loading, reload } = useAsync(getStats, []);

  return (
    <Page>
      <PageHeader eyebrow="Admin" title="Portal overview" description="Workshops, people, attendance and certificates across CICT." />
      {loading && <LoadingBlock rows={4} label="Loading statistics" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="space-y-20">
          <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            <StatTile
              label="Workshops"
              value={data.totals.workshops}
              hint={`${data.totals.publishedWorkshops} published · ${data.totals.draftWorkshops} draft · ${data.totals.closedWorkshops} closed`}
            />
            <StatTile label="Participants" value={data.totals.participants} hint={`${data.totals.organizers} organizer${data.totals.organizers === 1 ? '' : 's'} · ${data.totals.admins} admin${data.totals.admins === 1 ? '' : 's'}`} />
            <StatTile label="Registrations" value={data.totals.registrations} hint={`${data.totals.sessions} sessions scheduled`} />
            <StatTile label="Certificates" value={data.totals.certificates} hint={`${data.totals.attendanceMarked} check-ins recorded`} />
          </div>

          <section>
            <SectionHeader
              eyebrow="Workshops"
              title="By workshop"
              action={
                <Link to="/admin/workshops" className="btn btn-secondary">
                  All workshops
                </Link>
              }
            />
            {data.workshops.length === 0 ? (
              <EmptyState title="No workshops available" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Workshop</th>
                    <th scope="col">Status</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Sessions</th>
                    <th scope="col">Avg. attendance</th>
                    <th scope="col">Certificates</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workshops.map((w) => (
                    <tr key={w.id}>
                      <td data-label="">
                        <Link to={manageWorkshopPath(w.id)} className="font-medium link-ink">
                          {w.title}
                        </Link>
                        <p className="text-[14px] text-slate">
                          {w.organizerName} · {formatDateRange(w.startDate, w.endDate)}
                        </p>
                      </td>
                      <td data-label="Status">
                        <StatusBadge status={workshopDisplayStatus(w)} />
                      </td>
                      <td data-label="Registered">{w.registeredCount}</td>
                      <td data-label="Sessions">{w.sessionCount}</td>
                      <td data-label="Avg. attendance">{w.sessionCount && w.registeredCount ? formatPercent(w.averageAttendance) : '–'}</td>
                      <td data-label="Certificates">{w.certificateCount}</td>
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
// Workshops (admins see every workshop, including drafts)
// ======================================================================
export function AdminWorkshopsPage() {
  useDocumentTitle('All workshops');
  return (
    <WorkshopListView
      loader={() => listWorkshops()}
      title="All workshops"
      description="Every workshop in the portal, including drafts. Admins can manage any of them."
      showOrganizer
    />
  );
}

// ======================================================================
// Users (organizers / participants)
// ======================================================================
function CreateUserForm({ defaultRole, onCreated, onCancel }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: defaultRole });
  const { pending, error, run } = useAction();
  const errors = fieldErrors(error);
  const bind = (key) => ({
    value: form[key],
    error: errors[key],
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await run(() => createUser(form));
        if (result.ok) onCreated(result.data);
      }}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <TextField label="Full name" required {...bind('name')} />
        <TextField label="Email" type="email" required {...bind('email')} />
        <TextField label="Temporary password" type="text" required minLength={8} hint="At least 8 characters. Share it privately." {...bind('password')} />
        <SelectField
          label="Role"
          options={[
            { value: 'ORGANIZER', label: 'Organizer' },
            { value: 'PARTICIPANT', label: 'Participant' },
            { value: 'ADMIN', label: 'Admin' },
          ]}
          {...bind('role')}
        />
      </div>
      {error && !Object.keys(errors).length && <Notice tone="error">{error.message}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending && <Spinner />} Create account
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function UsersPage({ role, title, description }) {
  const { user: me } = useAuth();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const userAction = useAction();
  const { data, error, loading, reload, setData } = useAsync(() => listUsers({ role, search: query }), [role, query]);
  const showProgress = role === 'PARTICIPANT';

  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  // update(list, responseData) applies the change to the table immediately;
  // the silent reload then re-syncs with the server.
  const perform = async (target, fn, message, update) => {
    setNotice(null);
    setBusyId(target.id);
    const result = await userAction.run(fn);
    setBusyId(null);
    if (result.ok) {
      setData((list) => update(list, result.data));
      setNotice(typeof message === 'function' ? message(result.data) : message);
      reload({ silent: true });
    }
  };
  const merge = (list, updated) => list.map((x) => (x.id === updated.id ? { ...x, ...updated } : x));

  const onSuspend = (u) => {
    if (!window.confirm(`Suspend ${u.name}? They will be signed out and unable to sign in until an admin reactivates them.`)) return;
    perform(u, () => suspendUser(u.id), `${u.name} has been suspended.`, merge);
  };

  const onReactivate = (u) => perform(u, () => reactivateUser(u.id), `${u.name} can sign in again.`, merge);

  const onDelete = (u) => {
    const warning = u.suspendedAt
      ? ' Their email will be blocked from signing up again; only an admin can create an account with it.'
      : '';
    if (
      !window.confirm(
        `Permanently delete ${u.name} (${u.email})? Their registrations, attendance and certificates are removed. This cannot be undone.${warning}`,
      )
    )
      return;
    perform(
      u,
      () => deleteUser(u.id),
      (res) => res.message,
      (list) => list.filter((x) => x.id !== u.id),
    );
  };

  return (
    <Page>
      <PageHeader
        eyebrow="People"
        title={title}
        description={description}
        actions={
          !adding && (
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Add {roleLabel(role).toLowerCase()}
            </button>
          )
        }
      />
      {adding && (
        <section className="panel mb-12">
          <h2 className="card-title mb-2">New account</h2>
          <p className="mb-6 text-charcoal">
            Admins can also re-create accounts for emails that were blocked after a suspended user was deleted.
          </p>
          <CreateUserForm
            defaultRole={role}
            onCancel={() => setAdding(false)}
            onCreated={(created) => {
              setAdding(false);
              setNotice(`Created ${created.name} (${roleLabel(created.role).toLowerCase()}).`);
              reload({ silent: true });
            }}
          />
        </section>
      )}
      {notice && (
        <Notice tone="success" className="mb-8">
          {notice}
        </Notice>
      )}
      {userAction.error && (
        <Notice tone="error" className="mb-8">
          {userAction.error.message}
        </Notice>
      )}

      <div className="relative mb-10 max-w-xl">
        <label htmlFor="user-search" className="sr-only">
          Search by name or email
        </label>
        <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-slate" />
        <input
          id="user-search"
          type="search"
          className="input !rounded-full pl-13"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && <LoadingBlock rows={4} label="Loading people" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data?.length === 0 && (
        <EmptyState title={query ? 'No matches' : `No ${title.toLowerCase()} yet`} icon="users">
          {query ? 'Try a different name or email.' : undefined}
        </EmptyState>
      )}
      {data?.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Joined</th>
              {showProgress && <th scope="col">Workshops attended</th>}
              {showProgress && <th scope="col">Certificates</th>}
              <th scope="col">Status</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id} className={u.suspendedAt ? 'opacity-70' : ''}>
                <td data-label="">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-[14px] text-slate">{u.email}</p>
                </td>
                <td data-label="Joined">{formatDate(u.createdAt.slice(0, 10))}</td>
                {showProgress && <td data-label="Workshops attended">{u.workshopsAttended}</td>}
                {showProgress && <td data-label="Certificates">{u.certificatesCount}</td>}
                <td data-label="Status">
                  {u.suspendedAt ? <StatusBadge status="SUSPENDED" /> : <StatusBadge status="ACTIVE" />}
                </td>
                <td data-label="">
                  {u.id === me.id ? (
                    <span className="text-[14px] text-slate">This is you</span>
                  ) : (
                    <div className="flex flex-wrap justify-end gap-2">
                      {u.suspendedAt ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === u.id}
                          onClick={() => onReactivate(u)}
                        >
                          {busyId === u.id && <Spinner />} Reactivate
                          <span className="sr-only"> {u.name}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={busyId === u.id}
                          onClick={() => onSuspend(u)}
                        >
                          {busyId === u.id && <Spinner />} Suspend
                          <span className="sr-only"> {u.name}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-danger"
                        disabled={busyId === u.id}
                        onClick={() => onDelete(u)}
                      >
                        <Icon name="trash" size={16} /> Delete
                        <span className="sr-only"> {u.name}</span>
                      </button>
                    </div>
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

export function AdminOrganizersPage() {
  useDocumentTitle('Organizers');
  return (
    <UsersPage
      role="ORGANIZER"
      title="Organizers"
      description="Staff who run workshops. People who sign up with an @cict.in email become organizers automatically."
    />
  );
}

export function AdminParticipantsPage() {
  useDocumentTitle('Participants');
  return <UsersPage role="PARTICIPANT" title="Participants" description="Everyone with a participant account." />;
}

// ======================================================================
// Certificates (combined from each workshop's certificate list)
// ======================================================================
async function loadAllCertificates() {
  const workshops = await listWorkshops();
  const lists = await Promise.all(
    workshops.filter((w) => w.status !== 'DRAFT').map((w) => listWorkshopCertificates(w.id).catch(() => [])),
  );
  return lists.flat().sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
}

export function AdminCertificatesPage() {
  useDocumentTitle('Certificates');
  const { data, error, loading, reload } = useAsync(loadAllCertificates, []);
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const rows = (data || []).filter(
    (c) =>
      !term ||
      c.certificateId.toLowerCase().includes(term) ||
      c.participantName.toLowerCase().includes(term) ||
      c.workshopTitle.toLowerCase().includes(term),
  );

  return (
    <Page>
      <PageHeader eyebrow="Certificates" title="Issued certificates" description="Every certificate issued across all workshops." />
      <div className="relative mb-10 max-w-xl">
        <label htmlFor="cert-search" className="sr-only">
          Search certificates
        </label>
        <Icon name="search" className="absolute left-5 top-1/2 -translate-y-1/2 text-slate" />
        <input
          id="cert-search"
          type="search"
          className="input !rounded-full pl-13"
          placeholder="Search by ID, participant or workshop"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {loading && <LoadingBlock rows={4} label="Loading certificates" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && rows.length === 0 && (
        <EmptyState title={data.length ? 'No matches' : 'No certificates available'} icon="certificate">
          {data.length ? 'Try a different search.' : 'Certificates appear here once organizers issue them.'}
        </EmptyState>
      )}
      {rows.length > 0 && (
        <>
          <p className="mb-4 text-slate">
            {rows.length} certificate{rows.length === 1 ? '' : 's'}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Certificate</th>
                <th scope="col">Participant</th>
                <th scope="col">Workshop</th>
                <th scope="col">Attendance</th>
                <th scope="col">Issued</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.certificateId}>
                  <td data-label="">
                    <Link to={`/certificates/${c.certificateId}`} className="font-medium link-ink">
                      {c.certificateId}
                    </Link>
                  </td>
                  <td data-label="Participant">{c.participantName}</td>
                  <td data-label="Workshop">{c.workshopTitle}</td>
                  <td data-label="Attendance">{formatPercent(c.attendancePercentage)}</td>
                  <td data-label="Issued">{formatDateTime(c.issuedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Page>
  );
}
