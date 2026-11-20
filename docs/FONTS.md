# Fonts and portable rendering

Fonts belong to each production, not to the MOTION npm runtime. This keeps tarballs small and lets a
project ship only the typefaces its approved art direction uses.

## Project policy

1. Prefer a libre family with a license that allows the intended use and redistribution, such as
   a family released under the SIL Open Font License. Read the exact license attached to the files.
2. Record family, file path, origin, exact license name and URL, and redistribution permission in
   `delivery.contract.json` under `fonts`.
3. Store an authorized font in the project (typically `public/fonts/` or `site/assets/`) and use a
   relative `@font-face` URL. Include the font and its required license/copyright notices in the
   delivery contract and ZIP.
4. Pin the actual file with the delivery manifest SHA-256. Do not rely on fonts installed only on
   the author's workstation or on a network font service for final renders.
5. Render with that same file in previews and final export. Keep family name, weight, style and
   variable-font axes explicit so another machine uses the same metrics.
6. `motion export` checks local `@font-face` paths and contract provenance before packaging. A
   missing or undeclared font fails delivery. Runtime rendering also reports font load failures.

Ubuntu Sans is one suitable example for a project that chooses it: Canonical publishes the Ubuntu
font family under an open license and provides the official font license page. Verify and include
the exact license text with the copied font. The Ubuntu typeface's name does not transfer Ubuntu
trademark rights. [Ubuntu font page](https://design.ubuntu.com/font) · [Ubuntu Font Licence](https://ubuntu.com/legal/font-licence).

MOTION does not bundle fonts in its npm packages. This avoids unrelated package growth and avoids
redistributing typefaces without project-specific authorization.
