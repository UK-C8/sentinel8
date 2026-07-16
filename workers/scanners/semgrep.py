import json
import subprocess


def scan(repo_path: str) -> dict:
    """Run semgrep auto-config on a local clone, return parsed JSON."""
    result = subprocess.run(
        ["semgrep", "scan", "--config=auto", "--json",
         "--no-git-ignore", "--quiet", repo_path],
        capture_output=True, text=True, timeout=600,
    )
    # semgrep exits 1 when findings found, 0 when clean
    if result.returncode not in (0, 1):
        raise RuntimeError(f"semgrep failed: {result.stderr[:500]}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}
