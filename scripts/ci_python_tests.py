"""Runs tests/test_*.py and refuses skips: a missing dependency must never look like a green run."""
import importlib.util
import os
import pathlib
import sys
import unittest

root = pathlib.Path(__file__).resolve().parents[1]
venv_py = root / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
if sys.prefix == sys.base_prefix and importlib.util.find_spec("numpy") is None and venv_py.is_file():
    os.execv(str(venv_py), [str(venv_py), __file__, *sys.argv[1:]])

result = unittest.TextTestRunner(verbosity=1).run(unittest.defaultTestLoader.discover(str(root / "tests"), "test_*.py"))
for test, reason in result.skipped:
    print(f"skipped without authorization: {test} — {reason}")
sys.exit(0 if result.wasSuccessful() and result.testsRun and not result.skipped else 1)
