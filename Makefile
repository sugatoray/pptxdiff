# source:
#  - https://code.visualstudio.com/api/working-with-extensions/publishing-extension
#  - https://github.com/microsoft/vscode-vsce/issues/11
#  - https://dev.azure.com/sugatoray/_usersSettings/tokens
#  
# manage vscode extensions: 
#  - https://marketplace.visualstudio.com/manage/publishers/sugatoray

.PHONY: help
.PHONY: info.install.just
.PHONY: install.node install.vsce install.ovsx
.PHONY:	vsix.move vsix.clear
.PHONY: pkg.build pkg.publish pkg.release 
.PHONY: vsce.open vsce.token vsce.metadata
.PHONY: py.clear py.genreadme

########################## Extesion Specific Parameters #############################

VSCE_PUBLISHER := sugatoray
VSCE_NAME := pptxdiff-vscode
PYTHON := python3
NPM_PKG_DIR_RELPATH := .
VSCE_PKG_DIR_RELPATH := ./src/packages/pptxdiff-vscode
MKDOCS_YML_RELPATH := ./src/pptxdiff/docs-site/mkdocs.yml
CLOC_BASE_DIR ?= . ## Optionally set here or via command line: make info.cloc.base CLOC_BASE_DIR=./src

########################## DONOT CHANGE PARAMETERS BELOW ###############################

VSCE_EXTENSION_URL := https://marketplace.visualstudio.com/items?itemName=$(VSCE_PUBLISHER).$(VSCE_NAME)
VSCE_MANAGEMENT_URL := https://marketplace.visualstudio.com/manage/publishers/$(VSCE_PUBLISHER)
VSCE_TOKEN_URL := https://dev.azure.com/$(VSCE_PUBLISHER)/_usersSettings/tokens

SHELL := /bin/bash
remove_trailing_slash = $(patsubst %/,%,$(1))
ROOT_MAKEFILE := $(firstword $(MAKEFILE_LIST))
_ROOT_DIR := $(dir $(abspath $(ROOT_MAKEFILE)))
ROOT_DIR := $(call remove_trailing_slash,$(_ROOT_DIR))
UTILS := source $(ROOT_DIR)/src/tools/utils.sh

NPM_PKG_DIR := $(abspath $(ROOT_DIR)/$(NPM_PKG_DIR_RELPATH))
NPM_PKGJSON_PATH := $(NPM_PKG_DIR)/package.json
NPM_PKG_VERSION := $(shell node -p "require('$(NPM_PKGJSON_PATH)').version")
NPM_PKG_NAME := $(shell node -p "require('$(NPM_PKGJSON_PATH)').name")
NPM_PKG_PATH_LOCAL := dist/$(NPM_PKG_NAME)-$(NPM_PKG_VERSION).tgz

NPM_PACKAGE_URL := https://www.npmjs.com/package/$(NPM_PKG_NAME)
NPM_PACKAGE_VERSION_URL := $(NPM_PACKAGE_URL)/v/$(NPM_PKG_VERSION)

VSCE_PKG_DIR := $(abspath $(ROOT_DIR)/$(VSCE_PKG_DIR_RELPATH))
VSCE_PKGJSON_PATH := $(VSCE_PKG_DIR)/package.json
VSCE_EXT_VERSION := $(shell node -p "require('$(VSCE_PKGJSON_PATH)').version")
VSCE_EXT_NAME := $(shell node -p "require('$(VSCE_PKGJSON_PATH)').name")
VSIX_EXT_PATH_LOCAL := dist/$(VSCE_EXT_NAME)-$(VSCE_EXT_VERSION).vsix

MKDOCS_YML_PATH := $(abspath $(ROOT_DIR)/$(MKDOCS_YML_RELPATH))

####################### DETERMINE VSCODE EDITOR TYPE ###########################

VSCODE_CHANNEL := $(shell \
	if command -v code-insiders >/dev/null 2>&1; then \
		echo insiders; \
	elif echo "$$VSCODE_IPC_HOOK_CLI" | grep -qi insiders; then \
		echo insiders; \
	elif command -v code >/dev/null 2>&1; then \
		echo stable; \
	else \
		echo unknown; \
	fi \
)

