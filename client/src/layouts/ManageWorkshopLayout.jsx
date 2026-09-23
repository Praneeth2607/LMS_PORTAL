import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getWorkshop } from '../services/workshopService.js';
import { BackLink, ErrorState, LoadingBlock, StatusBadge } from '../components/ui.jsx';
import { formatDateRange, modeLabel, workshopDisplayStatus } from '../utils/format.js';
import { Page } from './AppLayout.jsx';

const SECTIONS = [
  { to: '', label: 'Overview', end: true },
  { to: 'participants', label: 'Participants' },
  { to: 'sessions', label: 'Sessions' },
  { to: 'attendance', label: 'Attendance & certificates' },
  { to: 'announcements', label: 'Announcements' },
  { to: 'edit', label: 'Edit details' },
];

// Shell for /organizer/workshops/:id/*. Loads the workshop once and shares
// it with child pages via <Outlet context>.
export default function ManageWorkshopLayout() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: workshop, error, loading, reload } = useAsync(() => getWorkshop(id), [id]);
  const backTo = user?.role === 'ADMIN' ? '/admin/workshops' : '/organizer/workshops';

  if (loading) {
    return (
      <Page>
        <LoadingBlock rows={4} label="Loading workshop" />
      </Page>
    );
  }
  if (error) {
    return (
      <Page>
        <BackLink to={backTo}>All workshops</BackLink>
        <ErrorState error={error} onRetry={reload} />
      </Page>
    );
  }
  if (!workshop.canManage) {
    return (
      <Page>
        <BackLink to={backTo}>All workshops</BackLink>
        <ErrorState error={{ status: 403, message: 'Only the organizer of this workshop or an admin can manage it.' }} />
      </Page>
    );
  }

  return (
    <Page>
      <BackLink to={backTo}>All workshops</BackLink>
      <header className="mb-10 md:mb-14">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <StatusBadge status={workshopDisplayStatus(workshop)} />
          <span className="eyebrow">{modeLabel(workshop.mode)}</span>
        </div>
        <h1 className="page-title max-w-4xl">{workshop.title}</h1>
        <p className="mt-4 text-[18px] text-charcoal">{formatDateRange(workshop.startDate, workshop.endDate)}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="Workshop sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 lg:sticky lg:top-32 lg:flex-col lg:gap-1">
            {SECTIONS.map((section) => (
              <li key={section.label} className="shrink-0">
                <NavLink
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    `flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full px-4 font-medium lg:rounded-none lg:px-0 ${
                      isActive ? 'bg-white text-ink lg:bg-transparent' : 'text-slate hover:text-ink'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-signal-light' : 'bg-transparent'}`}
                        aria-hidden="true"
                      />
                      {section.label}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet context={{ workshop, reloadWorkshop: () => reload({ silent: true }) }} />
        </div>
      </div>
    </Page>
  );
}
