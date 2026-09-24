import { api } from './api.js';

// Participant: the form for one session, and submitting it.
export const getSessionFeedback = (sessionId) => api.get(`/sessions/${sessionId}/feedback`);
export const submitSessionFeedback = (sessionId, data) => api.post(`/sessions/${sessionId}/feedback`, data);
export const listPendingFeedback = () => api.get('/my-feedback/pending');

// Organizer/admin: questions and aggregated results for a workshop.
export const getWorkshopFeedback = (workshopId) => api.get(`/workshops/${workshopId}/feedback`);
export const getFeedbackQuestions = (workshopId) => api.get(`/workshops/${workshopId}/feedback/questions`);
export const saveFeedbackQuestions = (workshopId, questions) =>
  api.put(`/workshops/${workshopId}/feedback/questions`, { questions });
