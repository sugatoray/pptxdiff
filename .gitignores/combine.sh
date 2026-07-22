#!/bin/bash

function combine_gitignores() {
  local topdir=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
  cat "$topdir/.gitignores/"*.gitignore > "$topdir/.gitignore"
}

combine_gitignores;
