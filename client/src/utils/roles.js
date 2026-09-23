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

// Where organizers and admins manage a workshop.
export const manageWorkshopPath = (id, section = '') => `/organizer/workshops/${id}${section ? `/${section}` : ''}`;
