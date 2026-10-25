#!/usr/bin/env python3
"""Decode selected string literals from the recovered deployment; no source reconstruction."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
FIELDS = {
    'presentationLabels': 'presentation-labels.js',
    'bankQrBundle': 'bank-qr.bundle.js',
    'bankQrHost': 'bank-qr-host.js',
    'bankQrCss': 'bank-qr.css',
    'css': 'layout.css',
    'calendarModeClient': 'calendar-mode.js',
    'reportDateClient': 'report-date.js',
    'localPreferenceClient': 'local-preferences.js',
    'obligationCss': 'obligations.css',
    'obligationsClient': 'obligations.js',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Compare without writing files')
    args = parser.parse_args()
    wrapper = (ROOT / 'recovered/worker/ui-wrapper.mjs').read_text(encoding='utf-8')
    literals = dict(re.findall(r'^const (\w+)\s*=\s*("(?:[^"\\]|\\.)*");', wrapper, re.M))
    output = ROOT / 'recovered/frontend-extensions'
    if not args.check:
        output.mkdir(parents=True, exist_ok=True)
    for name, filename in FIELDS.items():
        value = json.loads(literals[name]).encode('utf-8')
        path = output / filename
        if args.check:
            if not path.is_file() or path.read_bytes() != value:
                raise SystemExit(f'Decoded artifact differs: {path.relative_to(ROOT)}')
        else:
            path.write_bytes(value)
    print(f'{len(FIELDS)} embedded artifacts {"verified" if args.check else "decoded"}.')


if __name__ == '__main__':
    main()
