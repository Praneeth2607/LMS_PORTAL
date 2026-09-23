// Live sessions inside the portal + proof of active presence.
//
// How watch time is verified:
//   - The browser sends a heartbeat every `heartbeatSeconds`, but only while
//     the person is in the call, the page is visible and they are not idle.
//   - The server measures the gap since the previous heartbeat with its own
//     clock. A normal gap earns one interval of credit; pings that come too
//     fast are rejected; a long gap (paused / tab hidden / idle) earns nothing
//     and simply restarts the clock. The browser never says how much time to add.
//   - When verified time reaches PRESENCE_THRESHOLD_PERCENT (75%) of the
//     session length, attendance is recorded automatically (method PRESENCE).
import env from '../config/env.js';
import { withTransaction } from '../db/pool.js';
import * as presenceRepository from '../repositories/presence.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import * as registrationRepository from '../repositories/registration.repository.js';
import * as attendanceRepository from '../repositories/attendance.repository.js';
import { clientCallInfo, createMeetingToken, createRoom } from './video.service.js';
import { getSessionContext } from './session.service.js';
import { canManage } from './workshop.service.js';
import { randomCode } from '../utils/random.js';
import { HttpError, badRequest, conflict, forbidden } from '../utils/httpError.js';

const cfg = () => env.presence;
const MANAGER_EARLY_JOIN_MS = 30 * 60_000; // organizers may open the room 30 min early
const TOKEN_GRACE_MS = 30 * 60_000; // tokens stay valid 30 min past the end

const timesOf = (session) => {
  const startsAt = new Date(session.startsAt).getTime();
  const endsAt = new Date(session.endsAt).getTime();
  return { startsAt, endsAt, durationSeconds: Math.max(0, Math.round((endsAt - startsAt) / 1000)) };
};

const requiredSecondsFor = (session) => Math.ceil((timesOf(session).durationSeconds * cfg().thresholdPercent) / 100);

function liveState(session, now = Date.now()) {
  const { startsAt, endsAt } = timesOf(session);
  if (now < startsAt) return 'BEFORE';
  if (now >= endsAt) return 'ENDED';
  return 'LIVE';
}

function assertOnlineSession(workshop) {
  if (workshop.mode === 'OFFLINE') {
    throw badRequest('This is an in-person session. Attendance is taken with the QR code in the room.');
  }
  if (workshop.status === 'DRAFT') throw conflict('This workshop is not published yet');
}

// Settings the browser needs to run the tracker (always decided by the server).
export const clientConfig = () => ({
  heartbeatIntervalSeconds: cfg().heartbeatSeconds,
  idleTimeoutSeconds: cfg().idleTimeoutSeconds,
  thresholdPercent: cfg().thresholdPercent,
  demoMode: cfg().demoMode,
});

function statusPayload(session, log, attendance) {
  const activeSeconds = log?.activeSeconds ?? 0;
  const requiredSeconds = requiredSecondsFor(session);
  const { durationSeconds } = timesOf(session);
  return {
    sessionId: session.id,
    liveState: liveState(session),
    activeSeconds,
    activeMinutes: Math.round((activeSeconds / 60) * 10) / 10,
    requiredSeconds,
    requiredMinutes: Math.round((requiredSeconds / 60) * 10) / 10,
    durationMinutes: Math.round(durationSeconds / 60),
    progressPercent: requiredSeconds ? Math.min(100, Math.round((activeSeconds * 1000) / requiredSeconds) / 10) : 0,
    isEligible: activeSeconds >= requiredSeconds && requiredSeconds > 0,
    attendanceStatus: attendance?.status ?? null,
    attendanceMethod: attendance?.method ?? null,
    lastHeartbeatAt: log?.lastHeartbeatAt ?? null,
    config: clientConfig(),
  };
}

const attendanceOf = (sessionId, participantId) => attendanceRepository.findOne(sessionId, participantId);

// ---------------------------------------------------------------- room + join
async function ensureRoom(session) {
  if (session.videoRoomName && session.videoRoomUrl) return { name: session.videoRoomName, url: session.videoRoomUrl };
  const { endsAt } = timesOf(session);
  const room = await createRoom({
    name: `cict-${session.id}-${randomCode(6).toLowerCase()}`,
    expiresAt: new Date(endsAt + TOKEN_GRACE_MS),
  });
  // Only the first creator wins if two people join at the same moment.
  const saved = await sessionRepository.setVideoRoom(session.id, room);
  return saved || room;
}

// Called when the organizer presses Start on an online/hybrid session.
export async function prepareRoom(session) {
  try {
    await ensureRoom(session);
  } catch (err) {
    // Starting the session must not fail because the video service is down;
    // the room is created on first join instead.
    console.warn(`Could not prepare the live room for session ${session.id}: ${err.message}`);
  }
}

