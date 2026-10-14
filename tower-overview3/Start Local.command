#!/bin/bash
cd -- "$(dirname -- "$0")/website" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required. Install it from https://www.python.org/downloads/."
  read -r -p "Press Enter to close."
  exit 1
fi
python3 scripts/serve.py "$@"
status=$?
if [ "$status" -ne 0 ]; then
  read -r -p "Press Enter to close."
fi
exit "$status"
