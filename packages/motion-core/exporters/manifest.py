#!/usr/bin/env python3
"""Compatibility entry point for the canonical versioned delivery manifest."""
import argparse
import json
import sys
from pathlib import Path
from delivery import manifest_only


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("-o", "--out", type=Path, default=None)
    args = ap.parse_args()
    report = manifest_only(args.folder.resolve(), args.out.resolve() if args.out else None)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 3 if report["status"] == "BLOCKED" else 2


if __name__ == "__main__":
    sys.exit(main())
