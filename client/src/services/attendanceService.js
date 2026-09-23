import { api } from './api.js';

export const startAttendance = (sessionId, durationMinutes) =>
  api.post(`/sessions/${sessionId}/attendance/start`, durationMinutes ? { durationMinutes } : {});
export const stopAttendance = (sessionId) => api.post(`/sessions/${sessionId}/attendance/stop`);
// payload: { token } from the QR URL, or { code } typed by the participant
export const markAttendance = (sessionId, payload) => api.post(`/sessions/${sessionId}/attendance/mark`, payload);
export const setManualAttendance = (sessionId, participantId, status) =>
  api.post(`/sessions/${sessionId}/attendance/manual`, { participantId, status });
export const getAttendanceGrid = (workshopId) => api.get(`/workshops/${workshopId}/attendance`);
export const getAttendanceSummary = (workshopId) => api.get(`/workshops/${workshopId}/attendance/summary`);
