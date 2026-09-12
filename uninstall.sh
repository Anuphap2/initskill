#!/usr/bin/env sh
set -eu

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR=${AGENT_SKILLS_HOME:-"$HOME/.agent-skills"}
BIN_DIR=${XDG_BIN_HOME:-"$HOME/.local/bin"}

node "$SOURCE_DIR/uninstall.mjs" --prefix "$INSTALL_DIR" "$@"
for ARG in "$@"; do
  if [ "$ARG" = '--dry-run' ]; then exit 0; fi
done
LINK="$BIN_DIR/initskill"
if [ -L "$LINK" ] && [ "$(readlink "$LINK")" = "$INSTALL_DIR/initskill" ]; then
  rm -- "$LINK"
  printf 'นำคำสั่งลัดออกจาก %s แล้ว\n' "$LINK"
fi
