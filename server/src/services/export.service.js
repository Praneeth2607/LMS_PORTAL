// Excel (.xlsx) exports:
//   - admin: participants and organizers lists (analytics is a PDF: analyticsReport.service.js)
//   - organizer/admin: a workshop's participants (with form answers and attendance)
// Values are written as plain cells (never formulas), so text that starts with
// "=" from a registration form can't turn into a formula in Excel.
import ExcelJS from 'exceljs';
import env from '../config/env.js';
import * as exportRepository from '../repositories/export.repository.js';
import * as registrationRepository from '../repositories/registration.repository.js';
import * as workshopRepository from '../repositories/workshop.repository.js';
import * as sessionRepository from '../repositories/session.repository.js';
import * as attendanceRepository from '../repositories/attendance.repository.js';
import * as certificateRepository from '../repositories/certificate.repository.js';
import { getWorkshopSummary } from './attendance.service.js';
import { getManageableWorkshop } from './workshop.service.js';
import { badRequest } from '../utils/httpError.js';

const INK = 'FF141413';
const HEADER_FILL = 'FFF3F0EE';

// Adds a sheet with a bold header row, sensible widths, a frozen header and filters.
// columns: [{ header, key, width?, format? }] ; format: 'date' | 'datetime' | 'percent' | 'decimal'
function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  const FORMATS = { date: 'dd mmm yyyy', datetime: 'dd mmm yyyy hh:mm', percent: '0.0"%"', decimal: '0.00' };
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || Math.min(48, Math.max(12, c.header.length + 4)),
    ...(c.format && { style: { numFmt: FORMATS[c.format] } }),
  }));
  rows.forEach((row) => sheet.addRow(row));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: INK } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  header.alignment = { vertical: 'middle', wrapText: true };
  header.height = 22;
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return sheet;
}

