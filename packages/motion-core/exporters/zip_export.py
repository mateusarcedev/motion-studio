#!/usr/bin/env python3
"""Compatibility entry point routed through the canonical delivery pipeline."""
import argparse
import json
import sys
from pathlib import Path
from delivery import export


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path)
    ap.add_argument("outzip", type=Path)
    ap.add_argument("--ext", default="", help="legacy filter used only when no explicit project contract exists")
    args = ap.parse_args()
    extensions = {x.strip().lower().lstrip(".") for x in args.ext.split(",") if x.strip()} or None
    report = export(args.source.resolve(), args.outzip.resolve(), extensions)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "PASS" else 3 if report["status"] == "BLOCKED" else 2


if __name__ == "__main__":
    sys.exit(main())
