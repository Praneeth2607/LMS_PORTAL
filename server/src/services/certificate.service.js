import { unlink } from 'node:fs/promises';
import env from '../config/env.js';
import * as certificateRepository from '../repositories/certificate.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import { getWorkshopSummary } from './attendance.service.js';
import { certificatePath, ensureCertificatePdf, generateCertificatePdf, saveCertificatePdf } from './certificatePdf.service.js';
import { canManage, getManageableWorkshop } from './workshop.service.js';
import { randomCode, randomToken, safeEqual } from '../utils/random.js';
import { conflict, forbidden, notFound } from '../utils/httpError.js';

const CERTIFICATE_ID_PREFIX = 'CICT26-';
const CERTIFICATE_ID_RE = /^[A-Z0-9-]{4,20}$/;

const verificationUrl = (cert) =>
  `${env.frontendUrl}/verify/${cert.certificateId}?token=${encodeURIComponent(cert.verificationToken)}`;

const pdfData = (cert) => ({
  certificateId: cert.certificateId,
  participantName: cert.participantName,
  workshopTitle: cert.workshopTitle,
  startDate: cert.startDate,
  endDate: cert.endDate,
  attendancePercentage: cert.attendancePercentage,
  organizerName: cert.organizerName,
  issuedAt: cert.issuedAt,
  verificationUrl: verificationUrl(cert),
});

// Private view for the participant, the workshop organizer and admins.
const present = (cert) => ({
  certificateId: cert.certificateId,
  participantId: cert.participantId,
  participantName: cert.participantName,
  workshopId: cert.workshopId,
  workshopTitle: cert.workshopTitle,
  startDate: cert.startDate,
  endDate: cert.endDate,
  organizerName: cert.organizerName,
  attendancePercentage: cert.attendancePercentage,
  issuedAt: cert.issuedAt,
  verificationUrl: verificationUrl(cert),
  downloadUrl: `/api/certificates/${cert.certificateId}/download`,
});

// Issues one certificate: DB row first (the unique constraint prevents
// duplicates), then the PDF. If the PDF fails the row is removed again.
async function issueCertificate(workshopId, participant) {
  const cert = await certificateRepository.create({
    certificateId: `${CERTIFICATE_ID_PREFIX}${randomCode(8)}`,
    participantId: participant.participantId,
    workshopId,
    attendancePercentage: participant.percentage,
    verificationToken: randomToken(24),
  });
  if (!cert) return null; // issued concurrently

  try {
    await saveCertificatePdf(cert.certificateId, await generateCertificatePdf(pdfData(cert)));
  } catch (err) {
    await certificateRepository.removeByCertificateId(cert.certificateId);
    await unlink(certificatePath(cert.certificateId)).catch(() => {});
    throw err;
  }
  return cert;
}

// POST /api/workshops/:id/certificates/generate
// 1. fetch sessions  2. fetch attendance  3. calculate %  4. check 90% rule
// 5-8. create ID + verification token, render PDF, save metadata  9. report
export async function generateForWorkshop(workshopId, user) {
  const workshop = await getManageableWorkshop(workshopId, user);
  if (workshop.status === 'DRAFT') throw conflict('Certificates cannot be generated for a draft workshop');

  const sessions = await sessionRepository.listByWorkshop(workshopId);
  if (sessions.length === 0) throw conflict('This workshop has no sessions, so attendance cannot be calculated');

  const summary = await getWorkshopSummary(workshopId);
  const result = { workshopId, threshold: env.certificateThreshold, totalSessions: sessions.length, generated: [], alreadyIssued: [], notEligible: [] };

  for (const participant of summary) {
    const entry = {
      participantId: participant.participantId,
      participantName: participant.participantName,
      attendedSessions: participant.attendedSessions,
      attendancePercentage: participant.percentage,
    };

    if (!participant.eligible) {
      result.notEligible.push(entry);
      continue;
    }

    const existing = await certificateRepository.findByWorkshopAndParticipant(workshopId, participant.participantId);
    if (existing) {
      result.alreadyIssued.push({ ...entry, certificateId: existing.certificateId });
      continue;
    }

    const cert = await issueCertificate(workshopId, participant);
    if (cert) result.generated.push({ ...entry, certificateId: cert.certificateId });
  }
  return result;
}

export async function listForWorkshop(workshopId, user) {
  await getManageableWorkshop(workshopId, user);
  return (await certificateRepository.listForWorkshop(workshopId)).map(present);
}

export async function myCertificates(user) {
  return (await certificateRepository.listForParticipant(user.id)).map(present);
}

async function getAccessibleCertificate(certificateId, user) {
  const normalized = String(certificateId).trim().toUpperCase();
  const cert = CERTIFICATE_ID_RE.test(normalized) ? await certificateRepository.findByCertificateId(normalized) : null;
  if (!cert) throw notFound('Certificate not found');
  if (cert.participantId !== user.id && !canManage(cert, user)) {
    throw forbidden('You can only view your own certificates');
  }
  return cert;
}

export async function getCertificate(certificateId, user) {
  return present(await getAccessibleCertificate(certificateId, user));
}

export async function getCertificateFile(certificateId, user) {
  const cert = await getAccessibleCertificate(certificateId, user);
  return { path: await ensureCertificatePdf(pdfData(cert)), filename: `${cert.certificateId}.pdf` };
}

// Public. Only returns what is printed on the certificate itself.
// If the QR token is supplied it must match, otherwise the certificate is
// reported as invalid (protects against altered QR codes).
export async function verifyCertificate(certificateId, token) {
  const normalized = String(certificateId).trim().toUpperCase();
  const cert = CERTIFICATE_ID_RE.test(normalized) ? await certificateRepository.findByCertificateId(normalized) : null;

  if (!cert) return { valid: false, certificateId: normalized, reason: 'No certificate exists with this ID' };
  if (token && !safeEqual(token, cert.verificationToken)) {
    return { valid: false, certificateId: normalized, reason: 'The verification token does not match this certificate' };
  }

  return {
    valid: true,
    certificateId: cert.certificateId,
    participantName: cert.participantName,
    workshopTitle: cert.workshopTitle,
    workshopStartDate: cert.startDate,
    workshopEndDate: cert.endDate,
    organizerName: cert.organizerName,
    attendancePercentage: cert.attendancePercentage,
    issuedAt: cert.issuedAt,
    tokenVerified: Boolean(token),
  };
}
