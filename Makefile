# There is nothing to build; these targets are the test passes.
#
#   make test        every pass
#   make test-rules  each level's recorded solution, replayed through rules.js
#   make test-tools  the level tools, which the game's own tests never touch
#   make test-drag   the real page, driven by synthetic pointer events

CHROME ?= $(shell for browser in \
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
	"/Applications/Chromium.app/Contents/MacOS/Chromium" \
	/usr/bin/google-chrome \
	/usr/bin/google-chrome-stable \
	/usr/bin/chromium \
	/usr/bin/chromium-browser \
	/snap/bin/chromium; \
	do [ -x "$$browser" ] && { echo "$$browser"; break; }; done)

.PHONY: test test-rules test-tools test-drag

test: test-rules test-tools test-drag

test-rules:
	node tools/replay-test.js

test-tools:
	tools/tools-test.py

# No browser is a failure rather than a skip: a pass that quietly does not run
# reads as a pass that ran.
test-drag:
	@test -n "$(CHROME)" || { \
	  echo "no Chrome or Chromium found; set CHROME=/path/to/browser" >&2; exit 1; }
	@dom=$$("$(CHROME)" --headless --disable-gpu --allow-file-access-from-files \
	  --virtual-time-budget=8000 --dump-dom \
	  "file://$(CURDIR)/tools/drag-test.html" 2>/dev/null); \
	echo "$$dom" | sed -n 's/.*<title>\(.*\)<\/title>.*/\1/p' | tr ';' '\n' \
	  | sed '/^$$/d;s/^ *//'; \
	echo "$$dom" | grep -q '<title>PASS' || { echo "drag tests failed" >&2; exit 1; }
