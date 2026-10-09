#!/usr/bin/env bash
set -euo pipefail

REPO="25k8hvgjgh-coder/PEXVORO"
DIR="$HOME/reconfeed-signing"
KS="$DIR/reconfeed-beta.keystore"
PF="$DIR/password.txt"

command -v gh >/dev/null || { echo "GitHub CLI (gh) is not installed in this Codespace."; exit 1; }
command -v keytool >/dev/null || { echo "Java keytool is not available in this Codespace."; exit 1; }
gh auth status -h github.com
mkdir -p "$DIR"
chmod 700 "$DIR"
umask 077

if [ -f "$KS" ] && [ -f "$PF" ] && keytool -list -keystore "$KS" -storepass "$(cat "$PF")" -alias reconfeed >/dev/null 2>&1; then
  echo "Reusing the existing verified ReconFeed signing key."
else
  [ ! -f "$KS" ] || mv "$KS" "$KS.previous"
  [ ! -f "$PF" ] || mv "$PF" "$PF.previous"
  python3 -c 'import secrets; print(secrets.token_hex(32), end="")' > "$PF"
  P="$(cat "$PF")"
  keytool -genkeypair -noprompt -keystore "$KS" -storepass "$P" -alias reconfeed -keypass "$P" -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=ReconFeed Beta, OU=Beta, O=ReconFeed, L=Denton, ST=Texas, C=US"
  echo "Created a new persistent ReconFeed beta signing key."
fi

P="$(cat "$PF")"
keytool -list -keystore "$KS" -storepass "$P" -alias reconfeed >/dev/null
base64 -w 0 "$KS" | gh secret set RECONFEED_ANDROID_KEYSTORE_BASE64 --repo "$REPO"
gh secret set RECONFEED_ANDROID_STORE_PASSWORD --repo "$REPO" < "$PF"
gh secret set RECONFEED_ANDROID_KEY_PASSWORD --repo "$REPO" < "$PF"
printf '%s' 'reconfeed' | gh secret set RECONFEED_ANDROID_KEY_ALIAS --repo "$REPO"
echo "Configured signing secrets (values are not displayed):"
gh secret list --repo "$REPO"
echo "SUCCESS: Keep $KS and $PF safe. They are your signing-key backup."
