# MOTION Studio — Repository Size Audit (Mission 19.1)

Audit date: 2026-11-16
Branch: `main`
Audited commit: `ab723122b8ba20c285f265e4ea55ed7a7c48b06f` (`origin/main` at audit time)

## Executive summary

The largest safe cleanup found is the pair of generated frame directories for `projects/carga-01`. Their 1,200 PNG frames occupy **544.81 MiB** in the current tree and account for **543.91 MiB** of packed Git blob data. I staged removal of those PNG paths from the Git index and added a narrow ignore rule. The PNGs remain on disk; both contact-sheet HTML files, source compositions, manifests, final MP4s, and published-site copies remain tracked.

After a commit, a fresh checkout is projected to contain **831.53 MiB** of tracked file content, down from **1,376.34 MiB** (a reduction of 544.81 MiB / 39.58%). The Git pack will remain about **828.48 MiB** because an ordinary commit does not remove objects reachable from earlier commits. Therefore the checkout and local clone footprint improve, while clone transfer size and GitHub historical storage do not materially improve until a separately authorized history rewrite.

No local content files were deleted. No commit, push, deploy, npm publish, or history rewrite was performed.

## 1. Inventory and measurements

The inventory included hidden paths. Before the cleanup was staged, `git ls-files` returned **12,343 paths**. `git ls-tree -r -l HEAD` measured **1,443,195,176 bytes (1,376.34 MiB)** at the audited commit. The local repository is aligned with `origin/main` at that commit; no fetch was performed during this audit.

| Measure | Before | Projected after a normal cleanup commit |
|---|---:|---:|
| Tracked paths in current `HEAD` | 12,343 | 11,143 |
| Tracked content in tree | 1,376.34 MiB | 831.53 MiB |
| Tree reduction | — | 544.81 MiB / 39.58% |
| `.git` on disk | 831 MiB | About 831 MiB until history is rewritten and repacked |
| `git count-objects -vH` pack | 5,416 packed objects; 1 pack; 828.48 MiB | About 828.48 MiB; old frame blobs remain reachable |
| Loose / prune-packable / garbage objects | 0 / 0 / 0 | No meaningful `git gc` reduction expected |
| Clean-clone pack stream measured with `git pack-objects` | 868,576,071 bytes / 828.48 MiB | About the same |
| Checkout plus Git pack, excluding `node_modules` | About 2,204.82 MiB / 2.15 GiB | About 1,660.01 MiB / 1.62 GiB on disk |

The current working tree uses about **1.5 GiB** excluding `.git` and `node_modules`; `.git` is a separate **831 MiB**. These on-disk figures include the locally retained PNGs and do not shrink until a user removes local generated files themselves. The clean-clone total is an estimate from the measured pack stream plus the byte total of `HEAD`; a second physical clone was not created. The clean-clone projection describes the result after checkout of the cleaned tree, while the pack estimate describes objects still needed from history. Actual disk allocation can vary slightly with Git version and filesystem block/index overhead.

`tree --dirsfirst -L 2 -I 'node_modules|.git'` showed the main areas: `creative-core`, `packages`, `projects`, `docs`, `dist`, `scripts`, `tests`, and production/evidence directories. Disk use by selected top-level directories (excluding `.git` and `node_modules`) was: `.agents` 201 MiB, `.claude` 28 MiB, `.opencode` 28 MiB, `packages` 201 MiB, `projects` 970 MiB, `dist` 27 MiB, `creative-core` 200 KiB, and `docs` 908 KiB.

### Large tracked paths

There are 16 tracked path entries above 5 MiB, totaling approximately **255.11 MiB** as paths. Several are byte-identical skill distribution copies, so these path totals must not be confused with unique Git object storage.

| Size | Path group / disposition |
|---:|---|
| 29.98 MiB × 3 | `revenue-centric-design` sample MP4 in `.agents`, `packages/motion-skills`, and `projects/carga-01/.agents`; retain while the packaged skill uses it and rights are confirmed |
| 20.35 MiB × 5 | `impeccable` Linux executable in `.agents`, `.claude`, `.opencode`, package source, and Carga skill copy; retain pending provenance/runtime and distribution review |
| 8.81 MiB × 3 | `video-shotcraft` BGM in `.agents`, package source, and Carga copy; retain pending asset license review |
| 8.72 MiB × 2 | `carga-01-16x9.mp4` in project output and the landing site; retain, including the public-site path |
| 6.85 MiB × 2 | `carga-01-9x16.mp4` in project output and the landing site; retain, including the public-site path |
| 5.83 MiB | `projects/motion-landing/entrega-v1.zip`; retain as an existing delivery artifact |

Other tracked binary types include PNG, JPEG, WebP, MP4, ZIP, PDF, GLB, and executable files. No binary was removed in this pass. Any future move of a delivery artifact to Releases/object storage needs a URL and consumer plan first.

### Directory classification

