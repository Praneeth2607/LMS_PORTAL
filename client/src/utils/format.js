// Display formatting only. No business rules live here: attendance
// percentages and eligibility always come from the backend.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'YYYY-MM-DD' → local Date (no timezone shift).
export function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(value) {
  const date = parseDate(value);
  return date ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}` : '';
}

export function formatDateRange(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a) return '';
  if (!b || start === end) return formatDate(start);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export function dateParts(value) {
  const date = parseDate(value);
  return date ? { day: String(date.getDate()), month: MONTHS[date.getMonth()], year: String(date.getFullYear()) } : null;
}

// 'HH:MM' → '2:00 PM'
export function formatTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const time = formatTime(`${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${time}`;
}

export function formatPercent(value) {
  if (value === null || value === undefined) return '–';
  return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export const MODE_LABELS = { ONLINE: 'Online', OFFLINE: 'In person', HYBRID: 'Hybrid' };
export const modeLabel = (mode) => MODE_LABELS[mode] || mode;

export const ROLE_LABELS = { ADMIN: 'Admin', ORGANIZER: 'Organizer', PARTICIPANT: 'Participant' };
export const roleLabel = (role) => ROLE_LABELS[role] || role;

// Session start/end as local Dates.
export const sessionStart = (s) => new Date(`${s.sessionDate}T${s.startTime}:00`);
export const sessionEnd = (s) => new Date(`${s.sessionDate}T${s.endTime}:00`);
export const isSessionUpcoming = (s, now = new Date()) => sessionEnd(s) >= now;

// Session lifecycle as of `now`, from the backend's startsAt/endsAt/startedAt.
// Mirrors the server's `status` so buttons unlock on time without a reload;
// the server still validates every start request.
export function sessionLiveStatus(session, now = Date.now()) {
  if (!session.startsAt) return session.status;
  if (now >= new Date(session.endsAt).getTime()) return 'COMPLETED';
  if (session.startedAt) return 'ONGOING';
  if (now >= new Date(session.startsAt).getTime()) return 'READY';
  return 'SCHEDULED';
}

// Whether the organizer can start QR/code attendance right now, from the
// backend's attendanceOpensAt/attendanceClosesAt (the server enforces it too).
//   BEFORE (not started yet) | OPEN | CLOSED (too long after the session ended)
export function attendanceWindowState(session, now = Date.now()) {
  if (!session.attendanceOpensAt) return 'OPEN';
  if (now < new Date(session.attendanceOpensAt).getTime()) return 'BEFORE';
  if (now >= new Date(session.attendanceClosesAt).getTime()) return 'CLOSED';
  return 'OPEN';
}

// "2:00 PM" for an ISO timestamp.
export function formatClock(iso) {
  const d = new Date(iso);
  return formatTime(`${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`);
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "4:32" countdown from milliseconds.
export function formatCountdown(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export const firstName = (name = '') => name.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i, '').split(' ')[0];

// Registration state shown on workshop cards and detail pages (display only;
// the backend still enforces every rule on register).
export function registrationState(workshop) {
  if (workshop.isRegistered) return { label: 'Registered', tone: 'strong' };
  if (workshop.status === 'DRAFT') return { label: 'Draft', tone: 'neutral' };
  if (workshop.status === 'CLOSED') return { label: 'Registration closed', tone: 'muted' };
  if (workshop.capacity && workshop.registeredCount >= workshop.capacity) return { label: 'Full', tone: 'muted' };
  return { label: 'Open for registration', tone: 'accent' };
}

export function seatsLabel(workshop) {
  if (!workshop.capacity) return `${workshop.registeredCount} registered`;
  const left = Math.max(0, workshop.capacity - workshop.registeredCount);
  return `${left} of ${workshop.capacity} seats left`;
}
