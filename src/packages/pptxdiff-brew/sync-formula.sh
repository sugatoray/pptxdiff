#!/usr/bin/env bash
# Bumps a Homebrew formula's `url`/`sha256` pin to match a published npm
# package — the shell-script counterpart to sync-tap.mjs. The formula it
# updates lives at `Formula/<package-name>.rb` relative to this script's
# directory.
#
# Usage:
#   ./sync-formula.sh [PACKAGE_NAME] [--version x.y.z] [--formula Formula/name.rb]
#   ./sync-formula.sh --package PACKAGE_NAME [--version x.y.z]
#
#   PACKAGE_NAME  npm package to resolve (default: pptxdiff). The formula
#                 file updated is `Formula/<PACKAGE_NAME>.rb` by default.
#   --version     pin an exact version; defaults to npm's dist-tags.latest.
#   --formula     formula path to update; defaults to Formula/<PACKAGE_NAME>.rb.
#
# Exits 0 whether or not a change was made; prints "already up to date" and
# leaves the file untouched when the pin already matches.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat >&2 <<EOF
usage: $0 [PACKAGE_NAME] [--version x.y.z] [--formula Formula/name.rb]
       $0 --package PACKAGE_NAME [--version x.y.z] [--formula Formula/name.rb]
EOF
}

PACKAGE_NAME="pptxdiff"
VERSION="latest"
FORMULA_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --package)
      [[ $# -ge 2 ]] || { echo "error: --package requires a value" >&2; usage; exit 2; }
      PACKAGE_NAME="$2"
      shift 2
      ;;
    --version)
      [[ $# -ge 2 ]] || { echo "error: --version requires a value" >&2; usage; exit 2; }
      VERSION="$2"
      shift 2
      ;;
    --formula)
      [[ $# -ge 2 ]] || { echo "error: --formula requires a value" >&2; usage; exit 2; }
      FORMULA_FILE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --*)
      echo "error: unknown argument: $1" >&2
      usage
      exit 2
      ;;
    *)
      if [[ "$PACKAGE_NAME" != "pptxdiff" ]]; then
        echo "error: package name was provided more than once" >&2
        usage
        exit 2
      fi
      PACKAGE_NAME="$1"
      shift
      ;;
  esac
done

if [[ -z "$FORMULA_FILE" ]]; then
  FORMULA_FILE="$SCRIPT_DIR/Formula/$PACKAGE_NAME.rb"
elif [[ "$FORMULA_FILE" != /* ]]; then
  FORMULA_FILE="$SCRIPT_DIR/$FORMULA_FILE"
fi

if [[ ! -f "$FORMULA_FILE" ]]; then
  echo "error: formula not found: $FORMULA_FILE" >&2
  exit 1
fi

command -v npm >/dev/null 2>&1 || { echo "error: npm is required" >&2; exit 1; }
command -v curl >/dev/null 2>&1 || { echo "error: curl is required" >&2; exit 1; }

resolve_version() {
  npm view "$PACKAGE_NAME@$VERSION" version 2>/dev/null
}

resolve_tarball() {
  npm view "$PACKAGE_NAME@$VERSION" dist.tarball 2>/dev/null
}

sha256_of() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

VERSION="$(resolve_version)"
if [[ -z "$VERSION" ]]; then
  echo "error: could not resolve a version for $PACKAGE_NAME" >&2
  exit 1
fi

TARBALL_URL="$(resolve_tarball)"
if [[ -z "$TARBALL_URL" ]]; then
  echo "error: could not resolve a dist.tarball for $PACKAGE_NAME@$VERSION" >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TARBALL_FILE="$TMP_DIR/$PACKAGE_NAME-$VERSION.tgz"
echo "$PACKAGE_NAME@$VERSION: downloading $TARBALL_URL to compute its real sha256..."
curl -fsSL "$TARBALL_URL" -o "$TARBALL_FILE"
SHA256="$(sha256_of "$TARBALL_FILE")"

CURRENT_URL="$(sed -nE 's/^[[:space:]]*url[[:space:]]+"([^"]+)"/\1/p' "$FORMULA_FILE" | head -n1)"
CURRENT_SHA256="$(sed -nE 's/^[[:space:]]*sha256[[:space:]]+"([^"]+)"/\1/p' "$FORMULA_FILE" | head -n1)"

if [[ "$CURRENT_URL" == "$TARBALL_URL" && "$CURRENT_SHA256" == "$SHA256" ]]; then
  echo "$FORMULA_FILE is already up to date with $PACKAGE_NAME@$VERSION."
  exit 0
fi

sed -i.bak -E \
  -e "s|^([[:space:]]*url[[:space:]]+\")[^\"]+|\1$TARBALL_URL|" \
  -e "s|^([[:space:]]*sha256[[:space:]]+\")[^\"]+|\1$SHA256|" \
  "$FORMULA_FILE"
rm -f "$FORMULA_FILE.bak"

echo "Updated $FORMULA_FILE:"
echo "  url:    $CURRENT_URL -> $TARBALL_URL"
echo "  sha256: $CURRENT_SHA256 -> $SHA256"
