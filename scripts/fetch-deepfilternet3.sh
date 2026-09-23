#!/bin/sh
# Downloads the DeepFilterNet3 assets used by fullband-compare.html (not committed: ~24 MB).
# - DeepFilterNet3_onnx.tar.gz: official model from github.com/Rikorose/DeepFilterNet (MIT/Apache-2.0).
# - df_bg.wasm: libDF compiled to wasm by mezonai/mezon-noise-suppression. A production build should compile
#   libDF ourselves (cargo + wasm-bindgen) instead of trusting a third-party binary.
set -e
DIR="$(dirname "$0")/../demo/vendor/deepfilternet3"
curl -fL -o "$DIR/DeepFilterNet3_onnx.tar.gz" https://github.com/Rikorose/DeepFilterNet/raw/main/models/DeepFilterNet3_onnx.tar.gz
curl -fL -o "$DIR/df_bg.wasm" https://cdn.mezon.ai/AI/models/datas/noise_suppression/deepfilternet3/v3/pkg/df_bg.wasm
echo "c94d91f70911001c946e0fabb4aa9adc37045f45a03b56008cb0c8244cb63616  $DIR/DeepFilterNet3_onnx.tar.gz" | shasum -a 256 -c -
