import * as sessionRepository from '../repositories/session.repository.js';
import env from '../config/env.js';
import { prepareRoom } from './presence.service.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { canManage, canSeeMeetingLink, getManageableWorkshop, getVisibleWorkshop } from './workshop.service.js';

// When the organizer may start QR/code attendance: from the session start
// until ATTENDANCE_CLOSE_AFTER_END_MINUTES after it ends.
export function attendanceWindow(session) {
  const opensAt = new Date(session.startsAt);
  const closesAt = new Date(new Date(session.endsAt).getTime() + env.attendanceCloseAfterEndMinutes * 60_000);
  return { opensAt, closesAt };
}

// Hides the attendance secrets from everyone except the workshop managers, and
// meeting links from people who are not registered.
function present(session, workshop, user) {
  const manager = canManage(workshop, user);
  const { attendanceToken, attendanceCode, myAttendanceStatus, myFeedbackSubmitted, videoRoomName, videoRoomUrl, ...rest } = session;
  return {
    ...rest,
    meetingLink: canSeeMeetingLink(workshop, user) ? session.meetingLink || workshop.meetingLink : null,
    // Online/hybrid sessions run live inside the portal (/sessions/:id/live).
    liveInPortal: workshop.mode !== 'OFFLINE',
    ...(manager && {
      attendanceCode: session.attendanceOpen ? attendanceCode : null,
      attendanceOpensAt: attendanceWindow(session).opensAt,
      attendanceClosesAt: attendanceWindow(session).closesAt,
    }),
    ...(user?.role === 'PARTICIPANT' && {
      myAttendanceStatus: myAttendanceStatus ?? null,
      myFeedbackSubmitted: Boolean(myFeedbackSubmitted),
    }),
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

// POST /api/sessions/:id/start: the organizer starts the session once its
// scheduled start time has arrived (server clock + APP_TIMEZONE). Idempotent
// while the session is ONGOING, so the organizer can reopen the meeting link.
export async function startSession(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user, { manage: true });
  if (workshop.status === 'DRAFT') throw conflict('Publish the workshop before starting its sessions');
  if (session.status === 'SCHEDULED') {
    throw conflict(`This session can be started from ${session.startTime} on ${session.sessionDate}`);
  }
  if (session.status === 'COMPLETED') throw conflict('This session has already ended');
  if (session.status === 'READY') await sessionRepository.markStarted(session.id);
  // Online/hybrid: have the live room ready for participants.
  if (workshop.mode !== 'OFFLINE') await prepareRoom(session);
  return getSession(sessionId, user);
}

export async function deleteSession(sessionId, user) {
  await getSessionContext(sessionId, user, { manage: true });
  await sessionRepository.remove(sessionId);
}
