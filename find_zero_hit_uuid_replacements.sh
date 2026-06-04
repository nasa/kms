#!/usr/bin/env bash

set -euo pipefail

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required but not installed."
  exit 1
fi

if [[ ! -f "check_hits.sh" ]]; then
  echo "check_hits.sh must exist in the current directory."
  exit 1
fi

python3 - <<'PY'
import csv
import io
import json
import re
import urllib.request
from pathlib import Path

text = Path("check_hits.sh").read_text()
match = re.search(r"^TOKEN=(.*)$", text, re.M)
if not match:
    raise SystemExit("Unable to find TOKEN in check_hits.sh")

token = match.group(1).strip()
cases = [
    ("temporal-keywords", "temporalresolutionrange"),
    ("spatial-keywords (location)", "locations"),
    ("concepts (idnnode)", "idnnode"),
    ("iso-topic-categories", "isotopiccategory"),
    ("related-urls", "rucontenttype"),
    ("granule-data-format (1)", "granuledataformat"),
]

kms_url = (
    "https://cmr.earthdata.nasa.gov/kms/concepts/"
    "concept_scheme/{scheme}?format=csv&version=published"
)
cmr_url = "https://cmr.uat.earthdata.nasa.gov/search/collections.umm_json?keyword={uuid}"
headers = {"Authorization": f"Bearer {token}"} if token else {}

print(
    "LABEL".ljust(26),
    "SCHEME".ljust(24),
    "REPLACEMENT UUID".ljust(36),
    "HITS",
)
print("-" * 100)

for label, scheme in cases:
    csv_text = urllib.request.urlopen(kms_url.format(scheme=scheme), timeout=60).read().decode("utf-8")
    rows = list(csv.reader(io.StringIO(csv_text)))
    uuid_idx = len(rows[1]) - 1
    replacement_uuid = None
    hits_value = 0

    for row in rows[2:]:
        if uuid_idx >= len(row):
            continue

        uuid = row[uuid_idx].strip()
        if not uuid:
            continue

        request = urllib.request.Request(cmr_url.format(uuid=uuid), headers=headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = json.load(response)

        hits = payload.get("hits", 0)
        if hits:
            replacement_uuid = uuid
            hits_value = hits
            break

    print(
        label.ljust(26),
        scheme.ljust(24),
        (replacement_uuid or "NOT_FOUND").ljust(36),
        hits_value,
    )
PY
