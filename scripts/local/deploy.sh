#!/bin/bash
# Deploys main in full, from a Mac that is left on.
#
# A push to main is built and deployed by Cloudflare within a minute, but
# that build has no link preview cards (public/og/ isn't in the repository:
# they are drawn with this Mac's fonts by `npm run og`) and only the
# sitemap as it was last committed. So after every push the full deploy
# (`npm run deploy`: cards, sitemap, build, upload) had to be run by hand.
# This does it: each time it runs it looks at origin/main, and when that
# has moved and then stood still for a minute and a half (Cloudflare's own
# build has had its turn, so this one lands last), it deploys it.
#
# It also looks, every ten minutes, at whether the site still has its
# cards, and deploys again when it doesn't: whatever took them away (a
# build of Cloudflare's that landed late, a deploy from somewhere else),
# they come back.
#
# It never touches the folder the site is worked on in, which may hold
# someone's unfinished edits. It keeps a checkout of its own under
# ~/Library/Application Support/journal-mahiro-uk, always at origin/main,
# and deploys only that.
#
#   scripts/local/install.sh        run this every minute (launchd)
#   scripts/local/deploy.sh --now   deploy origin/main at once, by hand
#
# What it does is written to deploy.log beside the checkout. A deploy that
# fails raises one notification and is tried again half an hour later.

set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Not `local`: the lock is let go as the script exits, after every function
# has returned, and has to be found then.
STATE="${JOURNAL_DEPLOY_HOME:-$HOME/Library/Application Support/journal-mahiro-uk}"
REPO_URL="${JOURNAL_REPO_URL:-https://github.com/SmirnovaOyama/journal-mahiro-uk.git}"
SITE="${JOURNAL_SITE_URL:-https://journal.mahiro.uk}"
# Seconds main must have stood still before it's deployed from here.
WAIT="${JOURNAL_DEPLOY_WAIT:-90}"
# What deploying is. Only a test sets it to something else.
DEPLOY="${JOURNAL_DEPLOY_CMD:-npm run deploy}"
CHECKOUT="$STATE/checkout"

say() { echo "$(date -u +%FT%TZ) $*"; }

# The checkout at `head`, with nothing in it the repository doesn't have,
# its dependencies as its lockfile names them, deployed.
deploy() {
    local head="$1" lock
    git checkout --quiet --force --detach "$head" || return 1
    git clean -fdxq -e node_modules || return 1
    lock="$(shasum package-lock.json | cut -d' ' -f1)"
    if [ ! -d node_modules ] || [ "$(cat "$STATE/lockfile" 2>/dev/null || true)" != "$lock" ]; then
        npm ci --no-audit --no-fund || return 1
        echo "$lock" > "$STATE/lockfile"
    fi
    $DEPLOY
}

# Whether the site has lost its cards. Asked at most every ten minutes, and
# never answered yes on a guess: no connection, or anything but a page
# where a picture should be, is a no.
cards_gone() {
    local now="$1" last type
    last="$(cat "$STATE/looked" 2>/dev/null || echo 0)"
    [ $((now - last)) -lt 600 ] && return 1
    echo "$now" > "$STATE/looked"
    type="$(curl -s -m 20 -o /dev/null -w '%{http_code} %{content_type}' "$SITE/og/site.png" 2>/dev/null || true)"
    case "$type" in
        "200 text/html"*) return 0 ;;
        *) return 1 ;;
    esac
}

main() {
    local now_flag="${1:-}" head now seen failed why=""
    mkdir -p "$STATE"

    # The log keeps its last 2,000 lines once it has grown past 2 MB.
    local log="$STATE/deploy.log"
    if [ -f "$log" ] && [ "$(stat -f%z "$log")" -gt 2000000 ]; then
        tail -n 2000 "$log" > "$log.keep" && cat "$log.keep" > "$log" && rm -f "$log.keep"
    fi

    # One at a time. A lock left by a run that died is taken over after an hour.
    if ! mkdir "$STATE/lock" 2>/dev/null; then
        [ -n "$(find "$STATE/lock" -maxdepth 0 -mmin +60 2>/dev/null)" ] || exit 0
        rmdir "$STATE/lock" 2>/dev/null || true
        mkdir "$STATE/lock"
    fi
    trap 'rmdir "$STATE/lock" 2>/dev/null || true' EXIT

    [ -d "$CHECKOUT/.git" ] || git clone --quiet "$REPO_URL" "$CHECKOUT"
    cd "$CHECKOUT"
    git fetch --quiet origin main
    head="$(git rev-parse origin/main)"
    now="$(date +%s)"

    if [ "$now_flag" != "--now" ]; then
        if [ "$(cat "$STATE/deployed" 2>/dev/null || true)" = "$head" ]; then
            # Already deployed from here. Still there, cards and all?
            cards_gone "$now" || exit 0
            why=" again: the site has lost its cards"
        else
            # New: note when it was first seen, and leave it until it has stood still.
            seen="$(cat "$STATE/seen" 2>/dev/null || true)"
            if [ "${seen%% *}" != "$head" ]; then
                echo "$head $now" > "$STATE/seen"
                say "main is at ${head:0:8}; deploying once it has stood still for ${WAIT}s"
                seen="$head $now"
            fi
            [ $((now - ${seen##* })) -lt "$WAIT" ] && exit 0
        fi
        # Failed not long ago: not again for half an hour.
        failed="$(cat "$STATE/failed" 2>/dev/null || true)"
        [ "${failed%% *}" = "$head" ] && [ $((now - ${failed##* })) -lt 1800 ] && exit 0
    fi

    say "deploying ${head:0:8}${why}"
    if deploy "$head"; then
        echo "$head" > "$STATE/deployed"
        date +%s > "$STATE/looked"
        rm -f "$STATE/failed"
        say "deployed ${head:0:8}"
    else
        echo "$head $now" > "$STATE/failed"
        say "the deploy of ${head:0:8} failed"
        osascript -e 'display notification "The full deploy failed. See deploy.log." with title "journal.mahiro.uk"' 2>/dev/null || true
        exit 1
    fi
}

main "$@"
exit