| Class | Examples | Decision |
|---|---|---|
| Essential source | `creative-core/`, `packages/`, `scripts/`, `tests/`, `src/`, composition HTML/JSON, project readmes | Preserve |
| Essential assets | Fonts, textures, models, images, audio and assets used by Skills or compositions | Preserve pending explicit dependency/license audit |
| npm distribution | `packages/motion-core`, `packages/motion-cli`, `packages/motion-skills` and their manifests | Preserve; verified by packing and isolated consumer installation |
| Demo / production artifacts | `projects/*`, gallery examples, approved videos | Preserve unless individually proven regenerable and not externally referenced |
| Regenerable intermediates | `projects/carga-01/frames-16x9/*.png`, `frames-9x16/*.png` | Remove from index only; retain local copies |
| Duplicate paths | Installed Skill adapters and repeated media | Preserve where required for agent compatibility or packaging; Git already deduplicates identical blobs |
| Legacy binaries / archives | ZIPs, sample media, PDFs, executables | Do not bulk-delete; review provenance, references, and license one artifact at a time |
| QA evidence | Contact sheets, reports, screenshots, manifests | Preserve; only raw Carga frame PNGs are proposed for index removal |
| Final media | Carga MP4 masters and landing-site video copies | Preserve; these are referenced by project pages and public-site HTML |

## 2. Carga-01 frame cleanup

Each format directory contains **600 PNGs plus one `contact-sheet.html`**. The two sets contain 1,200 PNG files totaling **571,270,753 bytes / 544.81 MiB**. Their 1,200 unique Git blobs occupy **570,326,859 packed bytes / 543.91 MiB**. The Git tree therefore incurs nearly the full uncompressed frame weight.

