import QRCode from 'qrcode';
import env from '../config/env.js';
import * as attendanceRepository from '../repositories/attendance.repository.js';
import * as registrationRepository from '../repositories/registration.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import { listSessions, getSessionContext } from './session.service.js';
import { getManageableWorkshop } from './workshop.service.js';
import { randomCode, randomToken, safeEqual } from '../utils/random.js';
import { badRequest, conflict, forbidden, HttpError } from '../utils/httpError.js';

// ---- Calculation (single source of truth for percentage and eligibility) ----

export function calculateAttendance(attendedSessions, totalSessions, threshold = env.certificateThreshold) {
  const percentage = totalSessions > 0 ? Math.round((attendedSessions * 10000) / totalSessions) / 100 : 0;
  return {
    totalSessions,
    attendedSessions,
    percentage,
    threshold,
    // Integer comparison avoids floating point edge cases (9/10 must be exactly 90%).
    eligible: totalSessions > 0 && attendedSessions * 100 >= threshold * totalSessions,
  };
}

// Server-calculated summary for every registered participant (or just one).
export async function getWorkshopSummary(workshopId, participantId = null) {
  const rows = await attendanceRepository.countsForWorkshop(workshopId, participantId);
  return rows.map((row) => ({
    participantId: row.participantId,
    participantName: row.participantName,
    participantEmail: row.participantEmail,
    ...calculateAttendance(row.attendedSessions, row.totalSessions),
  }));
}

// ---- QR / code attendance ----

export async function startAttendance(sessionId, { durationMinutes }, user) {
  const { session, workshop } = await getSessionContext(sessionId, user, { manage: true });
  if (workshop.status === 'DRAFT') throw conflict('Publish the workshop before taking attendance');

  const minutes = durationMinutes || env.attendanceWindowMinutes;
  const token = randomToken(32);
  const code = randomCode(6);
  const expiresAt = await sessionRepository.startAttendance(session.id, { token, code, minutes });

  // The QR only carries a link to the frontend; the participant's authenticated
  // POST .../attendance/mark is what actually records attendance.
  const attendanceUrl = `${env.frontendUrl}/attendance/${session.id}?token=${token}`;
  const qrCode = await QRCode.toDataURL(attendanceUrl, { width: 480, margin: 2, errorCorrectionLevel: 'M' });

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    workshopId: workshop.id,
    attendanceActive: true,
    attendanceUrl,
    qrCode,
    attendanceCode: code,
    durationMinutes: minutes,
    expiresAt,
  };
}

export async function stopAttendance(sessionId, user) {
  const { session } = await getSessionContext(sessionId, user, { manage: true });
  await sessionRepository.stopAttendance(session.id);
  return {
    sessionId: session.id,
    attendanceActive: false,
    presentCount: await attendanceRepository.countPresent(session.id),
  };
}

export async function markAttendance(sessionId, { token, code }, user) {
  if (!token && !code) throw badRequest('Provide the token from the QR code or the attendance code');

  // 1. Session exists (and its workshop is visible)
  const { session, workshop } = await getSessionContext(sessionId, user);

  // 2. Attendance is active
  if (!session.attendanceToken) throw badRequest('Attendance is not open for this session');

  // 3. Token / code is valid
  const valid = token
    ? safeEqual(token, session.attendanceToken)
    : safeEqual(code.trim().toUpperCase(), session.attendanceCode);
  if (!valid) throw badRequest(token ? 'Invalid attendance QR code' : 'Invalid attendance code');

  // 4. Not expired
  if (!session.attendanceOpen) throw new HttpError(410, 'This attendance QR/code has expired');

  // 5. Authenticated participant (route middleware) registered for the workshop
  if (!(await registrationRepository.isRegistered(workshop.id, user.id))) {
    throw forbidden('You are not registered for this workshop');
  }

  // 6. Not already marked
  const record = await attendanceRepository.markPresent(session.id, user.id, token ? 'QR' : 'CODE');
  if (!record) throw conflict('Your attendance is already marked for this session');

  return {
    sessionId: session.id,
    sessionTitle: session.title,
    workshopId: workshop.id,
    workshopTitle: workshop.title,
    status: record.status,
    method: record.method,
    markedAt: record.markedAt,
  };
}

// Organizer fallback: mark a registered participant PRESENT or ABSENT by hand.
export async function setManualAttendance(sessionId, { participantId, status }, user) {
  const { session, workshop } = await getSessionContext(sessionId, user, { manage: true });
  if (!(await registrationRepository.isRegistered(workshop.id, participantId))) {
    throw badRequest('That participant is not registered for this workshop');
  }
  const record = await attendanceRepository.setManual(session.id, participantId, status);
  return { ...record, sessionId: session.id };
}

// ---- Reports ----

// Attendance grid: sessions × registered participants.
export async function getWorkshopAttendance(workshopId, user) {
  await getManageableWorkshop(workshopId, user);
  const [sessions, summary, records] = await Promise.all([
    listSessions(workshopId, user),
    getWorkshopSummary(workshopId),
    attendanceRepository.listForWorkshop(workshopId),
  ]);

  const byParticipant = new Map(summary.map((p) => [p.participantId, { ...p, sessions: {} }]));
  for (const record of records) {
    const participant = byParticipant.get(record.participantId);
    if (participant) {
      participant.sessions[record.sessionId] = { status: record.status, method: record.method, markedAt: record.markedAt };
    }
  }

  return {
    sessions: sessions.map(({ id, title, sessionDate, startTime, endTime, attendanceOpen }) => ({
      id,
      title,
      sessionDate,
      startTime,
      endTime,
      attendanceOpen,
    })),
    participants: [...byParticipant.values()],
  };
}

export async function getAttendanceSummary(workshopId, user) {
  await getManageableWorkshop(workshopId, user);
  const participants = await getWorkshopSummary(workshopId);
  return {
    workshopId,
    threshold: env.certificateThreshold,
    totalSessions: participants[0]?.totalSessions ?? (await listSessions(workshopId, user)).length,
    eligibleCount: participants.filter((p) => p.eligible).length,
    participants,
  };
}
