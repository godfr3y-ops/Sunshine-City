#!/usr/bin/env bash
# Sideloadly / installd reject IPAs when Capacitor.framework and Cordova.framework
# share the same CFBundleIdentifier (DuplicateIdentifier).
set -euo pipefail

APP_PATH="${1:?usage: fix-ios-framework-ids.sh /path/to/App.app}"
FW="$APP_PATH/Frameworks"

if [ ! -d "$FW" ]; then
  echo "No Frameworks dir in $APP_PATH — skip"
  exit 0
fi

fix_id() {
  local framework="$1"
  local bundle_id="$2"
  local plist="$FW/$framework/Info.plist"
  if [ ! -f "$plist" ]; then
    # Some builds nest Info.plist under Versions/A
    local alt
    alt=$(find "$FW/$framework" -name Info.plist 2>/dev/null | head -1 || true)
    [ -n "$alt" ] || { echo "skip missing $framework"; return 0; }
    plist="$alt"
  fi
  /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier $bundle_id" "$plist" 2>/dev/null \
    || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string $bundle_id" "$plist"
  echo "Set $framework -> $bundle_id ($plist)"
}

# Unique IDs under the app id so Sideloadly re-sign stays consistent
BASE="zw.sunshinecity.hararehustle"
fix_id "Capacitor.framework" "${BASE}.capacitor"
fix_id "Cordova.framework" "${BASE}.cordova"
fix_id "CapacitorCordova.framework" "${BASE}.capacitorcordova"

# Any other embedded *.framework gets a unique suffix from its name
shopt -s nullglob
for dir in "$FW"/*.framework; do
  name=$(basename "$dir" .framework)
  case "$name" in
    Capacitor|Cordova|CapacitorCordova) continue ;;
  esac
  # lowercase-ish id
  id=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9.-')
  fix_id "${name}.framework" "${BASE}.${id}"
done

echo "Framework bundle IDs fixed for Sideloadly"
