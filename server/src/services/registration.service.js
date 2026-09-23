import { withTransaction } from '../db/pool.js';
import * as registrationRepository from '../repositories/registration.repository.js';
import * as workshopRepository from '../repositories/workshop.repository.js';
import { validateFormData } from '../validators/registration.validator.js';
import { calculateAttendance } from './attendance.service.js';
import { getManageableWorkshop, getVisibleWorkshop, listWorkshops } from './workshop.service.js';
import { conflict, notFound } from '../utils/httpError.js';

export async function register(workshopId, formData, user) {
  await getVisibleWorkshop(workshopId, user); // 404 for drafts

  return withTransaction(async (db) => {
    // Lock the workshop row so concurrent registrations cannot exceed capacity.
    const workshop = await workshopRepository.lockById(workshopId, db);
    if (workshop.status !== 'PUBLISHED') throw conflict('Registration is closed for this workshop');

    const existing = await registrationRepository.findOne(workshopId, user.id, db);
    if (existing?.status === 'REGISTERED') throw conflict('You are already registered for this workshop');

    if (workshop.capacity && (await registrationRepository.countActive(workshopId, db)) >= workshop.capacity) {
      throw conflict('This workshop is full');
    }

    const fields = await workshopRepository.findFields(workshopId, db);
    const cleanData = validateFormData(fields, formData);

    return existing
      ? registrationRepository.reactivate(existing.id, cleanData, db)
      : registrationRepository.create(workshopId, user.id, cleanData, db);
  });
}

export async function cancel(workshopId, user) {
  await getVisibleWorkshop(workshopId, user);
  const existing = await registrationRepository.findOne(workshopId, user.id);
  if (!existing || existing.status !== 'REGISTERED') throw notFound('You are not registered for this workshop');
  return registrationRepository.cancel(existing.id);
}

export async function listForWorkshop(workshopId, { status }, user) {
  await getManageableWorkshop(workshopId, user);
  return registrationRepository.listByWorkshop(workshopId, status);
}

// Participants get their registrations with server-calculated attendance and
// certificate status; organizers/admins get the workshops they created.
export async function myWorkshops(user) {
  if (user.role !== 'PARTICIPANT') return listWorkshops({ mine: true }, user);

  const rows = await registrationRepository.listForParticipant(user.id);
  return rows.map((row) => ({
    registrationId: row.registrationId,
    registrationStatus: row.registrationStatus,
    registeredAt: row.registeredAt,
    formData: row.formData,
    workshop: {
      id: row.workshopId,
      title: row.title,
      description: row.description,
      startDate: row.startDate,
      endDate: row.endDate,
      mode: row.mode,
      venue: row.venue,
      meetingLink: row.registrationStatus === 'REGISTERED' ? row.meetingLink : null,
      status: row.workshopStatus,
      organizerName: row.organizerName,
    },
    attendance: calculateAttendance(row.attendedSessions, row.totalSessions),
    certificate: row.certificateId ? { certificateId: row.certificateId, issuedAt: row.certificateIssuedAt } : null,
  }));
}
