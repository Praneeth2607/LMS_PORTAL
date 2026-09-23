import { api, request, requestBlob, toQuery } from './api.js';

// Returns the full envelope so the backend's summary message can be shown.
export const generateCertificates = (workshopId) =>
  request(`/workshops/${workshopId}/certificates/generate`, { method: 'POST' });
export const listWorkshopCertificates = (workshopId) => api.get(`/workshops/${workshopId}/certificates`);
export const myCertificates = () => api.get('/my-certificates');
export const getCertificate = (certificateId) => api.get(`/certificates/${encodeURIComponent(certificateId)}`);
export const verifyCertificate = (certificateId, token) =>
  api.get(`/certificates/verify/${encodeURIComponent(certificateId)}${toQuery({ token })}`);

// The download endpoint needs the Authorization header, so fetch it as a blob.
export async function downloadCertificate(certificateId) {
  const blob = await requestBlob(`/certificates/${encodeURIComponent(certificateId)}/download`);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${certificateId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Opens the PDF in a new tab. The tab is opened synchronously (before the
// await) so popup blockers allow it.
export async function previewCertificate(certificateId) {
  const tab = window.open('', '_blank');
  try {
    const blob = await requestBlob(`/certificates/${encodeURIComponent(certificateId)}/download?inline=true`);
    const url = URL.createObjectURL(blob);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (err) {
    tab?.close();
    throw err;
  }
}

// verificationUrl points at FRONTEND_URL/verify/:id?token=...; keep only the
// path so it works on whatever host the app is served from.
export function verificationPath(certificate) {
  try {
    const url = new URL(certificate.verificationUrl);
    return `${url.pathname}${url.search}`;
  } catch {
    return `/verify/${certificate.certificateId}`;
  }
}
