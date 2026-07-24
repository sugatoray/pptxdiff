#!/bin/bash

function reporoot() {
    local topdir=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
    echo "${topdir}"
}

function combine_gitignores() {
    local topdir=$(reporoot)
    cat "${topdir}/.gitignores/"*.gitignore > "$topdir/.gitignore"
}

combine_gitignores
