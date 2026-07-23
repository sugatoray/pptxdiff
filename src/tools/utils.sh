#!/bin/bash

function reporoot() {
    local topdir=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
    echo "$topdir"
}
