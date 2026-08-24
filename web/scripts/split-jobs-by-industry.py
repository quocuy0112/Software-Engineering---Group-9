#!/usr/bin/env python3
"""Split a jobs.json array into one JSON file per industry code.

Usage:
    python scripts/split-jobs-by-industry.py data/jobs/jobs.json
    python scripts/split-jobs-by-industry.py data/jobs/jobs.json --output-dir data/jobs/by-industry

The source jobs are never modified. Every configured industry is written,
including an empty ``[]`` file when that industry has no jobs.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


INDUSTRY_SLUGS: dict[str, str] = {
    "r01": "sales",
    "r02": "marketing",
    "r03": "it",
    "r04": "accounting",
    "r05": "admin",
    "r06": "hr",
    "r07": "electrical",
    "r08": "mechanical",
    "r09": "construction",
    "r10": "supply_chain",
    "r11": "manufacturing",
    "r12": "customer_service",
    "r13": "design",
    "r14": "hse",
    "r15": "finance_banking",
    "r16": "insurance",
    "r17": "real_estate",
    "r18": "healthcare",
    "r19": "retail",
    "r20": "hospitality",
    "r21": "education",
    "r22": "ecommerce",
    "r23": "cosmetics",
    "r24": "translation",
    "r25": "media_journalism",
    "r26": "textiles",
    "r27": "agriculture",
    "r28": "general_labor",
    "r29": "other",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Read a jobs JSON array and write one UTF-8 JSON file for each "
            "industryCode (r01-r29)."
        )
    )
    parser.add_argument("source", type=Path, help="Path to the source jobs.json file")
    parser.add_argument(
        "-o",
        "--output-dir",
        type=Path,
        help="Directory for split files (default: source file's directory)",
    )
    return parser.parse_args()


def load_jobs(source: Path) -> list[dict[str, Any]]:
    try:
        with source.open("r", encoding="utf-8") as handle:
            document = json.load(handle)
    except FileNotFoundError as error:
        raise ValueError(f"Source file not found: {source}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"Source is not valid JSON: {source}: {error}") from error

    if not isinstance(document, list):
        raise ValueError("Source JSON must contain an array of job objects.")

    invalid_items = [
        index for index, job in enumerate(document) if not isinstance(job, dict)
    ]
    if invalid_items:
        positions = ", ".join(str(index) for index in invalid_items[:10])
        suffix = "..." if len(invalid_items) > 10 else ""
        raise ValueError(f"Job entries must be objects (indexes: {positions}{suffix}).")

    jobs = [job for job in document if isinstance(job, dict)]
    missing_codes = [
        index
        for index, job in enumerate(jobs)
        if not isinstance(job.get("industryCode"), str)
        or not job["industryCode"].strip()
    ]
    if missing_codes:
        positions = ", ".join(str(index) for index in missing_codes[:10])
        suffix = "..." if len(missing_codes) > 10 else ""
        raise ValueError(
            "Every job must have a non-empty string industryCode "
            f"(indexes: {positions}{suffix})."
        )

    unknown_codes = sorted(
        {
            job["industryCode"]
            for job in jobs
            if isinstance(job.get("industryCode"), str)
            and job["industryCode"] not in INDUSTRY_SLUGS
        }
    )
    if unknown_codes:
        raise ValueError(
            "Unknown industryCode(s): "
            + ", ".join(unknown_codes)
            + ". Expected r01 through r29."
        )

    return jobs


def split_jobs(source: Path, output_dir: Path) -> int:
    jobs = load_jobs(source)
    grouped: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for job in jobs:
        # load_jobs validates this field and its value before grouping.
        grouped[job["industryCode"]].append(job)

    output_dir.mkdir(parents=True, exist_ok=True)
    for code, slug in INDUSTRY_SLUGS.items():
        output_path = output_dir / f"jobs_{slug}_{code}.json"
        with output_path.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(grouped[code], handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        print(f"Created {output_path} ({len(grouped[code])} jobs)")

    grouped_total = sum(len(values) for values in grouped.values())
    if grouped_total != len(jobs):
        # This should be unreachable after validation, but protects the
        # cross-check if the grouping logic is changed later.
        raise RuntimeError(
            f"Grouping total mismatch: processed {len(jobs)}, grouped {grouped_total}."
        )
    print(f"Total jobs processed: {len(jobs)}")
    print("Industries with zero jobs were written as empty [] files.")
    return len(jobs)


def main() -> int:
    arguments = parse_args()
    source = arguments.source.expanduser()
    output_dir = (arguments.output_dir or source.parent).expanduser()
    try:
        split_jobs(source, output_dir)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
