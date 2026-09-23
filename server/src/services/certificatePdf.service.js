import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// Files
//   server/assets/certificates/template.pdf  CICT template (optional)
//   server/assets/fonts/name.ttf             font for the participant name (optional)
//   server/assets/fonts/body.ttf             font for all other text (optional)
//   server/storage/certificates/<id>.pdf     generated certificates (git-ignored)
// Without a template a built-in design is drawn; without fonts, standard PDF
// fonts are used.
// ---------------------------------------------------------------------------
const SERVER_DIR = fileURLToPath(new URL('../../', import.meta.url));
const TEMPLATE_PATH = `${SERVER_DIR}assets/certificates/template.pdf`;
const NAME_FONT_PATH = `${SERVER_DIR}assets/fonts/name.ttf`;
const BODY_FONT_PATH = `${SERVER_DIR}assets/fonts/body.ttf`;
export const STORAGE_DIR = `${SERVER_DIR}storage/certificates`;

// ---------------------------------------------------------------------------
// Where the dynamic values go. x and y are fractions of the page width/height,
// measured from the bottom-left corner. When the real CICT template arrives,
// adjust these numbers to match its blank spaces.
// ---------------------------------------------------------------------------
const LAYOUT = {
  participantName: { x: 0.5, y: 0.535, size: 34, maxWidth: 0.8, align: 'center', font: 'name' },
  workshopTitle: { x: 0.5, y: 0.415, size: 18, maxWidth: 0.78, align: 'center', font: 'bodyBold' },
  dates: { x: 0.5, y: 0.365, size: 12, maxWidth: 0.8, align: 'center', font: 'body' },
  attendance: { x: 0.5, y: 0.325, size: 12, maxWidth: 0.8, align: 'center', font: 'body' },
  organizerName: { x: 0.5, y: 0.2, size: 12, maxWidth: 0.4, align: 'center', font: 'bodyBold' },
  certificateId: { x: 0.075, y: 0.105, size: 10, maxWidth: 0.5, align: 'left', font: 'body' },
  issuedOn: { x: 0.075, y: 0.08, size: 10, maxWidth: 0.5, align: 'left', font: 'body' },
  qr: { x: 0.925, y: 0.075, size: 0.15, align: 'right' }, // size: fraction of page height
  qrCaption: { size: 7 },
};

const INK = rgb(0.12, 0.13, 0.2);
const ACCENT = rgb(0.23, 0.26, 0.62);
const MUTED = rgb(0.4, 0.42, 0.5);

const fileExists = (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

const formatDate = (value) =>
  new Date(typeof value === 'string' && value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString(
    'en-GB',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
  );

async function loadFonts(pdf) {
  pdf.registerFontkit(fontkit);
  const custom = async (path) => (await fileExists(path)) ? pdf.embedFont(await readFile(path), { subset: true }) : null;

  const bodyCustom = await custom(BODY_FONT_PATH);
  const fonts = {
    body: bodyCustom || (await pdf.embedFont(StandardFonts.Helvetica)),
    bodyBold: bodyCustom || (await pdf.embedFont(StandardFonts.HelveticaBold)),
    name: (await custom(NAME_FONT_PATH)) || (await pdf.embedFont(StandardFonts.TimesRomanBoldItalic)),
    serif: await pdf.embedFont(StandardFonts.TimesRomanBold),
  };
  return fonts;
}

// Standard PDF fonts only cover Latin-1; strip what they cannot encode instead
// of crashing (custom TTF fonts can render anything they contain).
function encodable(font, text) {
  try {
    font.encodeText(text);
    return text;
  } catch {
    const cleaned = text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
    return cleaned.trim() || '-';
  }
}

function drawText(page, fonts, text, spec, color = INK) {
  const { width, height } = page.getSize();
  const font = fonts[spec.font];
  const safe = encodable(font, String(text));

  // Shrink long text until it fits the allowed width.
  let size = spec.size;
  const maxWidth = spec.maxWidth * width;
  while (size > 8 && font.widthOfTextAtSize(safe, size) > maxWidth) size -= 0.5;

  const textWidth = font.widthOfTextAtSize(safe, size);
  let x = spec.x * width;
  if (spec.align === 'center') x -= textWidth / 2;
  if (spec.align === 'right') x -= textWidth;

  page.drawText(safe, { x, y: spec.y * height, size, font, color });
}

// Built-in design used until the real CICT template is added.
function drawDefaultBackground(page, fonts) {
  const { width, height } = page.getSize();
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(0.99, 0.98, 0.95) });
  page.drawRectangle({ x: 18, y: 18, width: width - 36, height: height - 36, borderColor: ACCENT, borderWidth: 3 });
  page.drawRectangle({ x: 26, y: 26, width: width - 52, height: height - 52, borderColor: ACCENT, borderWidth: 0.75 });

  const center = (text, y, size, font, color) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y: y * height, size, font, color });
  };

  center('CICT  |  WORKSHOP & LEARNING PORTAL', 0.87, 11, fonts.bodyBold, MUTED);
  center('CERTIFICATE OF COMPLETION', 0.76, 30, fonts.serif, ACCENT);
  center('This is to certify that', 0.645, 13, fonts.body, MUTED);
  page.drawLine({
    start: { x: width * 0.22, y: height * 0.515 },
    end: { x: width * 0.78, y: height * 0.515 },
    thickness: 0.75,
    color: MUTED,
  });
  center('has successfully completed the workshop', 0.465, 13, fonts.body, MUTED);

  page.drawLine({
    start: { x: width * 0.38, y: height * 0.185 },
    end: { x: width * 0.62, y: height * 0.185 },
    thickness: 0.75,
    color: MUTED,
  });
  center('Workshop Coordinator', 0.155, 10, fonts.body, MUTED);
}

