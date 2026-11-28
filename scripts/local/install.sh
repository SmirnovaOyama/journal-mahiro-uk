#!/bin/bash
# Sets this Mac to deploy main in full on its own (scripts/local/deploy.sh),
# or stops it.
#
#   scripts/local/install.sh            every minute, from now on
#   scripts/local/install.sh --remove   no more
#
# It copies deploy.sh beside its checkout, under
# ~/Library/Application Support/journal-mahiro-uk, and has launchd run that
# copy as you, every minute and at login: so it deploys with the
# `wrangler login` of this account, and a later change to deploy.sh takes
# effect only when this is run again. It runs at ordinary priority; as a
# background job, drawing the cards took eight minutes instead of one.
# Nothing is installed outside your home folder, and --remove takes away
# all of it but the checkout and the log.

set -euo pipefail

LABEL="uk.mahiro.journal.deploy"
HOME_DIR="${JOURNAL_DEPLOY_HOME:-$HOME/Library/Application Support/journal-mahiro-uk}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HERE="$(cd "$(dirname "$0")" && pwd)"
DOMAIN="gui/$(id -u)"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
# Nothing of it is running now, so a lock it left is nobody's.
rmdir "$HOME_DIR/lock" 2>/dev/null || true

if [ "${1:-}" = "--remove" ]; then
    rm -f "$PLIST" "$HOME_DIR/deploy.sh"
    echo "This Mac no longer deploys on its own. Its checkout and log are still in: $HOME_DIR"
    exit 0
fi

mkdir -p "$HOME_DIR" "$HOME/Library/LaunchAgents"
cp "$HERE/deploy.sh" "$HOME_DIR/deploy.sh"
chmod +x "$HOME_DIR/deploy.sh"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$HOME_DIR/deploy.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>60</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$HOME_DIR/deploy.log</string>
    <key>StandardErrorPath</key>
    <string>$HOME_DIR/deploy.log</string>
</dict>
</plist>
PLIST

launchctl bootstrap "$DOMAIN" "$PLIST"
echo "This Mac now deploys main in full, a couple of minutes after each push."
echo "Its log: $HOME_DIR/deploy.log"
echo "To stop it: scripts/local/install.sh --remove"