// POST /api/sessions/:id/video/join → { roomUrl, token, isOwner, … }
export async function joinVideo(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user);
  assertOnlineSession(workshop);

  const manager = canManage(workshop, user);
  if (!manager) {
    if (user.role !== 'PARTICIPANT') throw forbidden('Only registered participants and the organizer can join this session');
    if (!(await registrationRepository.isRegistered(workshop.id, user.id))) {
      throw forbidden('You are not registered for this workshop');
    }
  }

  const { startsAt, endsAt } = timesOf(session);
  const now = Date.now();
  if (now >= endsAt) throw conflict('This session has ended');
  if (now < startsAt - (manager ? MANAGER_EARLY_JOIN_MS : 0)) {
    throw conflict(`The live room opens at ${session.startTime} on ${session.sessionDate}`);
  }

  const room = await ensureRoom(session);
  const token = await createMeetingToken({
    roomName: room.name,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    isOwner: manager,
    expiresAt: new Date(endsAt + TOKEN_GRACE_MS),
  });

  return {
    roomUrl: room.url,
    token,
    call: clientCallInfo(room),
    isOwner: manager,
    session: {
      id: session.id,
      title: session.title,
      workshopId: workshop.id,
      workshopTitle: workshop.title,
      sessionDate: session.sessionDate,
      startTime: session.startTime,
      endTime: session.endTime,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    },
    presence: manager ? null : statusPayload(session, await presenceRepository.findLog(session.id, user.id), await attendanceOf(session.id, user.id)),
  };
}

// ---------------------------------------------------------------- heartbeat
// POST /api/sessions/:id/heartbeat (participants)
export async function heartbeat(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user);
  assertOnlineSession(workshop);
  if (!(await registrationRepository.isRegistered(workshop.id, user.id))) {
    throw forbidden('You are not registered for this workshop');
  }
  const state = liveState(session);
  if (state === 'BEFORE') throw conflict('This session has not started yet');
  if (state === 'ENDED') throw conflict('This session has ended');

  const { heartbeatSeconds, creditMultiplier } = cfg();
  const { durationSeconds } = timesOf(session);

  const { log, credited } = await withTransaction(async (db) => {
    const current = await presenceRepository.lockLog(session.id, user.id, db);
    const gap = current.secondsSinceLast; // null on the first heartbeat

    // Too fast: someone is spamming the endpoint to inflate their time.
    if (gap !== null && gap < heartbeatSeconds * 0.8) {
      throw new HttpError(429, 'Heartbeat sent too early. Watch time is only counted once per interval.');
    }
    // First heartbeat, or a long gap (tab hidden, idle, left the call):
    // nothing is credited for the gap, the clock just restarts now.
    const regular = gap !== null && gap <= heartbeatSeconds * 1.5;
    const credit = regular ? heartbeatSeconds * creditMultiplier : 0;
    const updated = await presenceRepository.applyHeartbeat(current.id, credit, durationSeconds, db);
    return { log: updated, credited: credit };
  });

  // Reached the threshold: record attendance automatically (idempotent).
  if (log.activeSeconds >= requiredSecondsFor(session)) {
    await attendanceRepository.markPresent(session.id, user.id, 'PRESENCE');
  }

  return { ...statusPayload(session, log, await attendanceOf(session.id, user.id)), creditedSeconds: credited };
}

// GET /api/sessions/:id/presence (participants: their own status)
export async function getStatus(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user);
  assertOnlineSession(workshop);
  return statusPayload(session, await presenceRepository.findLog(session.id, user.id), await attendanceOf(session.id, user.id));
}

// GET /api/sessions/:id/presence/participants (organizer/admin: live overview)
export async function listParticipants(sessionId, user) {
  const { session, workshop } = await getSessionContext(sessionId, user, { manage: true });
  assertOnlineSession(workshop);
  const requiredSeconds = requiredSecondsFor(session);
  const now = Date.now();
  const recentMs = cfg().heartbeatSeconds * 2 * 1000;
  const rows = await presenceRepository.listForSession(session.id, workshop.id);
  return {
    ...statusPayload(session, null, null),
    requiredSeconds,
    participants: rows.map((r) => ({
      participantId: r.participantId,
      participantName: r.participantName,
      participantEmail: r.participantEmail,
      activeSeconds: r.activeSeconds,
      activeMinutes: Math.round((r.activeSeconds / 60) * 10) / 10,
      progressPercent: requiredSeconds ? Math.min(100, Math.round((r.activeSeconds * 1000) / requiredSeconds) / 10) : 0,
      // "Watching now" = heartbeat within the last two intervals.
      watchingNow: Boolean(r.lastHeartbeatAt) && now - new Date(r.lastHeartbeatAt).getTime() <= recentMs,
      attendanceStatus: r.attendanceStatus ?? null,
      attendanceMethod: r.attendanceMethod ?? null,
    })),
  };
}
