#!/usr/bin/env bash
# Import Apple distribution cert + provisioning profile for real device / TestFlight IPA.
set -euo pipefail

: "${APPLE_CERTIFICATE_BASE64:?missing APPLE_CERTIFICATE_BASE64}"
: "${APPLE_CERTIFICATE_PASSWORD:?missing APPLE_CERTIFICATE_PASSWORD}"
: "${APPLE_PROVISION_PROFILE_BASE64:?missing APPLE_PROVISION_PROFILE_BASE64}"
: "${APPLE_TEAM_ID:?missing APPLE_TEAM_ID}"

KEYCHAIN_PASSWORD="${KEYCHAIN_PASSWORD:-sunshine-ci-temp}"
CERT_PATH="${RUNNER_TEMP}/sunshine-dist.p12"
PROFILE_PATH="${RUNNER_TEMP}/sunshine.mobileprovision"
KEYCHAIN_PATH="${RUNNER_TEMP}/sunshine-signing.keychain-db"

echo -n "$APPLE_CERTIFICATE_BASE64" | base64 --decode > "$CERT_PATH"
echo -n "$APPLE_PROVISION_PROFILE_BASE64" | base64 --decode > "$PROFILE_PATH"

security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$CERT_PATH" -P "$APPLE_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
security list-keychain -d user -s "$KEYCHAIN_PATH"
security set-key-partition-list -S apple-tool:,apple: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

mkdir -p "$HOME/Library/MobileDevice/Provisioning Profiles"
PROFILE_UUID=$(/usr/libexec/PlistBuddy -c 'Print UUID' /dev/stdin <<< "$(security cms -D -i "$PROFILE_PATH")")
cp "$PROFILE_PATH" "$HOME/Library/MobileDevice/Provisioning Profiles/${PROFILE_UUID}.mobileprovision"
PROFILE_NAME=$(/usr/libexec/PlistBuddy -c 'Print Name' /dev/stdin <<< "$(security cms -D -i "$PROFILE_PATH")")

echo "PROFILE_UUID=$PROFILE_UUID" >> "$GITHUB_ENV"
echo "PROFILE_NAME=$PROFILE_NAME" >> "$GITHUB_ENV"
echo "Imported profile: $PROFILE_NAME ($PROFILE_UUID)"
