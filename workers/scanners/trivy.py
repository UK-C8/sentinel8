import json
import subprocess
import tempfile
from pathlib import Path


def scan(repo_path: str) -> dict:
    """Run trivy fs on a local repo clone, return parsed JSON."""
    out = tempfile.mktemp(suffix=".json")
    result = subprocess.run(
        ["trivy", "fs", "--format", "json", "--output", out,
         "--scanners", "vuln,secret,misconfig", "--exit-code", "0",
         repo_path],
        capture_output=True, text=True, timeout=600,
    )
    if result.returncode not in (0, 1):  # trivy exits 1 when findings exist
        raise RuntimeError(f"trivy failed: {result.stderr[:500]}")
    try:
        return json.loads(Path(out).read_text())
    except (json.JSONDecodeError, FileNotFoundError):
        return {}
