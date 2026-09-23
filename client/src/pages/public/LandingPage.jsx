import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { listWorkshops } from '../../services/workshopService.js';
import { Eyebrow, Orbit, Skeleton } from '../../components/ui.jsx';
import { WorkshopCard } from '../../components/workshop.jsx';
import Icon from '../../components/Icon.jsx';
import { formatDateRange, modeLabel } from '../../utils/format.js';
import { homeFor } from '../../utils/roles.js';

const JOURNEY = [
  { title: 'Discover', text: 'Browse CICT workshops by topic, date and format.' },
  { title: 'Register', text: 'Reserve a seat with a short, workshop-specific form.' },
  { title: 'Attend', text: 'Scan the session QR code to check in. It takes seconds.' },
  { title: 'Qualify', text: 'Attend at least 90% of sessions to earn a certificate.' },
  { title: 'Verify', text: 'Every certificate carries a QR code anyone can check.' },
];

function NextUp({ workshop }) {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <Orbit variant="ring" className="absolute -inset-6 h-[calc(100%+48px)] w-[calc(100%+48px)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-lifted px-10 text-center shadow-lift">
        {workshop ? (
          <>
            <Eyebrow>Next up</Eyebrow>
            <p className="mt-5 text-[26px] font-medium leading-[1.15] tracking-[-0.02em] md:text-[30px]">{workshop.title}</p>
            <p className="mt-4 text-charcoal">{formatDateRange(workshop.startDate, workshop.endDate)}</p>
            <p className="text-slate">{modeLabel(workshop.mode)}</p>
          </>
        ) : (
          <>
            <Eyebrow>Coming soon</Eyebrow>
            <p className="mt-5 text-[26px] font-medium leading-[1.15] tracking-[-0.02em]">New workshops are announced here</p>
          </>
        )}
      </div>
      {workshop && (
        <Link
          to={`/workshops/${workshop.id}`}
          className="absolute bottom-[6%] right-[6%] grid h-16 w-16 place-items-center rounded-full bg-white shadow-nav transition-colors hover:bg-ink hover:text-canvas"
          aria-label={`View ${workshop.title}`}
        >
          <Icon name="arrowRight" size={22} />
        </Link>
      )}
    </div>
  );
}

function VerifyForm() {
  const [id, setId] = useState('');
  const navigate = useNavigate();
  return (
    <form
      className="mt-8 flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) navigate(`/verify/${encodeURIComponent(id.trim())}`);
      }}
    >
      <label htmlFor="landing-verify" className="sr-only">
        Certificate ID
      </label>
      <input
        id="landing-verify"
        className="input sm:max-w-xs"
        placeholder="e.g. CICT26-KB7F2E3U"
        value={id}
        onChange={(e) => setId(e.target.value)}
        autoCapitalize="characters"
      />
      <button type="submit" className="btn btn-primary">
        Verify
      </button>
    </form>
  );
}

export default function LandingPage() {
  useDocumentTitle();
  const { user } = useAuth();
  const { data: workshops, loading } = useAsync(() => listWorkshops({ status: 'PUBLISHED' }), []);
  const upcoming = (workshops || []).slice(0, 3);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <p className="ghost-text absolute -left-4 top-6 hidden md:block" aria-hidden="true">
          Workshops
        </p>
        <div className="relative mx-auto grid max-w-[1280px] items-center gap-16 px-4 pb-16 pt-16 md:px-8 md:pt-40 lg:grid-cols-[1.1fr_0.9fr] lg:pb-32">
          <div>
            <Eyebrow>CICT workshops</Eyebrow>
            <h1 className="display mt-6 max-w-[14ch]">Learn it in the room. Leave with proof.</h1>
            <p className="mt-6 max-w-xl text-[18px] text-charcoal">
              One place to find CICT workshops, register, check in to every session with a QR code, and collect a
              certificate that anyone can verify.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/workshops" className="btn btn-primary btn-lg">
                Browse workshops
              </Link>
              {user ? (
                <Link to={homeFor(user)} className="btn btn-secondary btn-lg">
                  My dashboard
                </Link>
              ) : (
                <Link to="/register" className="btn btn-secondary btn-lg">
                  Create an account
                </Link>
              )}
            </div>
          </div>
          <div className="px-6 md:px-10">
            {loading ? <Skeleton className="mx-auto aspect-square w-full max-w-[420px] !rounded-full" /> : <NextUp workshop={upcoming[0]} />}
          </div>
        </div>
      </section>

      {/* Journey */}
      <section className="relative bg-lifted px-4 py-20 md:px-8 md:py-32" aria-labelledby="journey-title">
        <div className="mx-auto max-w-[1280px]">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="journey-title" className="section-title mt-4 max-w-2xl">
            From first click to verified certificate
          </h2>
          <div className="relative mt-16">
            <Orbit variant="wide" className="absolute left-0 right-0 top-2 h-24 w-full" />
            <ol className="relative grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
              {JOURNEY.map((step, i) => (
                <li key={step.title} className={i % 2 ? 'lg:mt-16' : ''}>
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-[20px] font-medium shadow-nav">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="card-title mt-6">{step.title}</h3>
                  <p className="mt-2 text-charcoal">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Upcoming */}
      <section className="mx-auto max-w-[1280px] px-4 py-20 md:px-8 md:py-32" aria-labelledby="upcoming-title">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Workshops</Eyebrow>
            <h2 id="upcoming-title" className="section-title mt-4">
              Open for registration
            </h2>
          </div>
          <Link to="/workshops" className="btn btn-secondary">
            See all workshops <Icon name="arrowRight" size={18} />
          </Link>
        </div>
        {loading ? (
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : upcoming.length ? (
          <div className="border-b rule">
            {upcoming.map((w) => (
              <WorkshopCard key={w.id} workshop={w} />
            ))}
          </div>
        ) : (
          <p className="text-charcoal">No workshops are open right now. Check back soon.</p>
        )}
      </section>

      {/* Organizers + verify */}
      <section className="mx-auto grid max-w-[1280px] gap-6 px-4 md:px-8 lg:grid-cols-2">
        <div className="panel">
          <Eyebrow>For CICT staff</Eyebrow>
          <h2 className="section-title mt-4">Run a workshop</h2>
          <p className="mt-4 text-charcoal">
            Sign up with your institute <span className="font-medium">@cict.in</span> email to get organizer tools:
            build a registration form, schedule sessions, show a QR code for check-in and issue certificates.
          </p>
          <Link to={user ? homeFor(user) : '/register'} className="btn btn-primary mt-8">
            {user ? 'Go to my dashboard' : 'Create an organizer account'}
          </Link>
        </div>
        <div className="panel">
          <Eyebrow>Certificates</Eyebrow>
          <h2 className="section-title mt-4">Check a certificate</h2>
          <p className="mt-4 text-charcoal">
            Scan the QR code on a certificate, or enter its ID below to confirm it was issued by CICT.
          </p>
          <VerifyForm />
        </div>
      </section>
    </>
  );
}
