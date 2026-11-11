#!/usr/bin/env python3
"""Assemble a static site using a checked-out, auditable benchmark revision."""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parents[1]


def revision(path):
    return subprocess.run(["git", "-C", str(path), "rev-parse", "--short=12", "HEAD"],
                          check=True, text=True, capture_output=True).stdout.strip()


def assemble(benchmark, output):
    benchmark, output = benchmark.resolve(), output.resolve()
    if output.exists():
        raise FileExistsError(f"Output already exists: {output}")
    if not (benchmark / "scripts/build_site_data.py").is_file():
        raise FileNotFoundError("Expected an openSDC-Bench checkout")
    version = revision(SITE) + "-" + revision(benchmark)
    output.mkdir(parents=True)
    try:
        for name in ("index.html", "site.css", "site.js", "leaderboard.js"):
            text = (SITE / name).read_text(encoding="utf-8")
            # A changed commit gets fresh browser assets and fresh data requests.
            text = re.sub(r"(?<=\?v=)[A-Za-z0-9._-]+", version, text)
            if name == "site.js":
                text = re.sub(r'(const (?:dataVersion|qualityVersion) = ")[^"]+(")',
                              lambda match: match[1] + version + match[2], text)
            (output / name).write_text(text, encoding="utf-8")
        subprocess.run([sys.executable, str(benchmark / "scripts/build_site_data.py"),
                        "--output", str(output / "data")], check=True)
        (output / ".nojekyll").touch()
    except BaseException:
        shutil.rmtree(output)
        raise
    print(f"Built {output} from benchmark {revision(benchmark)} and site {revision(SITE)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    assemble(args.benchmark, args.output)
