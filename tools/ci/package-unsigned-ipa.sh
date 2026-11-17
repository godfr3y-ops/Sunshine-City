#!/usr/bin/env bash
# Package an unsigned .app (iphoneos / arm64) into a Sideloadly-ready .ipa
set -euo pipefail

APP_PATH="${1:?usage: package-unsigned-ipa.sh /path/to/App.app out.ipa}"
OUT_IPA="${2:?usage: package-unsigned-ipa.sh /path/to/App.app out.ipa}"

STAGE="$(mktemp -d)"
mkdir -p "$STAGE/Payload"
cp -R "$APP_PATH" "$STAGE/Payload/"

# Strip quarantine / ensure Sideloadly can re-sign
xattr -cr "$STAGE/Payload" 2>/dev/null || true

(
  cd "$STAGE"
  zip -qry "$OUT_IPA" Payload
)

rm -rf "$STAGE"
echo "Wrote unsigned IPA: $OUT_IPA"
ls -lah "$OUT_IPA"
