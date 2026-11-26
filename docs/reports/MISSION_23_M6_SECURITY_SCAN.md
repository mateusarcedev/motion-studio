# Security Review: motion-studio

## Scope

Targeted static source review and adversarial validation of delivery archive inclusion, local MCP stdio and job resource bounds, workspace/path controls, artifact integrity, sanitization and remote-asset checks.

- Scan mode: repository
- Target kind: git\_worktree
- Target ID: target\_sha256\_1f661c53f0770639c5fa950f06566f7211c49ac25f079a433ebb9014f2eb9d73
- Revision: 0a2ed3a5a4d407b38d3914b5cf139a43be7eab50
- Snapshot digest: codex-security-snapshot/v1:sha256:506344e169e2b2c16128e33d6694e51c84d03b1d3f8ded80663d8470c0555a4c
- Included paths: .
- Excluded paths: none
- Artifacts reviewed: packages/motion-core/exporters/delivery.py, packages/motion-cli/lib/mcp.mjs, packages/motion-cli/lib/mcp-tools.mjs, packages/motion-core/bridge/security.mjs, packages/motion-core/bridge/assets.mjs, tests/delivery\_integrity.test.mjs, tests/mcp\_server.test.mjs, tests/mcp\_resource\_limits.test.mjs, tests/bridge\_security.test.mjs, tests/bridge\_asset\_hydration.test.mjs
- Scan context: Mission 23 M6 requested a security review of M1–M5 surfaces. Findings are evaluated against reference commit 0a2ed3a; M6 remediations are in the current working tree.

Limitations and exclusions:
- Targeted review of security-critical surfaces; no line-by-line audit of all 10,859 inventoried repository files.
- No deployed service or external Doop canvas was assessed.
- Filename-based secret recognition is heuristic; credentials in arbitrary innocuous filenames are not guaranteed to be detected.
- This workbench result is not an independent penetration test.
- Excluded deployed or remote services: Excluded from review
- Excluded real Doop canvases: Excluded from review

### Scan Summary

| Field | Value |
| --- | --- |
| Scan outcome | completed |
| Reportable findings | 2 |
| Severity mix | medium: 2 |
| Confidence mix | high: 2 |
| Validation mode | Source review plus fixture-based adversarial regression tests |

Canonical artifacts: `scan-manifest.json` and `findings.json`. This report is a deterministic projection of those files.

## Threat Model

Motion Studio runs as a local framework and exposes Motion Core through a child MCP process on stdio. Project files, imported design data, and MCP arguments may be untrusted. Protected assets include source files, local credentials, generated artifacts, and protocol integrity. The optional Doop MCP is an external trust boundary; this review made no changes to it.

### Assets

- project files and local credentials
- generated media and delivery archives
- workspace isolation
- stdio protocol integrity
- Doop canvas content and authorization

### Trust Boundaries

- MCP client to local stdio server
- Motion MCP handlers to Motion Core
- Local workspace to generated artifacts
- Motion Studio agent to official Doop MCP

### Attacker Capabilities

- Control MCP stdio input
- Place files inside a project selected for delivery
- Provide crafted import data or URLs

### Security Objectives

- Prevent credential disclosure in delivery archives
- Bound local resource use
- Preserve workspace and symlink isolation
- Sanitize imported content and verify asset provenance
- Keep protocol output free of diagnostics

### Assumptions

