export const HOME_BY_ROLE = {
  PARTICIPANT: '/participant/dashboard',
  ORGANIZER: '/organizer/dashboard',
  ADMIN: '/admin/dashboard',
};

export const homeFor = (user) => (user ? HOME_BY_ROLE[user.role] || '/' : '/');

// Only allow same-site relative redirects (prevents ?next=https://evil.example).
export function safeNext(next) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//')) return null;
  return next;
}

// Path prefixes that only some roles can use (mirrors the route guards in App.jsx).
const RESTRICTED_AREAS = [
  ['/participant', ['PARTICIPANT']],
  ['/attendance', ['PARTICIPANT']],
  ['/organizer', ['ORGANIZER', 'ADMIN']],
  ['/admin', ['ADMIN']],
];

const canVisit = (path, user) => {
  if (/^\/(login|register)(\/|\?|$)/.test(path)) return false;
  const area = RESTRICTED_AREAS.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return !area || area[1].includes(user.role);
};

// Where to send someone right after they sign in or register: back to the page
// that asked them to sign in (e.g. a scanned attendance QR or a workshop they
// wanted to join) if their role can open it, otherwise their own dashboard.
export function destinationAfterAuth(next, user) {
  const path = safeNext(next);
  return path && canVisit(path, user) ? path : homeFor(user);
}

// Where organizers and admins manage a workshop.
export const manageWorkshopPath = (id, section = '') => `/organizer/workshops/${id}${section ? `/${section}` : ''}`;
