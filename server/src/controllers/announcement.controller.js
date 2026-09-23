import * as announcementService from '../services/announcement.service.js';
import { parseId, validate } from '../validators/validate.js';
import { sendCreated, sendSuccess } from '../utils/response.js';

const validateAnnouncement = (body) =>
  validate(body, {
    title: { type: 'string', required: true, label: 'Title', max: 200 },
    message: { type: 'string', required: true, label: 'Message', max: 5000 },
  });

export async function list(req, res) {
  sendSuccess(res, await announcementService.listAnnouncements(parseId(req.params.id), req.user));
}

export async function create(req, res) {
  const announcement = await announcementService.createAnnouncement(
    parseId(req.params.id),
    validateAnnouncement(req.body),
    req.user,
  );
  sendCreated(res, announcement, 'Announcement posted');
}