VSCODE_CMD := $(shell \
	if [ "$(VSCODE_CHANNEL)" = "insiders" ]; then \
		echo code-insiders; \
	elif [ "$(VSCODE_CHANNEL)" = "stable" ]; then \
		echo code; \
	else \
		echo ""; \
	fi \
)

####################### PARAMETERS ###########################

help:
	@echo "\n:::Makefile Commands' Help:::\n"
	# Commands:
	#
	# info.install.just :	Info on how to install Just
	#
	# install.node      :	Install Node.js
	# install.vsce      :	Install VSCE
	# install.ovsx      :	Install OVSX
	# install.all       :	Install Node.js, VSCE, and OVSX
	#
	# vsix.move         :	Move the .vsix artifact(s) under .artifacts folder.
	# vsix.clear        :	Clear the .vsix files from .artifacts folder.
	#
	# pkg.build         :	Build the extension (creates a.vsix file).
	# pkg.publish       :	Publish the extension.
	# pkg.release       :	Build and Publish the extension.
	#
	# vsce.open         :	Opens the VS Code Extension Management page for a Publisher.
	# vsce.token        :	Opens the Azure DevOps Page to Manage the Personal Access Token for VSCE.
	# vsce.metadata     :	Fetches extension metadata
	# vsce.extn         :	Opens the Marketplace Extension Page in Browser
	# 
	# py.clear          :	Clear off various python artifacts (files/folders)
	# py.genreadme      :	Generate README.md from package.json
	#
	@echo "\n ...: How To Manage Relevant Environment Variables :... \n"
	# 1. Update export VAR="value" lines in ~/.secrets/manage_secrets.sh file.
	# 2. Add the following line to your ~/.bashrc or ~/.zshrc file:
	#    . ~/.secrets/manage_secrets.sh
	# 3. Open a new shell (bash, zsh, etc.)
	# 

############################## ..: COMMANDS s:.. ################################

info.install.just:
	@echo "\n Info: How to install Just... ⏳\n"
	# Refer to: https://github.com/casey/just#installation
	#
	# - generic:
	#   - homebrew: brew install just
	#   - rust: cargo install just
	#   - conda: conda install -c conda-forge just
	# 
	# - macos:
	#   - macports: port install just
	#   - homebrew: brew install just
	#
	# - linux: 
	#   - debian/ubuntu: sudo apt install just
	#   - fedora: sudo dnf install just
	#   - linuxbrew: brew install just
	#
	# - windows: 
	#   - chocolatey: choco install just
	#   - scoop: scoop install just
	@echo "\n"

install.node:
	@echo -e "\n✨ Installing Node.js... ⏳\n"
	brew install npm

install.vsce:
	@echo -e "\n✨ Installing vsce... ⏳\n"
	@# Uninstall existing version of vsce with: npm uninstall -g vsce
	npm install -g @vscode/vsce

install.ovsx:
	@echo -e "\n✨ Installing ovsx... ⏳\n"
	@# Uninstall existing version of ovsx with: npm uninstall -g ovsx
	npm install -g ovsx

.PHONY: load.utils
load.utils:
	@echo -e "\n✨ Loading utils.sh... ⏳\n"
	@$(UTILS); \
	topdir="$$(reporoot)"; \
	echo -e "\n Project Root Directory: $$topdir \n"; \

############################## ..: COMMANDS pkg.*:.. ################################

.PHONY: pkg.npm.bump.pptxdiff
pkg.npm.bump.pptxdiff:
	@## npm version patch
	@echo -e "\n✨ Bumping NPM package version... ⏳\n"
	@cd $(NPM_PKG_DIR) && npm version minor --no-git-tag-version

pkg.npm.build:
	@## npm run build:npm
	@echo -e "\n✨ Building NPM package... ⏳\n"
	@cd $(NPM_PKG_DIR) && npm run build:npm