- The local MCP client may be compromised or send malformed/high-volume requests.
- Design HTML, CSS, SVG, JSON and external asset references are untrusted.
- External editor writes require explicit authorization and must use the official Doop MCP.

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [MCP stdio and background jobs had unbounded resource growth](#finding-1) | medium | high | inline below |
| [Generated delivery archives can include credential-like files](#finding-2) | medium | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] MCP stdio and background jobs had unbounded resource growth

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The unbounded line reader, request set, waiter array, and job Map were directly inspected. New tests exercised the byte cap, request recovery, queue rejection, and job retention behavior. |
| Category | denial\_of\_service |
| CWE | CWE-400 |
| Affected lines | packages/motion-cli/lib/mcp.mjs:79-123, packages/motion-cli/lib/mcp-tools.mjs:83-94, packages/motion-cli/lib/mcp-tools.mjs:202-247 |

#### Summary

At the reference commit, readline buffered complete JSON-RPC lines without a byte cap, every parsed request could be added to an unbounded pending set and waiter queue, and completed background jobs remained in a Map indefinitely. A local or compromised MCP client could drive memory growth or queue work beyond the intended concurrency cap.

#### Root Cause

Concurrency bounded active tasks but not the size of one input line, total pending JSON-RPC requests, queued operations, or retained job history.

#### Validation

The unbounded line reader, request set, waiter array, and job Map were directly inspected. New tests exercised the byte cap, request recovery, queue rejection, and job retention behavior. Validation details were not recorded separately.

Validation method: source\_path\_review\_and\_adversarial\_tests

Evidence:
- The real subprocess test rejects a line larger than MAX\_MCP\_LINE\_BYTES and continues to answer ping. Unit tests exercise maximum queue behavior and pruning of completed jobs.

#### Dataflow

The canonical finding records the affected path at packages/motion-cli/lib/mcp.mjs:79-123, packages/motion-cli/lib/mcp-tools.mjs:83-94, packages/motion-cli/lib/mcp-tools.mjs:202-247, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — The scan assigned medium severity; no separate canonical severity rationale was recorded.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

M6 replaces readline buffering with a bounded byte-line reader, caps lines at 20 MiB and outstanding requests at 64, bounds the operation queue at 32, retains at most 128 jobs, and prunes completed jobs before accepting more work.

Tests:
- node --test tests/mcp\_server.test.mjs tests/mcp\_resource\_limits.test.mjs
- Real stdio test sends a 20 MiB+ line, observes -32600, then completes ping on the same process.
- Unit tests prove queue overflow returns MOTION\_QUEUE\_FULL and completed history remains capped at 128.

<a id="finding-2"></a>

### [2] Generated delivery archives can include credential-like files

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The recursive supported-file enumeration and ZIP copy path were directly inspected; fixture-based tests reproduced the leak condition and verified fail-closed behavior after the patch. |
| Category | sensitive\_data\_exposure |
| CWE | CWE-200 |
| Affected lines | packages/motion-core/exporters/delivery.py:29, packages/motion-core/exporters/delivery.py:288-299, packages/motion-core/exporters/delivery.py:531-546 |

#### Summary

At the reference commit, auto-generated delivery contracts recursively accepted supported files including JSON and added them to a ZIP. A project containing credentials.json, token.json, .env, or a credential directory could therefore place secrets in a shareable archive. The exporter is local and does not transmit the archive, which limits exposure to a later handoff.

#### Root Cause

The inferred delivery contract treated every supported regular file as an artifact; it did not classify common credential filenames or sensitive directories before building the ZIP.

#### Validation

The recursive supported-file enumeration and ZIP copy path were directly inspected; fixture-based tests reproduced the leak condition and verified fail-closed behavior after the patch. Validation details were not recorded separately.

Validation method: reproduction\_and\_patch\_verification

Evidence:
- Two new delivery integrity tests create fixture-only credential files and assert a delivery.sensitive\_file failure, omission from the manifest, and absence of the resulting ZIP.

#### Dataflow

The canonical finding records the affected path at packages/motion-core/exporters/delivery.py:29, packages/motion-core/exporters/delivery.py:288-299, packages/motion-core/exporters/delivery.py:531-546, but no expanded source-to-sink narrative was recorded.

#### Reachability

Reachability was not recorded beyond the canonical finding summary and affected locations.

#### Severity

**Medium** — The scan assigned medium severity; no separate canonical severity rationale was recorded.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

M6 filters credential-like filenames, .env files, and credential directories from inferred delivery contracts and fails closed when a sensitive path appears in an explicit contract or produced root. The archive is not created when the finding is present.

Tests:
- node --test tests/delivery\_integrity.test.mjs
- Fixtures cover auto-discovered service-account.json and an explicitly declared credentials/service-account.json; both fail closed and create no ZIP.
