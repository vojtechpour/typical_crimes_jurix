#!/usr/bin/env python3
"""
Create a fresh dataset for Phase 2 by cloning an existing dataset and
removing analysis outputs (initial codes, candidate/final themes).

Usage examples:
  python3 create_fresh_dataset.py --source uploads/my_completed.json
  python3 create_fresh_dataset.py --latest
  python3 create_fresh_dataset.py --source uploads/file.json --sample 200

The resulting file is written to uploads/ with a timestamped name.
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Tuple

REPO_ROOT = Path('/Users/vojtechpour/projects/typical-crimes')
UPLOADS_DIR = REPO_ROOT / 'uploads'


def find_latest_upload_json() -> Path:
    if not UPLOADS_DIR.exists():
        raise FileNotFoundError(f"Uploads directory not found: {UPLOADS_DIR}")
    json_files = [p for p in UPLOADS_DIR.iterdir() if p.suffix == '.json']
    if not json_files:
        raise FileNotFoundError("No JSON files found in uploads/")
    return max(json_files, key=lambda p: p.stat().st_mtime)


def load_dataset(path: Path) -> Dict[str, Any]:
    with open(path, 'r', encoding='utf8') as f:
        data = json.load(f)
    # Normalize to object-of-cases if an array is provided
    if isinstance(data, list):
        normalized = {str(i + 1): item for i, item in enumerate(data)}
        return normalized
    if not isinstance(data, dict):
        raise ValueError("Dataset must be a JSON object mapping case IDs to objects, or a list of case objects")
    return data


def strip_analysis_fields(case_obj: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """Remove known analysis outputs from a case object.

    Returns (cleaned_case, removed_counts_by_field)
    """
    removed = {}
    # Known analysis keys to strip
    keys_to_remove = [
        'initial_code_0',
        'initial_code_1',
        'candidate_theme',
        'theme',
        'final_theme',
        'candidate_theme_eol',
    ]
    cleaned = dict(case_obj)
    for key in keys_to_remove:
        if key in cleaned:
            cleaned.pop(key, None)
            removed[key] = removed.get(key, 0) + 1
    return cleaned, removed


def create_fresh_dataset(source: Path, sample: int = None) -> Path:
    data = load_dataset(source)

    total_cases = len(data)
    out: Dict[str, Any] = {}
    aggregate_removed: Dict[str, int] = {}

    # Optional sampling (stable order by case id string)
    items = list(data.items())
    items.sort(key=lambda kv: kv[0])
    if sample is not None:
        items = items[: sample]

    for case_id, case_obj in items:
        cleaned, removed = strip_analysis_fields(case_obj)
        out[case_id] = cleaned
        for k, v in removed.items():
            aggregate_removed[k] = aggregate_removed.get(k, 0) + v

    timestamp = datetime.now().isoformat().replace(':', '-').replace('.', '-')
    src_base = source.name.replace('.json', '')
    out_name = f"uploaded_{timestamp}_{src_base}_fresh_start.json"
    out_path = UPLOADS_DIR / out_name

    with open(out_path, 'w', encoding='utf8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)

    # Print summary for server log/console visibility
    print(json.dumps({
        'success': True,
        'output_file': str(out_path),
        'total_cases_in_source': total_cases,
        'total_cases_written': len(out),
        'removed_fields': aggregate_removed,
    }, ensure_ascii=False))

    return out_path


def main():
    parser = argparse.ArgumentParser(description='Create a fresh dataset for Phase 2')
    parser.add_argument('--source', type=str, help='Path to source dataset (JSON). If relative, resolved under repo root or uploads/.')
    parser.add_argument('--latest', action='store_true', help='Use the latest JSON file in uploads/')
    parser.add_argument('--sample', type=int, default=None, help='Optional: limit to first N cases (by sorted case id)')
    args = parser.parse_args()

    if args.latest and args.source:
        raise SystemExit("Provide either --latest or --source, not both")

    if args.latest:
        source_path = find_latest_upload_json()
    elif args.source:
        # Resolve source path
        p = Path(args.source)
        if not p.is_absolute():
            # Try exact relative to repo root
            p1 = REPO_ROOT / p
            if p1.exists():
                source_path = p1
            else:
                # Try under uploads/
                p2 = UPLOADS_DIR / p
                if p2.exists():
                    source_path = p2
                else:
                    raise FileNotFoundError(f"Source file not found: {p}")
        else:
            source_path = p
        if not source_path.exists():
            raise FileNotFoundError(f"Source file not found: {source_path}")
    else:
        # Default to latest
        source_path = find_latest_upload_json()

    create_fresh_dataset(source_path, sample=args.sample)


if __name__ == '__main__':
    main()


