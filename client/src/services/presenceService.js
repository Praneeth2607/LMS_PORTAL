import { api } from './api.js';

// Live room inside the portal (Daily.co): { roomUrl, token, isOwner, session, presence }
export const joinLiveSession = (sessionId) => api.post(`/sessions/${sessionId}/video/join`);
// Proof of active presence (participants). The server decides how much time counts.
export const sendHeartbeat = (sessionId) => api.post(`/sessions/${sessionId}/heartbeat`);
export const getPresence = (sessionId) => api.get(`/sessions/${sessionId}/presence`);
// Organizer/admin: everyone's verified watch time for the session.
export const listSessionPresence = (sessionId) => api.get(`/sessions/${sessionId}/presence/participants`);