.PHONY: pkg.npm.pkglockjson
pkg.npm.pkglockjson:
	@## npm run pkglockjson:npm
	@echo -e "\n✨ Updating NPM package-lock.json... ⏳\n"
	@cd $(NPM_PKG_DIR) && npm install --package-lock-only

## NOTE: pkg.npm.publish does not work yet. Use: "npm publish" instead.
.PHONY: pkg.npm.publish
pkg.npm.publish: pkg.npm.build pkg.npm.pkglockjson
	@## npm publish
	@echo -e "\n✨ Publishing NPM package... ⏳\n"
	@cd $(NPM_PKG_DIR) && npm publish $(NPM_PKG_PATH_LOCAL)

.PHONY: pkg.vsce.build
pkg.vsce.build:
	@## npm run package:vscode
	@echo -e "\n✨ Packaging VS Code extension... ⏳\n"	
	@cd $(VSCE_PKG_DIR) && vsce package --out dist/

.PHONY: pkg.vsce.publish
pkg.vsce.publish:
	@## npm run publish:vscode
	@echo -e "\n✨ Publishing VS Code extension... ⏳\n"
	@cd $(VSCE_PKG_DIR) && vsce publish --packagePath $(VSIX_EXT_PATH_LOCAL) -p $(VSCE_PAT)

.PHONY: pkg.vsce.release
pkg.vsce.release: pkg.vsce.build pkg.vsce.publish
	@## npm run release:vscode
	@echo -e "\n✨ Releasing VS Code extension... ⏳\n"
	@make vsce.info.min

.PHONY: pkg.vsce.install.local
pkg.vsce.install.local:
	@## npm run install:vscode:local
	@echo -e "\n✨ Installing VS Code extension locally (from 'dist/' folder)... ⏳\n"
	@echo -e "\n✨ VS Code Type: $(VSCODE_CMD)"
	@$(VSCODE_CMD) --install-extension $(VSCE_PKG_DIR)/$(VSIX_EXT_PATH_LOCAL) --force
	

############################## ..: COMMANDS vsce.*:.. ################################

.PHONY: npm.info
npm.info:
	@echo -e "\n✨ NPM Package Info... ⏳\n"
	@printf " - %s  %-28s %s\n" "🏠"  "Project Root Directory:"    "$(ROOT_DIR)"
	@printf " - %s  %-28s %s\n" "📁"  "Package Dir AbsPath:"       "$(NPM_PKG_DIR)"
	@printf " - %s  %-28s %s\n" "📁"  "Package Dir RelPath:"       "$(NPM_PKG_DIR_RELPATH)"
	@printf " - %s  %-28s %s\n" "🏢"  "Package Publisher:"         "$(NPM_PUBLISHER)"
	@printf " - %s  %-28s %s\n" "🧩"  "Package Name:"              "$(NPM_PKG_NAME)"
	@printf " - %s  %-28s %s\n" "🔖"  "Package Version:"           "$(NPM_PKG_VERSION)"
	@printf " - %s  %-28s %s\n" "📦"  "Package Path:"              "$(NPM_PKG_PATH_LOCAL)"
	@printf " - %s  %-28s %s\n" "🛒"  "Package URL:"               "$(NPM_PACKAGE_URL)"
	@printf " - %s  %-28s %s\n" "⚙️ " "Package Version URL:"       "$(NPM_PACKAGE_VERSION_URL)"
	@printf " - %s  %-28s %s\n" "🔐"  "Package Token URL:"         "$(NPM_TOKEN_URL)"


