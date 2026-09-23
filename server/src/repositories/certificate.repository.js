import { query } from '../db/pool.js';
import { camelize, camelizeRows } from '../utils/case.js';

// Everything needed to render, show or verify a certificate.
const SELECT_CERTIFICATE = `
  SELECT c.id, c.certificate_id, c.participant_id, c.workshop_id, c.attendance_percentage,
         c.verification_token, c.issued_at,
         p.name AS participant_name, p.email AS participant_email,
         w.title AS workshop_title, w.start_date, w.end_date, w.mode, w.created_by,
         o.name AS organizer_name
  FROM certificates c
  JOIN users p     ON p.id = c.participant_id
  JOIN workshops w ON w.id = c.workshop_id
  JOIN users o     ON o.id = w.created_by`;

export async function findByCertificateId(certificateId) {
  const { rows } = await query(`${SELECT_CERTIFICATE} WHERE c.certificate_id = $1`, [certificateId]);
  return camelize(rows[0]);
}

export async function findByWorkshopAndParticipant(workshopId, participantId) {
  const { rows } = await query(
    `${SELECT_CERTIFICATE} WHERE c.workshop_id = $1 AND c.participant_id = $2`,
    [workshopId, participantId],
  );
  return camelize(rows[0]);
}

export async function listForParticipant(participantId) {
  const { rows } = await query(`${SELECT_CERTIFICATE} WHERE c.participant_id = $1 ORDER BY c.issued_at DESC`, [
    participantId,
  ]);
  return camelizeRows(rows);
}

export async function listForWorkshop(workshopId) {
  const { rows } = await query(`${SELECT_CERTIFICATE} WHERE c.workshop_id = $1 ORDER BY p.name`, [workshopId]);
  return camelizeRows(rows);
}

// Returns null if this participant already has a certificate for the workshop.
export async function create({ certificateId, participantId, workshopId, attendancePercentage, verificationToken }) {
  const { rows } = await query(
    `INSERT INTO certificates (certificate_id, participant_id, workshop_id, attendance_percentage, verification_token)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (workshop_id, participant_id) DO NOTHING
     RETURNING id`,
    [certificateId, participantId, workshopId, attendancePercentage, verificationToken],
  );
  return rows[0] ? findByCertificateId(certificateId) : null;
}

export async function removeByCertificateId(certificateId) {
  await query('DELETE FROM certificates WHERE certificate_id = $1', [certificateId]);
}
