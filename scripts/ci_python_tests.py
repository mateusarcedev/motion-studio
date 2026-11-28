"""Run only Python test files assigned to the requested catalog scope."""
import argparse
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import time

try:
    import resource
except ImportError:  # pragma: no cover - Windows does not expose getrusage
    resource = None

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs/testing/test-catalog.json"


def command_kind(command):
    text = " ".join(map(str, command if isinstance(command, (list, tuple)) else [command])).lower()
    if "ffprobe" in text:
        return "ffprobe"
    if "ffmpeg" in text:
        return "ffmpeg"
    if "chrome" in text or "chromium" in text:
        return "chromium"
    if "node" in text or "npm" in text or "npx" in text:
        return "node"
    if "python" in text:
        return "python"
    return "process"


class MetricsPlugin:
    def __init__(self, metrics_path):
        self.metrics_path = metrics_path
        self.started = time.perf_counter()
        self.test_started = None
        self.files = {}
        self.processes = {"processes": 0, "renders": 0, "chromiumStarts": 0, "ffmpegRuns": 0, "ffprobeRuns": 0, "pythonRuns": 0, "nodeRuns": 0, "fixturesPrepared": 0}
        self.skips = []
        self.original_popen = subprocess.Popen
        self.original_mkdtemp = tempfile.mkdtemp

    def pytest_sessionstart(self, session):
        self.test_started = time.perf_counter()
        def instrumented_popen(args, *positional, **kwargs):
            kind = command_kind(args)
            self.processes["processes"] += 1
            if kind == "ffmpeg":
                self.processes["ffmpegRuns"] += 1
                command_text = " ".join(map(str, args if isinstance(args, (list, tuple)) else [args])).lower()
                if any(suffix in command_text for suffix in (".mp4", ".mov", ".webm", ".mkv", ".wav", ".mp3", ".aac")):
                    self.processes["renders"] += 1
            elif kind == "ffprobe":
                self.processes["ffprobeRuns"] += 1
            elif kind == "chromium":
                self.processes["chromiumStarts"] += 1
            elif kind == "node":
                self.processes["nodeRuns"] += 1
            elif kind == "python":
                self.processes["pythonRuns"] += 1
            return self.original_popen(args, *positional, **kwargs)

        def instrumented_mkdtemp(*args, **kwargs):
            self.processes["fixturesPrepared"] += 1
            return self.original_mkdtemp(*args, **kwargs)

        subprocess.Popen = instrumented_popen
        tempfile.mkdtemp = instrumented_mkdtemp

    def pytest_runtest_logreport(self, report):
        filename = str(pathlib.Path(str(report.fspath)).resolve().relative_to(ROOT))
        row = self.files.setdefault(filename, {"durationMs": 0, "tests": 0, "failed": 0, "skipped": 0, "setupMs": 0, "callMs": 0, "teardownMs": 0})
        duration = report.duration * 1000
        row["durationMs"] += duration
        if report.when == "call":
            row["tests"] += 1
        row[f"{report.when}Ms"] = row.get(f"{report.when}Ms", 0) + duration
        if report.failed:
            row["failed"] += 1
        if report.skipped:
            row["skipped"] += 1
            self.skips.append({"file": filename, "nodeId": report.nodeid, "reason": str(report.longrepr)})

    def pytest_sessionfinish(self, session, exitstatus):
        duration_ms = (time.perf_counter() - self.started) * 1000
        preparation_ms = ((self.test_started or self.started) - self.started) * 1000
        usage = resource.getrusage(resource.RUSAGE_SELF) if resource else None
        report = {
            "schemaVersion": 1,
            "status": "PASS" if exitstatus == 0 and not self.skips else "FAIL",
            "python": sys.version.split()[0],
            "durationMs": duration_ms,
            "preparationMs": preparation_ms,
            "testPhaseMs": max(0, duration_ms - preparation_ms),
            "files": [{"file": key, **value} for key, value in sorted(self.files.items(), key=lambda item: item[1]["durationMs"], reverse=True)],
            "counts": self.processes,
            "resources": {"maxRssKB": usage.ru_maxrss, "userCpuMs": usage.ru_utime * 1000, "systemCpuMs": usage.ru_stime * 1000} if usage else {"available": False},
            "skipped": self.skips,
        }
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)
        self.metrics_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        slow_files = sorted(self.files.items(), key=lambda item: item[1]["durationMs"], reverse=True)[:5]
        print(
            f"Python suite: {duration_ms / 1000:.2f}s total; "
            f"{preparation_ms / 1000:.2f}s preparation; "
            f"{sum(item['tests'] for item in self.files.values())} tests, "
            f"{sum(item['failed'] for item in self.files.values())} failed, "
            f"{sum(item['skipped'] for item in self.files.values())} skipped."
        )
        print(
            "Python instrumentation: "
            f"{self.processes['processes']} processes, {self.processes['renders']} media outputs, "
            f"{self.processes['chromiumStarts']} Chromium, {self.processes['ffmpegRuns']} FFmpeg, "
            f"{self.processes['ffprobeRuns']} ffprobe, {self.processes['nodeRuns']} Node, "
            f"{self.processes['fixturesPrepared']} tempfile factories; "
            f"peak RSS {report['resources'].get('maxRssKB', 'unavailable')} KB."
        )
        print("Slowest Python test files: " + " | ".join(f"{name} {row['durationMs'] / 1000:.2f}s" for name, row in slow_files))
        subprocess.Popen = self.original_popen
        tempfile.mkdtemp = self.original_mkdtemp


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", choices=("all", "standalone", "matrix"), default="all")
    parser.add_argument("--path", action="append", default=[], help="Run an explicit catalogued Python test path (repeatable).")
    args = parser.parse_args()

    if not CATALOG.is_file():
        print(f"Test catalog missing: {CATALOG}", file=sys.stderr)
        return 2
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    python_entries = [entry for entry in catalog["entries"] if entry["runner"] == "pytest"]
    blocked = [entry for entry in python_entries if entry["ci"]["status"] == "blocked"]
    entries = [entry for entry in python_entries if entry["ci"]["status"] == "run"]
    scoped_blocked = []
    if args.path:
        requested = {pathlib.Path(value).as_posix() for value in args.path}
        known = {entry["path"] for entry in entries}
        blocked_requested = [entry for entry in blocked if entry["path"] in requested]
        if blocked_requested:
            details = "; ".join(f"{entry['path']}: {entry['ci']['reason']}" for entry in blocked_requested)
            print(f"Blocked Python tests cannot be executed: {details}", file=sys.stderr)
            return 2
        missing = requested - known
        if missing:
            print(f"Uncatalogued or non-runnable Python tests requested: {', '.join(sorted(missing))}", file=sys.stderr)
            return 2
        entries = [entry for entry in entries if entry["path"] in requested]
        scoped_blocked = [entry for entry in blocked if entry["path"] in requested]
    elif args.scope == "standalone":
        entries = [entry for entry in entries if entry["ci"]["job"] == "python"]
        scoped_blocked = [entry for entry in blocked if entry["ci"]["job"] == "python"]
    elif args.scope == "matrix":
        entries = [entry for entry in entries if entry["ci"]["job"] == "node-matrix"]
        scoped_blocked = [entry for entry in blocked if entry["ci"]["job"] == "node-matrix"]
    else:
        scoped_blocked = blocked

    if scoped_blocked:
        print(f"BLOCKED COVERAGE: {len(scoped_blocked)} Python test(s) retained but not runnable:")
        for entry in scoped_blocked:
            print(f"- {entry['path']}: {entry['ci']['reason']}")

    if not entries:
        print("No Python test files selected; refusing empty selection.", file=sys.stderr)
        return 2
    files = [entry["path"] for entry in entries]
    try:
        import pytest
    except ImportError:
        print("pytest is required. Install scripts/test-requirements.txt before running Python tests.", file=sys.stderr)
        return 2

    scope_name = "explicit" if args.path else args.scope
    metrics_path = ROOT / "tests/tmp" / f"python-test-metrics-{scope_name}-{os.getpid()}.json"
    plugin = MetricsPlugin(metrics_path)
    print(f"Python {scope_name}: {len(files)} runnable files; {len(scoped_blocked)} blocked files excluded explicitly")
    exit_code = pytest.main(["--import-mode=importlib", "-q", *[str(ROOT / file) for file in files]], plugins=[plugin])
    print(f"Python test metrics: {metrics_path.relative_to(ROOT)}")
    if plugin.skips:
        print(f"Refusing {len(plugin.skips)} skipped Python test(s): " + "; ".join(item["nodeId"] for item in plugin.skips), file=sys.stderr)
        return 1
    return int(exit_code)


if __name__ == "__main__":
    raise SystemExit(main())
