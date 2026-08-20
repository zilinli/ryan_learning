#!/usr/bin/env python3
"""Suggest corrected shell commands via thefuck (no execution)."""

from __future__ import annotations

import argparse
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Print thefuck corrections for a failed command.")
    parser.add_argument("--script", required=True, help="Failed command script")
    parser.add_argument("--output", default="", help="Command stderr/stdout if already known")
    parser.add_argument("--limit", type=int, default=3, help="Max suggestions")
    args = parser.parse_args()

    try:
        from thefuck.conf import settings
        from thefuck.corrector import get_corrected_commands
        from thefuck.types import Command
    except ImportError:
        print(
            "thefuck 未安装。请执行: brew install thefuck\n"
            "或: pip3 install thefuck --user",
            file=sys.stderr,
        )
        return 2

    settings.init()
    command = Command(script=args.script, output=args.output or None)
    seen: set[str] = set()
    count = 0
    for corrected in get_corrected_commands(command):
        script = corrected.script
        if not script or script in seen:
            continue
        seen.add(script)
        print(script)
        count += 1
        if count >= args.limit:
            break

    if count == 0:
        print("No match", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