The project README documents regeneration using `creative-core/renderers/render_frames.mjs` with the checked-in compositions, 600 frames, 30 FPS, and the two target resolutions; it then documents MP4 assembly. This supports removing only generated frame PNGs from version control. The regeneration instructions are at [projects/carga-01/README.md](../../projects/carga-01/README.md#L86).

The existing `assets.manifest.json` and QA records include hashes/references to frame files. They remain unchanged as provenance evidence. A fresh checkout will not have those PNGs until the README render commands are run, so a full manifest verification must regenerate the files first. The two contact sheets also rely on frame images and should be regenerated/previewed after a fresh checkout. Both contact-sheet HTML files remain tracked.

Project and site references were checked. `projects/carga-01/index.html` references the two `out/` MP4 masters, and the landing-site project pages reference `/videos/carga-01/carga-01-16x9.mp4` and `/videos/carga-01/carga-01-9x16.mp4`. All four files exist and remain tracked. No public media URLs were moved or changed.

## 3. Skills audit

`packages/motion-skills/skills` is the npm source of truth: `packages/motion-skills/index.js` reads from it and installs into the root `.agents/skills` location. `.claude/skills` and `.opencode/skills` are compatibility adapters made from symlinks where supported and physical copies where needed. `projects/carga-01/.agents/skills` is a project-local copy for standalone project use.

The audited path counts are 3,263 tracked paths under root `.agents/skills`, 270 each under `.claude/skills` and `.opencode/skills`, 3,263 under package Skills, and 3,262 under the Carga project Skill copy. Identical content is already stored once per Git object ID, even though worktrees and npm tarballs need copies at their respective paths. Removing those paths would break direct agent discovery, fallback compatibility, standalone project use, or package assembly; none were removed.

There is a count discrepancy to resolve separately: the checked-in root `.agents/skills` has **51 `SKILL.md` files**, while its directories/docs and the mission expectation refer to 52 Skills (the package README has also been observed to state 50). This hygiene pass does not add, remove, or relocate a Skill; all existing copies are preserved. Reconcile the canonical catalog and documentation before claiming a 52-Skill public distribution.

## 4. npm packages and consumer files

`npm run pack:all` completed successfully after the ignore/index change. It rebuilt:

| Package | Tarball size | Unpacked size | Files |
|---|---:|---:|---:|
| `motion-core@1.0.0-rc.3` | 55.1 kB | 189.2 kB | 26 |
| `motion-cli@1.0.0-rc.3` | 25.5 kB | 83.4 kB | 14 |
| `motion-studio-skills@1.0.0-rc.3` | 27.2 MB | 47.1 MB | 2,363 |

The package tarballs are generated under `dist/packages/` and ignored. The Skills tarball is large because it includes the Skills and their examples/assets. The current `.npmignore` excludes the large MP4/MP3/WAV/PDF/ZIP and executable `scripts/bin` categories found in the source; the package is not a mirror of the entire monorepo.

The isolated Mission 19 consumer test installed the local tarballs into `/tmp/motion-mission19-consumer-COuTQm`, ran the CLI against packaged Creative Core, and produced both `outputs/component.mp4` and `outputs/overlay.webm`. The test did not use monorepo package paths at runtime. No public npm version was changed.

## 5. Ignore rules and reviewable diff

The new `.gitignore` rules are narrow and target generated locations/extensions:

```diff
+/projects/*/frames-*/*.png
+**/.cache/
+**/.pytest_cache/
+**/.mypy_cache/
+**/.ruff_cache/
+**/.next/
+**/.vite/
+**/coverage/
+*.pyo
+/projects/*/.consumer-install/
```

Existing rules continue to cover `node_modules/`, test temporary files, package tarballs, Python bytecode, Vercel local state, and project ZIP generation. `git check-ignore -v` confirmed the intended frame PNG, future ZIP, consumer installation, and package tarball examples. Source files, compositions, and final Carga MP4 probes were not matched. `git ls-files -ci --exclude-standard` reports zero tracked frame PNGs after staging and zero tracked tarballs; **seven existing ZIPs are still tracked** despite the older ZIP ignore rule, as expected, and were preserved.

The staged deletion is exactly **1,200 PNG paths**, no contact-sheet HTML, MP4, source composition, or manifest. The files remain on disk. The staged diff can be reviewed with `git diff --cached --stat`; `git diff -- .gitignore` shows the small ignore change. To reverse the staged frame removal while retaining local files, restore those paths to the index from `HEAD` (for example, `git restore --staged -- projects/carga-01/frames-16x9 projects/carga-01/frames-9x16`).

## 6. Duplicates, artifacts, and external storage

Across tracked paths, the Git object audit found **2,749 groups of repeated blob content**. These include installed Skill copies and mirrored media. Repeated paths increase checkout and package sizes, but identical file content is already deduplicated in the Git object store. Removing copies without respecting their discovery/install locations would break consumers and agent integrations, so this pass removes only the independently regenerable Carga frame files.

Keep public MP4s in their existing repository paths for now: their URLs and project HTML references are part of the deployed site. Existing ZIPs and proof artifacts also remain. If a future distribution bundle is too large for source control, first establish a stable Release/object-storage URL and confirm every gallery, download, and consumer reference can continue to resolve. No external storage change is required for this cleanup.

## 7. History and GitHub impact

Before cleanup, the repository has one pack of 828.48 MiB and no loose, prune-packable, or garbage objects. Approximately 84 blobs / 6.51 MiB of raw blob content are reachable in history but absent from the current `HEAD` tree; this is small compared with the current frame payload.

A normal cleanup commit creates a new tree without the 1,200 PNG paths but leaves their old blobs in ancestor commits. It reduces fresh checkout content by about **544.81 MiB**, but does not materially reduce the GitHub history pack, clone transfer, or existing clones. `git gc` cannot remove reachable historical blobs.

If reducing the historical pack is desired, handle it as a separate migration: agree on the affected branches/tags, run `git filter-repo` (or equivalent) to remove only the two Carga frame PNG path patterns from all selected history, validate a clean clone and manifests, coordinate collaborators, and then obtain explicit authorization for rewritten refs/force-push. No such rewrite, force-push, or tag change was performed here.

## 8. Regression and integrity results

| Check | Result |
|---|---|
| `npm test -- --test-concurrency=1` | **Passed: 29/29**, including frame render, VP9 alpha decode, independent deterministic renders, safe-zone checks, Skills discovery, CLI, and Creative Core QA |
| `npm run pack:all` | **Passed** for all three distributable packages |
| `node projects/mission-19/test-consumer-install.mjs` | **Passed** using isolated install and local tarballs; MP4 and WebM outputs produced |
| `git diff --check` | **Passed** |
| Site video paths | Both aspect-ratio masters exist at project and landing-site locations; HTML references remain unchanged |
| Approved gallery / Travessia outputs | No local modifications were found in the gallery report, landing-site paths, or approved videos during this hygiene change |
| Local frame files | All 1,200 PNGs still exist in the workspace; only their index entries are staged for deletion |

The test log emitted `/bin/sh: 1: blender: not found`; Blender-dependent 3D execution was not exercised by that optional environment check. The suite still exited successfully with 29 passes and no failures.

## 9. Missions, pending gallery, and Git state

- **Mission 17:** `UNIVERSAL_CREATIVE_DIRECTOR_REPORT.md` is tracked and unchanged locally.
- **Mission 18:** no unique Mission 18 report/commit marker was found in the local history or documentation search; no local change was attributed to it by inference.
- **Mission 19:** its existing uncommitted source, docs, tests, report, and `projects/mission-19/` consumer/evidence artifacts were present before this hygiene work and were preserved. The packaged CLI/Core work passed the regression and consumer checks above.
- **Creation Gallery pending review:** `CREATION_GALLERY_REPORT.md` and gallery/site paths are unchanged; no gallery edit was made.
- **Current branch:** `main` at the audited `origin/main` commit. Current local changes include the pre-existing Mission 19 work, the `.gitignore` update, a new untracked copy of this report, and 1,200 staged frame deletions. No commit or publication action was taken.

## 10. Recommendation

Review and, if approved, commit this reversible cleanup together with the existing local changes only according to their intended ownership. A normal commit delivers the practical **544.81 MiB smaller checkout** without affecting published MP4 paths. Keep history rewriting separate and require explicit authorization because it changes shared Git refs and only that operation can remove the frame blobs from clone history.
