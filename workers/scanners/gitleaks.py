import json
import subprocess
import tempfile


def scan(repo_path: str) -> list:
    """Run gitleaks on a local clone, return list of leak objects."""
    report = tempfile.mktemp(suffix=".json")
    result = subprocess.run(
        ["gitleaks", "detect", "--source", repo_path,
         "--report-format", "json", "--report-path", report,
         "--exit-code", "0", "--no-banner"],
        capture_output=True, text=True, timeout=300,
    )
    if result.returncode not in (0, 1):
        raise RuntimeError(f"gitleaks failed: {result.stderr[:500]}")
    try:
        with open(report) as f:
            return json.load(f) or []
    except (FileNotFoundError, json.JSONDecodeError):
        return []
