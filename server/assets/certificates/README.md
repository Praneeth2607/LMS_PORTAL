# Certificate template

Drop the official CICT certificate here as **`template.pdf`** (first page is used).

Until then, a built-in design is generated automatically.

The template should contain only the static artwork and text. The server writes these values on top:
participant name, workshop title, dates, attendance %, organizer name, certificate ID, issue date and
the verification QR code.

To line them up with the blank spaces in the template, edit the `LAYOUT` object in
`server/src/services/certificatePdf.service.js`. Positions are fractions of the page size, measured from
the bottom-left corner.

After changing the template or layout, delete `server/storage/certificates/*.pdf`. Downloads regenerate
missing files from the database.
