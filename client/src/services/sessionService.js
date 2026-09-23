import { api } from './api.js';

export const listSessions = (workshopId) => api.get(`/workshops/${workshopId}/sessions`);
export const getSession = (id) => api.get(`/sessions/${id}`);
export const createSession = (workshopId, data) => api.post(`/workshops/${workshopId}/sessions`, data);
export const updateSession = (id, data) => api.put(`/sessions/${id}`, data);
export const deleteSession = (id) => api.delete(`/sessions/${id}`);
// Organizer marks the session ONGOING (allowed from its start time until its end).
export const startSession = (id) => api.post(`/sessions/${id}/start`);
