#!/usr/bin/env bash
# THROWAWAY EXPERIMENT — look up a WAV against AcoustID (Chromaprint + MusicBrainz).
# AcoustID matches near-identical FULL recordings (not robust clip matching like
# ACRCloud), and the free service is NON-COMMERCIAL only. This is a coverage/behaviour
# probe, not a production path.
#
# Needs: brew install chromaprint   (provides `fpcalc`)
# Usage: bash packages/api/src/scripts/diag-acoustid.sh <wav> [wav2 ...]
# Optional: ACOUSTID_CLIENT=<your key>  (falls back to the docs' test key, which expires)
set -euo pipefail

client="${ACOUSTID_CLIENT:-O_IYI8jERAs}"

if ! command -v fpcalc >/dev/null 2>&1; then
  echo "fpcalc not found — run: brew install chromaprint" >&2
  exit 1
fi

for f in "$@"; do
  echo "=============================================================="
  echo "FILE: $f"
  out="$(fpcalc "$f")"
  dur="$(printf '%s\n' "$out" | sed -n 's/^DURATION=//p')"
  fp="$(printf '%s\n'  "$out" | sed -n 's/^FINGERPRINT=//p')"
  echo "duration=${dur}s  fingerprint_len=${#fp}"
  echo "--- AcoustID response ---"
  curl -s "https://api.acoustid.org/v2/lookup" \
    --data-urlencode "client=${client}" \
    --data-urlencode "meta=recordings+releasegroups" \
    --data-urlencode "duration=${dur}" \
    --data-urlencode "fingerprint=${fp}"
  echo
done