const toDate = (value) => (value ? new Date(value) : null);
// DATE columns come back as 'YYYY-MM-DD'; keep them as calendar dates in Excel.
const dayDate = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T00:00:00Z`) : null);
const yesNo = (v) => (v ? 'Yes' : 'No');
const stamp = () => new Date().toISOString().slice(0, 10);
// File-name friendly workshop title, cut at a word boundary (~40 characters).
function slug(text) {
  let s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (s.length > 40) s = s.slice(0, 41).replace(/-[^-]*$/, '');
  return s || 'workshop';
}

function newWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CICT Workshops · Aurex’26';
  workbook.created = new Date();
  return workbook;
}

const toBuffer = async (workbook) => Buffer.from(await workbook.xlsx.writeBuffer());

// ---------------------------------------------------------------- admin: people
export async function peopleWorkbook(role) {
  if (role && !['PARTICIPANT', 'ORGANIZER'].includes(role)) throw badRequest('role must be PARTICIPANT or ORGANIZER');
  const workbook = newWorkbook();
  const status = (u) => (u.suspendedAt ? 'Suspended' : 'Active');

  if (!role || role === 'PARTICIPANT') {
    const rows = await exportRepository.participantsOverview();
    addSheet(
      workbook,
      'Participants',
      [
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Email', key: 'email', width: 32 },
        { header: 'Status', key: 'status', width: 11 },
        { header: 'Joined', key: 'joined', format: 'date', width: 14 },
        { header: 'Registered workshops', key: 'registeredWorkshops', width: 14 },
        { header: 'Cancelled registrations', key: 'cancelledRegistrations', width: 14 },
        { header: 'Workshops attended', key: 'workshopsAttended', width: 14 },
        { header: 'Sessions attended', key: 'sessionsAttended', width: 14 },
        { header: 'Certificates', key: 'certificates', width: 12 },
        { header: 'Feedback given', key: 'feedbackGiven', width: 12 },
      ],
      rows.map((u) => ({ ...u, status: status(u), joined: toDate(u.createdAt) })),
    );
  }
  if (!role || role === 'ORGANIZER') {
    const rows = await exportRepository.organizersOverview();
    addSheet(
      workbook,
      'Organizers',
      [
        { header: 'Name', key: 'name', width: 26 },
        { header: 'Email', key: 'email', width: 32 },
        { header: 'Role', key: 'role', width: 12 },
        { header: 'Status', key: 'status', width: 11 },
        { header: 'Joined', key: 'joined', format: 'date', width: 14 },
        { header: 'Published workshops', key: 'published', width: 14 },
        { header: 'Closed workshops', key: 'closed', width: 12 },
        { header: 'Draft workshops', key: 'drafts', width: 12 },
        { header: 'Sessions held', key: 'sessionsHeld', width: 12 },
        { header: 'Registrations', key: 'registrations', width: 14 },
        { header: 'Certificates issued', key: 'certificates', width: 14 },
        { header: 'Avg. feedback (1–5)', key: 'feedbackAverage', format: 'decimal', width: 16 },
      ],
      rows.map((u) => ({ ...u, role: u.role === 'ADMIN' ? 'Admin' : 'Organizer', status: status(u), joined: toDate(u.createdAt) })),
    );
  }
  const name = role === 'PARTICIPANT' ? 'participants' : role === 'ORGANIZER' ? 'organizers' : 'people';
  return { buffer: await toBuffer(workbook), filename: `cict-${name}-${stamp()}.xlsx` };
}

// ---------------------------------------------------------------- organizer/admin: one workshop
export async function workshopParticipantsWorkbook(workshopId, user) {
  const workshop = await getManageableWorkshop(workshopId, user);
  const [registrations, fields, summary, sessions, attendance, certificates] = await Promise.all([
    registrationRepository.listByWorkshop(workshopId),
    workshopRepository.findFields(workshopId),
    getWorkshopSummary(workshopId),
    sessionRepository.listByWorkshop(workshopId),
    attendanceRepository.listForWorkshop(workshopId),
    certificateRepository.listForWorkshop(workshopId),
  ]);
  const summaryBy = new Map(summary.map((s) => [s.participantId, s]));
  const certBy = new Map(certificates.map((c) => [c.participantId, c]));

  // One column per registration question (current fields first, then answers to
  // questions that were removed later, so nothing a participant entered is lost).
  const questionNames = [...fields.map((f) => f.fieldName)];
  for (const r of registrations) {
    for (const key of Object.keys(r.formData || {})) if (!questionNames.includes(key)) questionNames.push(key);
  }
  const answer = (value) => (typeof value === 'boolean' ? yesNo(value) : value === null || value === undefined ? '' : String(value));

  const workbook = newWorkbook();
  addSheet(
    workbook,
    'Participants',
    [
      { header: 'Name', key: 'name', width: 26 },
      { header: 'Email', key: 'email', width: 32 },
      { header: 'Registration', key: 'status', width: 14 },
      { header: 'Registered at', key: 'registeredAt', format: 'datetime', width: 20 },
      ...questionNames.map((q, i) => ({ header: q, key: `q${i}`, width: Math.min(40, Math.max(14, q.length + 4)) })),
      { header: 'Sessions attended', key: 'attended', width: 12 },
      { header: 'Completed sessions', key: 'completed', width: 12 },
      { header: 'Attendance %', key: 'percentage', format: 'percent', width: 13 },
      { header: 'Certificate eligible', key: 'eligible', width: 12 },
      { header: 'Certificate ID', key: 'certificateId', width: 20 },
      { header: 'Certificate issued', key: 'issuedAt', format: 'date', width: 16 },
    ],
    registrations.map((r) => {
      const s = summaryBy.get(r.participantId);
      const c = certBy.get(r.participantId);
      const row = {
        name: r.participantName,
        email: r.participantEmail,
        status: r.status === 'REGISTERED' ? 'Registered' : 'Cancelled',
        registeredAt: toDate(r.registeredAt),
        attended: s?.attendedSessions ?? null,
        completed: s?.completedSessions ?? null,
        percentage: s ? s.percentage : null,
        eligible: s ? yesNo(s.eligible) : '',
        certificateId: c?.certificateId || '',
        issuedAt: toDate(c?.issuedAt),
      };
      questionNames.forEach((q, i) => {
        row[`q${i}`] = answer(r.formData?.[q]);
      });
      return row;
    }),
  );

  // Attendance grid: one row per registered participant, one column per session.
  const mark = new Map(attendance.map((a) => [`${a.sessionId}:${a.participantId}`, a.status]));
  const registered = registrations.filter((r) => r.status === 'REGISTERED');
  addSheet(
    workbook,
    'Attendance by session',
    [
      { header: 'Name', key: 'name', width: 26 },
      { header: 'Email', key: 'email', width: 32 },
      ...sessions.map((s, i) => ({ header: `${i + 1}. ${s.title} (${s.sessionDate})`, key: `s${s.id}`, width: 18 })),
    ],
    registered.map((r) => {
      const row = { name: r.participantName, email: r.participantEmail };
      for (const s of sessions) {
        const status = mark.get(`${s.id}:${r.participantId}`);
        row[`s${s.id}`] = status === 'PRESENT' ? 'Present' : status === 'ABSENT' ? 'Absent' : s.status === 'COMPLETED' ? 'Not marked' : '';
      }
      return row;
    }),
  );

  return { buffer: await toBuffer(workbook), filename: `${slug(workshop.title)}-participants-${stamp()}.xlsx` };
}

// Sends a workbook as a download.
export function sendWorkbook(res, { buffer, filename }) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}
