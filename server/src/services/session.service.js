import * as sessionRepository from '../repositories/session.repository.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { canManage, canSeeMeetingLink, getManageableWorkshop, getVisibleWorkshop } from './workshop.service.js';

// Hides the attendance secrets from everyone except the workshop managers, and
// meeting links from people who are not registered.
function present(session, workshop, user) {
  const manager = canManage(workshop, user);
  const { attendanceToken, attendanceCode, myAttendanceStatus, ...rest } = session;
  return {
    ...rest,
    meetingLink: canSeeMeetingLink(workshop, user) ? session.meetingLink || workshop.meetingLink : null,
    ...(manager && { attendanceCode: session.attendanceOpen ? attendanceCode : null }),
    ...(user?.role === 'PARTICIPANT' && { myAttendanceStatus: myAttendanceStatus ?? null }),
  };
}

function assertSessionFits(session, workshop) {
  const errors = [];
  if (session.sessionDate < workshop.startDate || session.sessionDate > workshop.endDate) {
    errors.push({
      field: 'sessionDate',
      message: `Session date must be between ${workshop.startDate} and ${workshop.endDate}`,
    });
  }
  if (session.endTime <= session.startTime) {
    errors.push({ field: 'endTime', message: 'End time must be after start time' });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

// Loads a session plus its workshop, enforcing workshop visibility.
export async function getSessionContext(sessionId, user, { manage = false } = {}) {
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw notFound('Session not found');
  const workshop = manage
    ? await getManageableWorkshop(session.workshopId, user)
    : await getVisibleWorkshop(session.workshopId, user);
  return { session, workshop };
}

export async function listSessions(workshopId, user) {
  const workshop = await getVisibleWorkshop(workshopId, user);
  const participantId = user?.role === 'PARTICIPANT' ? user.id : null;
  const sessions = await sessionRepository.listByWorkshop(workshopId, participantId);
  return sessions.map((s) => present(s, workshop, user));
}

export async function getSession(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user);
  return present(session, workshop, user);
}

export async function createSession(workshopId, data, user) {
  const workshop = await getManageableWorkshop(workshopId, user);
  assertSessionFits(data, workshop);
  const id = await sessionRepository.create(workshopId, data);
  return getSession(id, user);
}

export async function updateSession(sessionId, data, user) {
  const { session, workshop } = await getSessionContext(sessionId, user, { manage: true });
  for (const field of ['title', 'sessionDate', 'startTime', 'endTime']) {
    if (data[field] === null) delete data[field];
  }
  assertSessionFits({ ...session, ...data }, workshop);
  await sessionRepository.update(sessionId, data);
  return getSession(sessionId, user);
}

export async function deleteSession(sessionId, user) {
  await getSessionContext(sessionId, user, { manage: true });
  await sessionRepository.remove(sessionId);
}