.PHONY: vsce.info
vsce.info:
	@echo -e "\n✨ VSCE Extension Info... ⏳\n"
	@printf " - %s  %-28s %s\n" "🏠"  "Project Root Directory:"    "$(ROOT_DIR)"
	@printf " - %s  %-28s %s\n" "📁"  "Extension Dir AbsPath:"     "$(VSCE_PKG_DIR)"
	@printf " - %s  %-28s %s\n" "📁"  "Extension Dir RelPath:"     "$(VSCE_PKG_DIR_RELPATH)"
	@printf " - %s  %-28s %s\n" "🏢"  "Extension Publisher:"       "$(VSCE_PUBLISHER)"
	@printf " - %s  %-28s %s\n" "🧩"  "Extension Name:"            "$(VSCE_EXT_NAME)"
	@printf " - %s  %-28s %s\n" "🔖"  "Extension Version:"         "$(VSCE_EXT_VERSION)"
	@printf " - %s  %-28s %s\n" "📦"  "Extension VSIX Path:"       "$(VSCE_PKG_DIR_RELPATH)/$(VSIX_EXT_PATH_LOCAL)"
	@printf " - %s  %-28s %s\n" "🛒"  "Extension Marketplace URL:" "$(VSCE_EXTENSION_URL)"
	@printf " - %s  %-28s %s\n" "⚙️ " "Extension Management URL:"  "$(VSCE_MANAGEMENT_URL)"
	@printf " - %s  %-28s %s\n" "🔐"  "Extension Token URL:"       "$(VSCE_TOKEN_URL)"

.PHONY: vsce.info.min
vsce.info.min:
	@echo -e "\n✨ VSCE Extension Info (Minimal)... ⏳\n"
	@printf " - %s  %-28s %s\n" "🏢"  "Extension Publisher:"       "$(VSCE_PUBLISHER)"
	@printf " - %s  %-28s %s\n" "🧩"  "Extension Name:"            "$(VSCE_EXT_NAME)"
	@printf " - %s  %-28s %s\n" "🔖"  "Extension Version:"         "$(VSCE_EXT_VERSION)"

vsce.open:
	@echo -e "\n✨ Open VS Code Extension Manager in Browser... ⏳\n"
	$(PYTHON) -c "import webbrowser; webbrowser.open('$(VSCE_MANAGEMENT_URL)')"

vsce.token:
	@echo -e "\n✨ Open VS Code Extension Token Manager in Browser... ⏳\n"
	$(PYTHON) -c "import webbrowser; webbrowser.open('$(VSCE_TOKEN_URL)')"

vsce.metadata:
	@echo -e "\n✨ Show VS Code Extension Metadata... ⏳\n"
	vsce show $(VSCE_PUBLISHER).$(VSCE_EXT_NAME)

vsce.extn:
	@echo -e "\n✨ Open VS Code Extension Marketplace in Browser... ⏳\n"
	$(PYTHON) -c "import webbrowser; webbrowser.open('$(VSCE_MANAGEMENT_URL)')"

## Clear repository of python artifacts

.PHONY: py.clear
py.clear: # Clear off various python artifacts (files/folders)
	@echo -e "\n✨ Clear artifact files... ⏳\n"
	@echo -e "\n🟢 Clear .ipynb_checkpoints files"
	@# same as:
	@# find **/.ipynb_checkpoints type -f -delete
	@# source:
	@# - https://askubuntu.com/a/842170/853549
	rm -rf ./.ipynb_checkpoints ./**/.ipynb_checkpoints
	
	@echo -e "\n🟢 Clear __pycache__ folders"
	@# same as:
	@# find **/__pycache__ -delete
	rm -rf ./__pycache__ \
		./**/__pycache__ \
		./**/**/__pycache__

.PHONY: chore.update.gitignore
chore.update.gitignore:
	@echo -e "\n✨ Update .gitignore file... ⏳\n"
	@source "$(ROOT_DIR)/.gitignores/combine.sh"


############################### ..: COMMANDS info.cloc.*:.. ############################

## INFO: Counting Lines of Code
## Source:
## - https://github.com/pajecawav/ghloc-web
## - https://ghloc.vercel.app/sugatoray/pptxdiff?branch=master
## - https://shields.io/badges/endpoint-badge
## - ![Endpoint Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fghloc.vercel.app%2Fapi%2Fsugatoray%2Fpptxdiff%2Fbadge)
## - https://ghloc.vercel.app/api/sugatoray/pptxdiff/badge
## - https://img.shields.io/endpoint?url=https%3A%2F%2Fghloc.vercel.app%2Fapi%2Fsugatoray%2Fpptxdiff%2Fbadge
## - https://img.shields.io/endpoint?url=https://ghloc.vercel.app/api/sugatoray/pptxdiff/badge

