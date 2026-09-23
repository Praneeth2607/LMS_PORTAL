import { withTransaction } from '../db/pool.js';
import * as workshopRepository from '../repositories/workshop.repository.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';

// ---- Access helpers (also used by the session, attendance, certificate and
// announcement services) ----

export const canManage = (workshop, user) =>
  Boolean(user) &&
  (user.role === 'ADMIN' || (user.role === 'ORGANIZER' && workshop.createdBy === user.id));

// Drafts are invisible (404) to anyone who cannot manage them.
export async function getVisibleWorkshop(workshopId, user) {
  const workshop = await workshopRepository.findById(workshopId, user?.id);
  if (!workshop || (workshop.status === 'DRAFT' && !canManage(workshop, user))) {
    throw notFound('Workshop not found');
  }
  return workshop;
}

export async function getManageableWorkshop(workshopId, user) {
  const workshop = await getVisibleWorkshop(workshopId, user);
  if (!canManage(workshop, user)) throw forbidden('Only the workshop organizer or an admin can do this');
  return workshop;
}

// Meeting links are only shown to people who manage or are registered for the workshop.
export const canSeeMeetingLink = (workshop, user) => canManage(workshop, user) || workshop.isRegistered;

function present(workshop, user) {
  return {
    ...workshop,
    meetingLink: canSeeMeetingLink(workshop, user) ? workshop.meetingLink : null,
    canManage: canManage(workshop, user),
  };
}

// ---- Use cases ----

export async function listWorkshops(filters, user) {
  const rows = await workshopRepository.list({ ...filters, viewer: user });
  return rows.map((w) => present(w, user));
}

export async function getWorkshop(workshopId, user) {
  const workshop = await getVisibleWorkshop(workshopId, user);
  const registrationFields = await workshopRepository.findFields(workshopId);
  return { ...present(workshop, user), registrationFields };
}

function assertDateOrder(startDate, endDate) {
  if (endDate < startDate) {
    throw badRequest('Validation failed', [{ field: 'endDate', message: 'End date cannot be before start date' }]);
  }
}

export async function createWorkshop(data, user) {
  assertDateOrder(data.startDate, data.endDate);
  const id = await withTransaction(async (db) => {
    const workshopId = await workshopRepository.create(data, user.id, db);
    if (data.registrationFields?.length) {
      await workshopRepository.replaceFields(workshopId, data.registrationFields, db);
    }
    return workshopId;
  });
  return getWorkshop(id, user);
}

export async function updateWorkshop(workshopId, data, user) {
  const workshop = await getManageableWorkshop(workshopId, user);
  assertDateOrder(data.startDate ?? workshop.startDate, data.endDate ?? workshop.endDate);

  // Required columns cannot be cleared.
  for (const field of ['title', 'startDate', 'endDate', 'mode']) {
    if (data[field] === null) delete data[field];
  }

  await withTransaction(async (db) => {
    await workshopRepository.update(workshopId, data, db);
    if (data.registrationFields !== undefined) {
      await workshopRepository.replaceFields(workshopId, data.registrationFields || [], db);
    }
  });
  return getWorkshop(workshopId, user);
}

export async function deleteWorkshop(workshopId, user) {
  const workshop = await getManageableWorkshop(workshopId, user);
  if (await workshopRepository.countCertificates(workshopId)) {
    throw conflict('Certificates have been issued for this workshop; close it instead of deleting');
  }
  if (workshop.registeredCount > 0 && user.role !== 'ADMIN') {
    throw conflict('This workshop has registered participants; close it instead, or ask an admin');
  }
  await workshopRepository.remove(workshopId);
}

export async function publishWorkshop(workshopId, user) {
  const workshop = await getManageableWorkshop(workshopId, user);

  const problems = [];
  if (['OFFLINE', 'HYBRID'].includes(workshop.mode) && !workshop.venue) {
    problems.push({ field: 'venue', message: `A venue is required for ${workshop.mode} workshops` });
  }
  if (['ONLINE', 'HYBRID'].includes(workshop.mode) && !workshop.meetingLink) {
    problems.push({ field: 'meetingLink', message: `A meeting link is required for ${workshop.mode} workshops` });
  }
  if (problems.length) throw badRequest('Workshop is not ready to publish', problems);

  await workshopRepository.setStatus(workshopId, 'PUBLISHED');
  return getWorkshop(workshopId, user);
}

export async function closeWorkshop(workshopId, user) {
  const workshop = await getManageableWorkshop(workshopId, user);
  if (workshop.status === 'DRAFT') throw conflict('A draft workshop cannot be closed; delete it instead');
  await workshopRepository.setStatus(workshopId, 'CLOSED');
  return getWorkshop(workshopId, user);
}
