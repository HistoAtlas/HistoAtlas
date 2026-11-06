#!/usr/bin/env bash
# Compile the manuscript and the supplement. Run from patterns_research_article/.
set -euo pipefail
cd "$(dirname "$0")/.."
latexmk -pdf -interaction=nonstopmode -halt-on-error main.tex
( cd supplement && latexmk -pdf -interaction=nonstopmode -halt-on-error supplement.tex )
