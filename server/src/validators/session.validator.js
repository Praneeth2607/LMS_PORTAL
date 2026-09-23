import { validate } from './validate.js';

const sessionSchema = {
  title: { type: 'string', required: true, label: 'Title', max: 200 },
  sessionDate: { type: 'date', required: true, label: 'Session date' },
  startTime: { type: 'time', required: true, label: 'Start time' },
  endTime: { type: 'time', required: true, label: 'End time' },
  meetingLink: { type: 'url', label: 'Meeting link' },
};

export const validateCreateSession = (body) => validate(body, sessionSchema);
export const validateUpdateSession = (body) => validate(body, sessionSchema, { partial: true });

export const validateStartAttendance = (body) =>
  validate(body, {
    durationMinutes: { type: 'int', label: 'Duration (minutes)', min: 1, max: 240 },
  });

export const validateMarkAttendance = (body) =>
  validate(body, {
    token: { type: 'string', label: 'Token', max: 100 },
    code: { type: 'string', label: 'Code', max: 20 },
  });

export const validateManualAttendance = (body) =>
  validate(body, {
    participantId: { type: 'int', required: true, label: 'Participant', min: 1 },
    status: { type: 'enum', required: true, label: 'Status', values: ['PRESENT', 'ABSENT'] },
  });
