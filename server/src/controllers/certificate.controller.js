import * as certificateService from '../services/certificate.service.js';
import { parseId } from '../validators/validate.js';
import { sendSuccess } from '../utils/response.js';

export async function generate(req, res) {
  const result = await certificateService.generateForWorkshop(parseId(req.params.id), req.user);
  sendSuccess(
    res,
    result,
    `${result.generated.length} certificate(s) generated, ${result.alreadyIssued.length} already issued, ${result.notEligible.length} not eligible`,
  );
}

export async function listForWorkshop(req, res) {
  sendSuccess(res, await certificateService.listForWorkshop(parseId(req.params.id), req.user));
}

export async function mine(req, res) {
  sendSuccess(res, await certificateService.myCertificates(req.user));
}

export async function get(req, res) {
  sendSuccess(res, await certificateService.getCertificate(req.params.id, req.user));
}

export async function download(req, res) {
  const { path, filename } = await certificateService.getCertificateFile(req.params.id, req.user);
  const disposition = req.query.inline === 'true' ? 'inline' : 'attachment';
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
  res.sendFile(path);
}

export async function verify(req, res) {
  const token = typeof req.query.token === 'string' ? req.query.token : undefined;
  sendSuccess(res, await certificateService.verifyCertificate(req.params.certificateId, token));
}
