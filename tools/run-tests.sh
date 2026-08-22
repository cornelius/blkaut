#!/bin/sh
# Both test passes: the rules against the solver's solution, and the drag
# handling against the real page in a headless browser.
set -e
cd "$(dirname "$0")/.."

node tools/replay-test.js
tools/tools-test.py

CHROME=${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}
if [ ! -x "$CHROME" ]; then
  echo "skip: no Chrome at $CHROME (set CHROME to override)"
  exit 0
fi

dom=$("$CHROME" --headless --disable-gpu --allow-file-access-from-files \
  --virtual-time-budget=8000 --dump-dom "file://$PWD/tools/drag-test.html" 2>/dev/null)

echo "$dom" | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' | tr ';' '\n' | sed '/^$/d;s/^ *//'
echo "$dom" | grep -q '<title>PASS' || { echo "drag tests failed"; exit 1; }
