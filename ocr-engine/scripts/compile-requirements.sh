#!/bin/sh
set -eu

cd /workspace
python -m pip install --disable-pip-version-check --no-cache-dir pip-tools==7.5.3
pip-compile --generate-hashes --allow-unsafe --resolver=backtracking --strip-extras \
  --output-file ocr-engine/requirements.txt ocr-engine/requirements.in
pip-compile --generate-hashes --allow-unsafe --resolver=backtracking --strip-extras \
  --output-file ocr-engine/requirements-dev.txt ocr-engine/requirements-dev.in
pip-compile --generate-hashes --allow-unsafe --resolver=backtracking --strip-extras \
  --output-file ocr-engine/requirements-converter.txt \
  ocr-engine/requirements-converter.in
