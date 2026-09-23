# Experiment: fullband denoisers vs DTLN

Question: can an open-source model replace DTLN and bring WorkAdventure's microphone quality closer to Meet, Teams or
Krisp? DTLN runs at 16 kHz, so nothing above 8 kHz is ever sent.

Candidates: DeepFilterNet3 (48 kHz, MIT/Apache-2.0) and DPDFNet (Ceva, 2025, Apache-2.0, 16 and 48 kHz variants).

## Quality (offline, `run_eval.py` → `results.md`)

Main set: 50 random pairs of the VoiceBank+DEMAND test set (48 kHz, CC-BY 4.0).

| model | PESQ-WB | STOI | SI-SDR | DNSMOS OVRL | LSD 8-24 kHz (dB, lower is better) |
|---|---|---|---|---|---|
| noisy input | 2.07 | 0.93 | 9.7 | 2.77 | 12.3 |
| DTLN (prod) | 2.52 | 0.92 | 17.3 | 2.99 | 56.9 (nothing above 8 kHz) |
| **DeepFilterNet3** | **3.22** | **0.95** | **19.2** | **3.23** | **8.9** |
| DPDFNet2 48k | 3.13 | 0.94 | 18.8 | 3.15 | 16.2 |
| DPDFNet8 48k | 3.02 | 0.93 | 18.8 | 3.15 | 17.7 |

On the three real noisy clips in `clips/` (16 kHz sources, DNSMOS OVRL only), DPDFNet8 leads (3.19), then DPDFNet2 48k
(3.09), DFN3 (3.02) and DTLN (2.76).

## Cost in the browser (`fullband-compare.html`)

The page renders a clip through each engine's real AudioWorklet in an `OfflineAudioContext`. Measured on an Apple M4 in
Chrome, one audio thread, restaurant clip, 3 runs:

| engine | real-time factor |
|---|---|
| DTLN (LiteRT.js, 16 kHz) | 0.019–0.020 |
| DeepFilterNet3 (libDF wasm, 48 kHz) | 0.013 |

DPDFNet was not ported to the browser. It needs TFLite resource variables (`VAR_HANDLE`/`ASSIGN_VARIABLE`), and it
costs 0.20 real-time factor natively on one M4 core for the 48k model (DPDFNet2), about 7× DeepFilterNet3. It would not
hold real time in a worklet on an ordinary laptop.

## Conclusion

DeepFilterNet3 is better than DTLN on every metric, sends fullband audio and is cheaper in the browser. DPDFNet is
slightly better on real 16 kHz clips but too heavy for the browser. Recommended next step: add DeepFilterNet3 as an
engine of this package.

## Reproduce

- Browser: `./scripts/fetch-deepfilternet3.sh`, `npm run dev`, open `/fullband-compare.html`. Its "Live" buttons A/B
  the microphone through each engine (use headphones).
- Offline: `uv venv --python 3.11 && uv pip install -r requirements.lock.txt`, then download the VoiceBank+DEMAND test
  set (https://datashare.ed.ac.uk/handle/10283/2791, `clean_testset_wav` and `noisy_testset_wav`) into `vbd/` next to
  `run_eval.py`, run `python run_eval.py`, then `python report.py`. Put the DNSMOS `sig_bak_ovr.onnx` and `model_v8.onnx` in `dnsmos/`, from
  https://github.com/microsoft/DNS-Challenge/tree/master/DNSMOS.

Limits: PESQ, STOI and DNSMOS work at 16 kHz and cannot reward the band above 8 kHz; LSD 8-24 kHz is the only fullband
measure. The sample is small (50 pairs). DeepFilterNet3 ran on whole files offline in Python, so its streaming delay was
not measured there (libDF: 20 ms window, 10 ms hop, 2-frame look-ahead, about 40 ms).
