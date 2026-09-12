#!/usr/bin/env sh
set -eu

SOURCE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INSTALL_DIR=${AGENT_SKILLS_HOME:-"$HOME/.agent-skills"}
BIN_DIR=${XDG_BIN_HOME:-"$HOME/.local/bin"}

node "$SOURCE_DIR/install.mjs" --prefix "$INSTALL_DIR" "$@"
for ARG in "$@"; do
  if [ "$ARG" = '--dry-run' ]; then exit 0; fi
done
mkdir -p "$BIN_DIR"
LINK="$BIN_DIR/initskill"
if [ -L "$LINK" ]; then
  CURRENT=$(readlink "$LINK")
  if [ "$CURRENT" != "$INSTALL_DIR/initskill" ]; then
    printf 'ปฏิเสธการแทนที่คำสั่งที่มีอยู่: %s\n' "$LINK" >&2
    exit 1
  fi
elif [ -e "$LINK" ]; then
  printf 'มีไฟล์ที่ไม่ใช่ symlink อยู่แล้ว: %s\n' "$LINK" >&2
  exit 1
else
  ln -s "$INSTALL_DIR/initskill" "$LINK"
fi

case ":$PATH:" in
  *":$BIN_DIR:"*) printf 'ติดตั้งแล้ว ใช้คำสั่ง: initskill\n' ;;
  *) printf 'ติดตั้งแล้ว เพิ่ม PATH ครั้งเดียวด้วย:\n  export PATH="%s:$PATH"\n' "$BIN_DIR" ;;
esac
