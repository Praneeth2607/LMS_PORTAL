# Certificate fonts (optional)

| File       | Used for                    | Fallback                 |
| ---------- | --------------------------- | ------------------------ |
| `name.ttf` | Participant name            | Times Roman Bold Italic  |
| `body.ttf` | All other certificate text  | Helvetica                |

Any TrueType font works (embedded with `@pdf-lib/fontkit`). Use a font with the right character set
if participant names include non-Latin characters; the fallback fonts only cover Latin-1.
Check the font licence allows embedding (Google Fonts are fine).
