#!/bin/bash
# Deploys main in full, from a Mac that is left on.
#
# A push to main is built and deployed by Cloudflare within a minute, but
# that build has no link preview cards (public/og/ isn't in the repository:
# they are drawn with this Mac's fonts by `npm run og`) and only the
# sitemap as it was last committed. So after every push the full deploy
# (`npm run deploy`: cards, sitemap, build, upload) had to be run by hand.
# This does it: each time it runs it looks at origin/main, and when that
# has moved and then stood still for a few minutes (Cloudflare's own build
# has had its turn, so this one lands last), it deploys it.
#
# It never touches the folder the site is worked on in, which may hold
# someone's unfinished edits. It keeps a checkout of its own under
# ~/Library/Application Support/journal-mahiro-uk, always at origin/main,
# and deploys only that.
#
#   scripts/local/install.sh        run this every two minutes (launchd)
#   scripts/local/deploy.sh --now   deploy origin/main at once, by hand
#
# What it does is written to deploy.log beside the checkout. A deploy that
# fails raises one notification and is tried again half an hour later.

main() {
    set -euo pipefail
    export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

    local home="${JOURNAL_DEPLOY_HOME:-$HOME/Library/Application Support/journal-mahiro-uk}"
    local url="${JOURNAL_REPO_URL:-https://github.com/SmirnovaOyama/journal-mahiro-uk.git}"
    # Seconds main must have stood still before it's deployed from here.
    local wait="${JOURNAL_DEPLOY_WAIT:-180}"
    local checkout="$home/checkout"
    local now_flag="${1:-}"
    mkdir -p "$home"

    # The log keeps its last 2,000 lines once it has grown past 2 MB.
    local log="$home/deploy.log"
    if [ -f "$log" ] && [ "$(stat -f%z "$log")" -gt 2000000 ]; then
        tail -n 2000 "$log" > "$log.keep" && cat "$log.keep" > "$log" && rm -f "$log.keep"
    fi

    # One at a time. A lock left by a run that died is taken over after an hour.
    if ! mkdir "$home/lock" 2>/dev/null; then
        if [ -n "$(find "$home/lock" -maxdepth 0 -mmin +60 2>/dev/null)" ]; then
            rmdir "$home/lock" 2>/dev/null || true
            mkdir "$home/lock"
        else
            exit 0
        fi
    fi
    trap 'rmdir "$home/lock" 2>/dev/null || true' EXIT

    [ -d "$checkout/.git" ] || git clone --quiet "$url" "$checkout"
    cd "$checkout"
    git fetch --quiet origin main
    local head now
    head="$(git rev-parse origin/main)"
    now="$(date +%s)"

    if [ "$now_flag" != "--now" ]; then
        # Already deployed from here.
        [ "$(cat "$home/deployed" 2>/dev/null || true)" = "$head" ] && exit 0
        # New: note when it was first seen, and leave it until it has stood still.
        local seen
        seen="$(cat "$home/seen" 2>/dev/null || true)"
        if [ "${seen%% *}" != "$head" ]; then
            echo "$head $now" > "$home/seen"
            echo "$(date -u +%FT%TZ) main is at ${head:0:8}; deploying once it has stood still for ${wait}s"
            [ "$wait" -gt 0 ] && exit 0
            seen="$head $now"
        fi
        [ $((now - ${seen##* })) -lt "$wait" ] && exit 0
        # Failed not long ago: not again for half an hour.
        local failed
        failed="$(cat "$home/failed" 2>/dev/null || true)"
        [ "${failed%% *}" = "$head" ] && [ $((now - ${failed##* })) -lt 1800 ] && exit 0
    fi

    echo "$(date -u +%FT%TZ) deploying ${head:0:8}"
    if deploy "$home" "$head"; then
        echo "$head" > "$home/deployed"
        rm -f "$home/failed"
        echo "$(date -u +%FT%TZ) deployed ${head:0:8}"
    else
        echo "$head $now" > "$home/failed"
        echo "$(date -u +%FT%TZ) the deploy of ${head:0:8} failed"
        osascript -e 'display notification "The full deploy failed. See deploy.log." with title "journal.mahiro.uk"' 2>/dev/null || true
        exit 1
    fi
}

# The checkout at `head`, with nothing in it the repository doesn't have,
# its dependencies as its lockfile names them, deployed.
deploy() {
    local home="$1" head="$2" lock
    git checkout --quiet --force --detach "$head" || return 1
    git clean -fdxq -e node_modules || return 1
    lock="$(shasum package-lock.json | cut -d' ' -f1)"
    if [ ! -d node_modules ] || [ "$(cat "$home/lockfile" 2>/dev/null || true)" != "$lock" ]; then
        npm ci --no-audit --no-fund || return 1
        echo "$lock" > "$home/lockfile"
    fi
    npm run deploy
}

main "$@"
exit