// data: { certificateId, participantName, workshopTitle, startDate, endDate,
//         attendancePercentage, organizerName, issuedAt, verificationUrl }
export async function generateCertificatePdf(data) {
  const hasTemplate = await fileExists(TEMPLATE_PATH);
  const pdf = hasTemplate ? await PDFDocument.load(await readFile(TEMPLATE_PATH)) : await PDFDocument.create();
  const fonts = await loadFonts(pdf);

  const page = hasTemplate ? pdf.getPage(0) : pdf.addPage([841.89, 595.28]); // A4 landscape
  if (!hasTemplate) drawDefaultBackground(page, fonts);

  const dates =
    data.startDate === data.endDate
      ? `held on ${formatDate(data.startDate)}`
      : `held from ${formatDate(data.startDate)} to ${formatDate(data.endDate)}`;

  drawText(page, fonts, data.participantName, LAYOUT.participantName);
  drawText(page, fonts, data.workshopTitle, LAYOUT.workshopTitle, ACCENT);
  drawText(page, fonts, dates, LAYOUT.dates, MUTED);
  drawText(page, fonts, `with an attendance of ${data.attendancePercentage}%`, LAYOUT.attendance, MUTED);
  if (data.organizerName) drawText(page, fonts, data.organizerName, LAYOUT.organizerName);
  drawText(page, fonts, `Certificate ID: ${data.certificateId}`, LAYOUT.certificateId, MUTED);
  drawText(page, fonts, `Issued on: ${formatDate(data.issuedAt)}`, LAYOUT.issuedOn, MUTED);

  // Verification QR
  const { width, height } = page.getSize();
  const qrSize = LAYOUT.qr.size * height;
  const qrPng = await QRCode.toBuffer(data.verificationUrl, { type: 'png', margin: 1, width: 300 });
  const qrImage = await pdf.embedPng(qrPng);
  const qrX = LAYOUT.qr.x * width - qrSize;
  const qrY = LAYOUT.qr.y * height;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

  const caption = 'Scan to verify';
  const captionWidth = fonts.body.widthOfTextAtSize(caption, LAYOUT.qrCaption.size);
  page.drawText(caption, {
    x: qrX + (qrSize - captionWidth) / 2,
    y: qrY - LAYOUT.qrCaption.size - 3,
    size: LAYOUT.qrCaption.size,
    font: fonts.body,
    color: MUTED,
  });

  pdf.setTitle(`Certificate ${data.certificateId}`);
  pdf.setSubject(data.workshopTitle);
  pdf.setCreator('CICT Workshop Portal');
  return pdf.save();
}

export const certificatePath = (certificateId) => `${STORAGE_DIR}/${certificateId}.pdf`;

export async function saveCertificatePdf(certificateId, bytes) {
  await mkdir(STORAGE_DIR, { recursive: true });
  const path = certificatePath(certificateId);
  await writeFile(path, bytes);
  return path;
}

// Returns the PDF path, regenerating the file from `data` if it is missing.
export async function ensureCertificatePdf(data) {
  const path = certificatePath(data.certificateId);
  if (await fileExists(path)) return path;
  return saveCertificatePdf(data.certificateId, await generateCertificatePdf(data));
}