## NOTE: CLOC (Count Lines of Code) is a command line tool that counts blank lines, comment lines, and physical lines of source code in many programming languages.

.PHONY: info.cloc.base
info.cloc.base:
	@echo -e "\n💡 Install CLOC as: ... ⏳\n\n    ⚙️  brew install cloc \n"
	@echo -e "\n✨ Show CLOC Info | Folder: $(CLOC_BASE_DIR) ... ⏳\n"
	@cloc $(CLOC_BASE_DIR) \
		--not-match-d='src/pptxdiff/vendor' \
		--exclude-dir=.git,node_modules,dist,build,site,__pycache__

.PHONY: info.cloc.src
info.cloc.src:
	@## Cloc Report from: ./src
	@$(MAKE) info.cloc.base CLOC_BASE_DIR=./src

.PHONY: info.cloc.all
info.cloc.all:
	@## Cloc Report from: REPO_ROOT
	@$(MAKE) info.cloc.base CLOC_BASE_DIR=.

## Example Output:
## ❯ make info.cloc.src
## 
## 💡 Install CLOC as: ... ⏳
## 
##     ⚙️  brew install cloc 
## 
## 
## ✨ Show CLOC Info | Folder: ./src ... ⏳
## 
##      114 text files.
##      103 unique files.                                          
##       43 files ignored.
## 
## github.com/AlDanial/cloc v 2.10  T=0.41 s (251.6 files/s, 189264.2 lines/s)
## -------------------------------------------------------------------------------
## Language                     files          blank        comment           code
## -------------------------------------------------------------------------------
## JavaScript                      47            548           2388          65682
## HTML                             1            115             23           4216
## Markdown                        36            680             12           2203
## Python                           7            145            146            517
## JSON                             7              0              0            414
## YAML                             2              8              9            235
## Text                             1             18              0             75
## CSS                              1              0              9             28
## Bourne Shell                     1              1              0              5
## -------------------------------------------------------------------------------
## SUM:                           103           1515           2587          73375
## -------------------------------------------------------------------------------

############################## ..: COMMANDS docs.*:.. ############################

.PHONY: docs.build
docs.build:
	@echo -e "\n✨ Generate Documentaion using MkDocs-Material... ⏳\n"
	@cd $(VSCE_PKG_DIR) && uv run --group docs mkdocs build -f $(MKDOCS_YML_PATH)

.PHONY: docs.serve
docs.serve:
	@echo -e "\n✨ Serve Documentaion using MkDocs-Material... ⏳\n"
	@cd $(VSCE_PKG_DIR) && uv run --group docs mkdocs serve -f $(MKDOCS_YML_PATH)

############################## ..: COMMANDS trial.*:.. ############################

.PHONY: trial.vsce.info
# Check the vsce.info equivalent using @echo: It does not behave as well as @printf in vsce.info.
trial.vsce.info:
	@echo -e "\n✨ VSCE Extension Info... ⏳\n"
	@echo " - 🏠  "  "Project Root Directory: $(ROOT_DIR)"
	@echo " - 📁  "  "Extension Dir AbsPath: $(VSCE_PKG_DIR)"
	@echo " - 📁  "  "Extension Dir RelPath: $(VSCE_PKG_DIR_RELPATH)"
	@echo " - 🏢  "  "Extension Publisher: $(VSCE_PUBLISHER)"
	@echo " - 🧩  "  "Extension Name: $(VSCE_EXT_NAME)"
	@echo " - 🔖  "  "Extension Version: $(VSCE_EXT_VERSION)"
	@echo " - 📦  "  "Extension VSIX Path: $(VSIX_EXT_PATH)"
	@echo " - 🛒  "  "Extension Marketplace URL: $(VSCE_EXTENSION_URL)"
	@echo " - ⚙️   " "Extension Management URL: $(VSCE_MANAGEMENT_URL)"
	@echo " - 🔐  "  "Extension Token URL: $(VSCE_TOKEN_URL)"
