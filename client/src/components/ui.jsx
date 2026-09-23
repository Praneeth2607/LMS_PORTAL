// Small shared UI primitives: typography, badges, feedback states, stats.
import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { dateParts } from '../utils/format.js';

// ---------------------------------------------------------------- Logo
export function Logo({ to = '/', compact = false }) {
  return (
    <Link to={to} className="flex items-center gap-3 rounded-full" aria-label="CICT Workshops, home">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <circle cx="16" cy="18" r="11" fill="#141413" />
        <circle cx="16" cy="18" r="15" fill="none" stroke="#F37338" strokeWidth="1.25" strokeDasharray="60 40" />
        <circle cx="28" cy="7" r="3.5" fill="#F37338" />
      </svg>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-semibold tracking-[-0.02em]">CICT Workshops</span>
          <span className="block text-[12px] font-bold uppercase tracking-[0.06em] text-slate">Aurex&rsquo;26</span>
        </span>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------- Typography
export const Eyebrow = ({ children, className = '', as: Tag = 'p' }) => (
  <Tag className={`eyebrow ${className}`}>{children}</Tag>
);

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="mb-10 flex flex-col gap-6 md:mb-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <Eyebrow className="mb-5">{eyebrow}</Eyebrow>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-4 max-w-2xl text-[18px] text-charcoal">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export function SectionHeader({ eyebrow, title, action, className = '' }) {
  return (
    <div className={`mb-6 flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h2 className="section-title">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Badges
// Restrained tones: strong (ink), neutral (white), muted (quiet), accent (orange dot).
const TONES = {
  strong: 'bg-ink text-canvas border-ink',
  neutral: 'bg-white text-ink border-ink/25',
  muted: 'bg-transparent text-slate border-dust',
  accent: 'bg-white text-ink border-ink/25',
};

export function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] font-medium leading-5 ${TONES[tone]} ${className}`}
    >
      {tone === 'accent' && <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden="true" />}
      {children}
    </span>
  );
}

const STATUS = {
  DRAFT: ['Draft', 'neutral'],
  PUBLISHED: ['Published', 'strong'],
  CLOSED: ['Closed', 'muted'],
  REGISTERED: ['Registered', 'neutral'],
  CANCELLED: ['Cancelled', 'muted'],
  PRESENT: ['Present', 'strong'],
  ABSENT: ['Absent', 'muted'],
  ELIGIBLE: ['Eligible', 'strong'],
  NOT_ELIGIBLE: ['Not eligible', 'muted'],
  ISSUED: ['Issued', 'strong'],
  PENDING: ['Pending', 'neutral'],
  UPCOMING: ['Upcoming', 'neutral'],
  OPEN: ['Attendance open', 'accent'],
  NOT_MARKED: ['Not marked', 'muted'],
  ADMIN: ['Admin', 'strong'],
  ORGANIZER: ['Organizer', 'neutral'],
  PARTICIPANT: ['Participant', 'muted'],
};

export function StatusBadge({ status, className }) {
  const [label, tone] = STATUS[status] || [status, 'neutral'];
  return (
    <Badge tone={tone} className={className}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------- Feedback
export const Skeleton = ({ className = '' }) => <div className={`skeleton ${className}`} aria-hidden="true" />;

export function LoadingBlock({ rows = 3, label = 'Loading' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-9 w-2/5" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={`h-16 ${i % 2 ? 'w-11/12' : 'w-full'}`} />
      ))}
    </div>
  );
}

export function EmptyState({ title, children, action, icon = 'calendar' }) {
  return (
    <div className="flex flex-col items-center rounded-panel border border-dashed border-dust px-6 py-14 text-center">
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-white text-ink" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <h3 className="card-title">{title}</h3>
      {children && <p className="mt-2 max-w-md text-slate">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }) {
  const status = error?.status;
  const heading =
    title ||
    (status === 404 ? 'Not found' : status === 403 ? 'Access denied' : status === 0 ? 'Connection problem' : "Something didn't load");
  return (
    <div role="alert" className="flex flex-col items-center rounded-panel bg-lifted px-6 py-14 text-center">
      <span className="mb-5 grid h-14 w-14 place-items-center rounded-full bg-white text-clay" aria-hidden="true">
        <Icon name="alert" size={22} />
      </span>
      <h3 className="card-title">{heading}</h3>
      <p className="mt-2 max-w-md text-slate">{error?.message || 'Please try again.'}</p>
      {onRetry && status !== 404 && status !== 403 && (
        <button type="button" className="btn btn-secondary mt-6" onClick={() => onRetry()}>
          Try again
        </button>
      )}
    </div>
  );
}

// Inline message. tone: info | success | error
export function Notice({ tone = 'info', title, children, className = '' }) {
  const styles = {
    info: 'bg-white border-ink/15',
    success: 'bg-white border-ink',
    error: 'bg-white border-clay text-clay',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-[24px] border px-5 py-4 ${styles[tone]} ${className}`}
    >
      <Icon name={tone === 'error' ? 'alert' : 'check'} className="mt-0.5" />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={tone === 'error' ? '' : 'text-charcoal'}>{children}</div>}
      </div>
    </div>
  );
}

export const Spinner = ({ className = '' }) => (
  <span
    className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    aria-hidden="true"
  />
);

// ---------------------------------------------------------------- Data display
export function StatTile({ label, value, hint }) {
  return (
    <div className="tile">
      <p className="text-[14px] font-medium text-slate">{label}</p>
      <p className="mt-3 text-[40px] font-medium leading-none tracking-[-0.03em]">{value}</p>
      {hint && <p className="mt-2 text-[14px] text-slate">{hint}</p>}
    </div>
  );
}

// Displays a percentage returned by the backend (never computed here).
export function ProgressBar({ value = 0, label, marker }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div
        className="relative h-2 w-full overflow-visible rounded-full bg-ghost"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-2 rounded-full bg-ink" style={{ width: `${clamped}%` }} />
        {marker !== undefined && (
          <span
            className="absolute -top-1 h-4 w-0.5 rounded bg-signal-light"
            style={{ left: `${marker}%` }}
            aria-hidden="true"
            title={`${marker}% required`}
          />
        )}
      </div>
    </div>
  );
}

// Circular typographic date mark used in place of imagery.
export function DateDisc({ date, size = 'md', tone = 'white' }) {
  const parts = dateParts(date);
  if (!parts) return null;
  const sizes = {
    sm: 'h-16 w-16 text-[22px]',
    md: 'h-24 w-24 text-[34px]',
    lg: 'h-44 w-44 text-[64px] md:h-56 md:w-56 md:text-[80px]',
  };
  const tones = { white: 'bg-white text-ink', ink: 'bg-ink text-canvas', cream: 'bg-lifted text-ink' };
  return (
    <div
      className={`grid shrink-0 place-content-center rounded-full text-center ${sizes[size]} ${tones[tone]}`}
      aria-hidden="true"
    >
      <span className="font-medium leading-none tracking-[-0.03em]">{parts.day}</span>
      <span className="mt-1 text-[0.36em] font-bold uppercase tracking-[0.08em] opacity-70">{parts.month}</span>
    </div>
  );
}

// Thin decorative orbital arcs. Hidden on mobile and from assistive tech.
export function Orbit({ className = '', variant = 'wide' }) {
  const paths = {
    wide: 'M-20 220 C 180 40, 520 10, 760 120 S 1180 300, 1300 140',
    ring: 'M200 20 A 180 180 0 1 1 199 20',
    arc: 'M10 300 C 120 80, 380 20, 560 160',
  };
  const viewBox = { wide: '0 0 1280 320', ring: '0 0 400 400', arc: '0 0 580 320' }[variant];
  return (
    <svg
      className={`pointer-events-none hidden md:block ${className}`}
      viewBox={viewBox}
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={paths[variant]} stroke="#F37338" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function BackLink({ to, children }) {
  return (
    <Link to={to} className="mb-8 inline-flex min-h-11 items-center gap-2 font-medium text-charcoal hover:text-ink">
      <Icon name="arrowLeft" size={18} />
      {children}
    </Link>
  );
}

// Key/value list for facts (dates, venue…)
export function Facts({ items }) {
  return (
    <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      {items.filter(Boolean).map(({ label, value, icon }) => (
        <div key={label} className="flex gap-3">
          {icon && (
            <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white" aria-hidden="true">
              <Icon name={icon} size={18} />
            </span>
          )}
          <div className="min-w-0">
            <dt className="text-[14px] text-slate">{label}</dt>
            <dd className="mt-0.5 break-words font-medium">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
