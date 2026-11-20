# Delivery Integrity

`motion export <projeto> <entrega.zip>` is the single supported delivery path. It reads
`delivery.contract.json`, validates source artifacts, writes `assets.manifest.json`, creates the
ZIP, then opens and verifies that ZIP before reporting success. `motion qa delivery --project
<projeto> --zip <entrega.zip>` repeats the verification without creating a new package. Exit code 2
means `FAIL`; exit code 3 means a required verification was blocked.

## Contract v1

Keep `delivery.contract.json` at the project root. The contract states which files are required,
which are optional, and which output directories must be fully represented. It does not make all
formats mandatory for all projects.

```json
{
  "schemaVersion": 1,
  "project": "launch-film",
  "producedRoots": ["out/final", "site"],
  "artifacts": [
    {
      "path": "out/final/launch.mp4",
      "role": "primary-video",
      "mediaType": "video/mp4",
      "required": true,
      "spec": {
        "width": 1920,
        "height": 1080,
        "fps": 30,
        "codec": "h264",
        "durationSec": 30,
        "durationSecTolerance": 0.1
      }
    },
    {
      "path": "site/index.html",
      "role": "landing-page",
      "mediaType": "text/html",
      "required": false
    }
  ],
  "fonts": [
    {
      "family": "Ubuntu Sans",
      "path": "site/assets/UbuntuSans.ttf",
      "license": "Ubuntu Font Licence 1.0",
      "licenseUrl": "https://ubuntu.com/legal/font-licence",
      "licenseFile": "site/assets/Ubuntu-Font-Licence-1.0.txt",
      "origin": "Ubuntu Design font download",
      "redistributable": true,
      "required": true
    }
  ]
}
```

`artifacts[].path` is a project-relative POSIX path. `required` must be explicit. Missing optional
files are permitted; missing required files fail. Existing files within `producedRoots` that are
not in `artifacts` fail as undeclared outputs. Empty/missing output roots fail. Never list the
root-level `assets.manifest.json` or `delivery.contract.json` as artifacts: the manifest excludes
itself and the contract hash is stored outside the manifest's `files` array.

For each present file, the manifest stores relative path, media type, byte count, full SHA-256,
role, required flag, media dimensions/metadata when available, and per-file validation status. For
video specs, `ffprobe` checks dimensions, frame rate, video/audio codecs, sample rate, channels and
duration; font license provenance is copied into the manifest and a declared `licenseFile` must
also be present in the ZIP. Absent media tooling produces
`BLOCKED`. PNG chunks and CRCs, common file signatures, text/JSON validity, and local
`@font-face` references are checked without adding a runtime dependency.

The ZIP verifier checks the actual member list, duplicate and unsafe paths, symlinks, empty
directory entries, CRC, exact contract/manifest bytes, file sizes and SHA-256 values. It fails on
missing, extra, or changed entries. ZIP writing uses Python's standard library and ZIP64, with
streamed file writes and hash reads for large media.

The project contract and generated manifest must be regular files. Symlinked metadata is rejected;
generated metadata is replaced atomically so a link cannot redirect a write outside the project.
Malformed contract or manifest structures return `FAIL` with a JSON finding instead of an unhandled
traceback.

Projects without a contract retain a compatibility path: discovered supported files become
required artifacts in an auto-generated contract. The legacy extension filter now fails if it
would omit discovered files; it cannot silently hide media from the ZIP. Production projects should
declare the exact contract and `producedRoots`; this is what lets the verifier catch an output that
was produced but forgotten during delivery.

## Temporal QA context

`temporal-context.json` can sit in the project root or `reviews/`. It is optional and only explains
intent; it does not turn off detectors.

```json
{
  "schemaVersion": 1,
  "scenes": [
    { "startSec": 4.2, "endSec": 6.4, "kind": "reading-pause", "label": "resultado final para leitura" },
    { "startSec": 8, "endSec": 9, "kind": "intentional-dark", "label": "transição escura" }
  ]
}
```

For projects with multiple videos or frame folders, scope the timelines by asset basename under
`videos` and `frames`. `motion qa project` and `motion qa ... --context` select the matching entry;
this keeps a reel's pause annotation from masking a different scene in a longer film.

Recognized pause kinds are `reading-pause`, `static-end-card`, `planned-pause`, and `final-hold`.
Dark-frame kinds are `intentional-dark`, `dark-background`, `blackout`, and `fade-to-black`. The
same context can be passed directly to `motion qa media ... --context=temporal-context.json` or
`motion qa frames ... --context=temporal-context.json`. Unannotated freezes and dark spans remain
visible as heuristic warnings.
