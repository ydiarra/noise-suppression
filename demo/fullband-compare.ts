// Experiment: DTLN (current, 16 kHz) vs DeepFilterNet3 (48 kHz fullband), same clip, same browser.
// Each engine renders the whole clip through its real AudioWorklet in an OfflineAudioContext, so
// render time / clip duration is the real-time factor of one audio thread (lower is better, must stay well under 1).
import FFT from "fft.js";
import { createNoiseSuppressionAudioWorklet } from "../src/audio-worklet";
import dfnWorkletUrl from "./vendor/deepfilternet3/dfn3-worklet-processor.js?url";
import dfnWasmUrl from "./vendor/deepfilternet3/df_bg.wasm?url";
import dfnModelUrl from "./vendor/deepfilternet3/DeepFilterNet3_onnx.tar.gz?url";

import restaurantClipUrl from "../clips/restaurant_noisy.wav?url";
import dogBarkingClipUrl from "../clips/dog_barking_noisy.wav?url";
import helicopterClipUrl from "../clips/trump_vs_helicopter.wav?url";
import airConditioningClipUrl from "../clips/airconditioning.wav?url";
import cleanVoiceClipUrl from "../clips/clean-voice.wav?url";
import whiteNoiseClipUrl from "../clips/white-noise-15s.wav?url";

const CLIPS: Record<string, string> = {
  "restaurant_noisy.wav": restaurantClipUrl,
  "dog_barking_noisy.wav": dogBarkingClipUrl,
  "trump_vs_helicopter.wav": helicopterClipUrl,
  "airconditioning.wav": airConditioningClipUrl,
  "clean-voice.wav": cleanVoiceClipUrl,
  "white-noise-15s.wav": whiteNoiseClipUrl,
};

type Engine = "raw" | "dtln" | "dfn3";

interface EngineGraph {
  node: AudioNode;
  dispose(): void;
}

const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const clipSelect = document.querySelector<HTMLSelectElement>("#clip")!;
const attenInput = document.querySelector<HTMLInputElement>("#atten")!;
const silenceAttenInput = document.querySelector<HTMLInputElement>("#atten-silence")!;
const resultsEl = document.querySelector<HTMLTableSectionElement>("#results")!;
const runButton = document.querySelector<HTMLButtonElement>("#run")!;

for (const clip of Object.keys(CLIPS)) {
  clipSelect.add(new Option(clip, clip));
}
for (const noise of ["airconditioning.wav", "restaurant_noisy.wav", "white-noise-15s.wav"]) {
  clipSelect.add(new Option(`clean voice + ${noise} (5 dB)`, `mix:${noise}`));
}

let dfnAssets: Promise<{ wasmModule: WebAssembly.Module; modelBytes: ArrayBuffer }> | undefined;

function loadDfnAssets() {
  dfnAssets ??= (async () => {
    const [wasmModule, modelBytes] = await Promise.all([
      WebAssembly.compileStreaming(fetch(dfnWasmUrl)),
      fetch(dfnModelUrl).then((response) => {
        if (!response.ok) {
          throw new Error("DeepFilterNet3 assets missing: run scripts/fetch-deepfilternet3.sh");
        }
        return response.arrayBuffer();
      }).then(ensureGzipped),
    ]);
    return { wasmModule, modelBytes };
  })();
  return dfnAssets;
}

// libDF wants the .tar.gz bytes, but a server that sends `Content-Encoding: gzip` (Vite does) makes the browser
// hand us the inflated .tar. Re-gzip in that case.
async function ensureGzipped(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const head = new Uint8Array(bytes, 0, 2);
  if (head[0] === 0x1f && head[1] === 0x8b) {
    return bytes;
  }
  const gzipped = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(gzipped).arrayBuffer();
}

interface FrameStats {
  frames: number;
  maxMs: number;
  over5Ms: number;
  over10Ms: number;
}

async function createEngine(
  context: BaseAudioContext,
  engine: Engine,
  onStats?: (stats: FrameStats) => void
): Promise<EngineGraph> {
  if (engine === "dtln") {
    const handle = await createNoiseSuppressionAudioWorklet(context, { bypassUntilReady: false });
    await handle.ready;
    return { node: handle.node, dispose: () => handle.dispose() };
  }
  if (engine === "dfn3") {
    const { wasmModule, modelBytes } = await loadDfnAssets();
    await context.audioWorklet.addModule(dfnWorkletUrl);
    const node = new AudioWorkletNode(context, "deepfilter-audio-processor", {
      channelCount: 1,
      channelCountMode: "explicit",
      outputChannelCount: [1],
      processorOptions: {
        wasmModule,
        modelBytes: modelBytes.slice(0),
        suppressionLevel: Number(attenInput.value),
        pauseGate:
          Number(silenceAttenInput.value) > Number(attenInput.value)
            ? {
                extraDb: Number(silenceAttenInput.value) - Number(attenInput.value),
                lookaheadFrames: 3, // 30 ms of added latency
                hangoverFrames: 10, // 100 ms
                releaseDbPerFrame: 0.6, // 60 dB/s
                speechAboveFloorDb: 10,
                // Tuning hook for the experiment (window.adaptiveTuning = { ... }).
                ...(window as unknown as { adaptiveTuning?: object }).adaptiveTuning,
              }
            : undefined,
      },
    });
    await new Promise<void>((resolve, reject) => {
      node.port.onmessage = (event: MessageEvent<{ type: string; message?: string }>) => {
        if (event.data.type === "ready") {
          resolve();
        } else if (event.data.type === "stats") {
          onStats?.(event.data as unknown as FrameStats);
        } else {
          reject(new Error(`DeepFilterNet3 failed to initialize: ${event.data.message}`));
        }
      };
    });
    return { node, dispose: () => node.disconnect() };
  }
  const node = new GainNode(context);
  return { node, dispose: () => node.disconnect() };
}

function sampleRateOf(engine: Engine): number {
  return engine === "dtln" ? 16000 : 48000;
}

// "mix:<noise clip>": clean-voice.wav three times with 0.8 s and 1.5 s pauses, plus that noise at 5 dB SNR (over
// speech), so where the speech is is known exactly.
async function decodeClip(clip: string, sampleRate: number): Promise<AudioBuffer> {
  if (clip.startsWith("mix:")) {
    const noiseClip = clip.slice(4);
    const [voice, noise] = await Promise.all([
      decodeClip("clean-voice.wav", sampleRate),
      // "mix:none" is the same speech track without noise (the reference for measurements).
      decodeClip(noiseClip === "none" ? "clean-voice.wav" : noiseClip, sampleRate),
    ]);
    const once = voice.getChannelData(0);
    const pauses = [0.8, 1.5].map((seconds) => Math.round(seconds * sampleRate));
    const speech = new Float32Array(once.length * 3 + pauses[0]! + pauses[1]!);
    speech.set(once, 0);
    speech.set(once, once.length + pauses[0]!);
    speech.set(once, once.length * 2 + pauses[0]! + pauses[1]!);
    const noiseData = noise.getChannelData(0);
    const power = (data: Float32Array) => data.reduce((sum, v) => sum + v * v, 0) / data.length;
    const gain = noiseClip === "none" ? 0 : Math.sqrt(power(once) / power(noiseData.subarray(0, once.length)) / 10 ** (5 / 10));
    const mixed = new AudioBuffer({ length: speech.length, sampleRate, numberOfChannels: 1 });
    mixed.getChannelData(0).set(speech.map((v, i) => v + gain * noiseData[i % noiseData.length]!));
    return mixed;
  }
  return decodeRawClip(clip, sampleRate);
}

async function decodeRawClip(clip: string, sampleRate: number): Promise<AudioBuffer> {
  const bytes = await fetch(CLIPS[clip]!).then((response) => response.arrayBuffer());
  // decodeAudioData resamples to the context rate.
  return new OfflineAudioContext(1, 1, sampleRate).decodeAudioData(bytes);
}

async function renderOffline(engine: Engine, clip: string) {
  const sampleRate = sampleRateOf(engine);
  const input = await decodeClip(clip, sampleRate);
  const context = new OfflineAudioContext(1, input.length, sampleRate);
  const graph = await createEngine(context, engine);
  const source = new AudioBufferSourceNode(context, { buffer: input });
  source.connect(graph.node).connect(context.destination);
  source.start();

  const startMs = performance.now();
  const output = await context.startRendering();
  const renderMs = performance.now() - startMs;
  graph.dispose();

  return { output, renderMs, durationMs: input.duration * 1000 };
}

function highBandShare(buffer: AudioBuffer): number {
  // Share of spectral energy above 8 kHz: what a 16 kHz pipeline can never send.
  const size = 2048;
  const fft = new FFT(size);
  const spectrum = fft.createComplexArray();
  const cutoffBin = Math.round((8000 / buffer.sampleRate) * size);
  const data = buffer.getChannelData(0);
  let high = 0;
  let total = 0;
  for (let offset = 0; offset + size <= data.length; offset += size) {
    fft.realTransform(spectrum, data.subarray(offset, offset + size));
    for (let bin = 1; bin < size / 2; bin++) {
      const power = spectrum[2 * bin]! ** 2 + spectrum[2 * bin + 1]! ** 2;
      total += power;
      if (bin >= cutoffBin) {
        high += power;
      }
    }
  }
  return total > 0 ? high / total : 0;
}

function toWavUrl(buffer: AudioBuffer): string {
  const samples = buffer.getChannelData(0);
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => {
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
  });
  return URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
}

runButton.addEventListener("click", async () => {
  runButton.disabled = true;
  resultsEl.replaceChildren();
  const clip = clipSelect.value;
  const results: Record<string, unknown>[] = [];
  try {
    for (const engine of ["raw", "dtln", "dfn3"] as const) {
      statusEl.textContent = `Rendering ${clip} with ${engine}...`;
      const { output, renderMs, durationMs } = await renderOffline(engine, clip);
      const rtf = renderMs / durationMs;
      const highBand = highBandShare(output);
      results.push({ engine, clip, sampleRate: output.sampleRate, durationMs, renderMs, rtf, highBand });

      const row = resultsEl.insertRow();
      row.insertCell().textContent = engine;
      row.insertCell().textContent = `${output.sampleRate / 1000} kHz`;
      row.insertCell().textContent = engine === "raw" ? "—" : rtf.toFixed(3);
      row.insertCell().textContent = `${(highBand * 100).toFixed(1)} %`;
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.src = toWavUrl(output);
      row.insertCell().append(audio);
    }
    statusEl.textContent = "Done. RTF = render time / clip duration on one audio thread.";
  } catch (error) {
    statusEl.textContent = `Failed: ${error instanceof Error ? error.message : String(error)}`;
    console.error(error);
  } finally {
    (window as unknown as { fullbandResults: unknown }).fullbandResults = results;
    runButton.disabled = false;
  }
});

// Live A/B: microphone -> engine -> speakers. Use headphones.
let live: { context: AudioContext; stream: MediaStream; graph: EngineGraph } | undefined;

async function stopLive() {
  if (!live) {
    return;
  }
  live.graph.dispose();
  live.stream.getTracks().forEach((track) => track.stop());
  await live.context.close();
  live = undefined;
}

const statsEl = document.querySelector<HTMLParagraphElement>("#stats")!;

async function startLive(engine: Engine, showStats: boolean) {
  await stopLive();
  const context = new AudioContext({ sampleRate: sampleRateOf(engine), latencyHint: "interactive" });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: false, channelCount: 1 },
  });
  statsEl.textContent = "";
  const graph = await createEngine(context, engine, (stats) => {
    if (showStats) {
      statsEl.textContent =
        `DeepFilterNet3: ${stats.frames} frames of 10 ms, worst ${stats.maxMs} ms, ` +
        `${stats.over5Ms} over 5 ms, ${stats.over10Ms} over 10 ms (over 10 ms = cannot keep up).`;
    }
  });
  context.createMediaStreamSource(stream).connect(graph.node).connect(context.destination);
  live = { context, stream, graph };
}

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-live]")) {
  button.addEventListener("click", async () => {
    const engine = button.dataset["live"] as Engine | "stop";
    if (engine === "stop") {
      await stopLive();
      statusEl.textContent = "Live stopped.";
      return;
    }
    await startLive(engine, true);
    statusEl.textContent = `Live: ${engine} at ${sampleRateOf(engine) / 1000} kHz (headphones!).`;
  });
}

// Blind A/B/C: letters map to a random order of engines until "Reveal".
const blindEngines: Engine[] = ["raw", "dtln", "dfn3"];
let blindOrder: Engine[] = [];
const blindRevealEl = document.querySelector<HTMLParagraphElement>("#blind-reveal")!;
const blindNotesEl = document.querySelector<HTMLTextAreaElement>("#blind-notes")!;

function shuffleBlind() {
  blindOrder = [...blindEngines].sort(() => Math.random() - 0.5);
  blindRevealEl.textContent = "";
}
shuffleBlind();

for (const button of document.querySelectorAll<HTMLButtonElement>("[data-blind]")) {
  button.addEventListener("click", async () => {
    const index = Number(button.dataset["blind"]);
    await startLive(blindOrder[index]!, false);
    statusEl.textContent = `Blind: listening to ${"ABC"[index]}.`;
  });
}

document.querySelector("#blind-shuffle")!.addEventListener("click", async () => {
  await stopLive();
  shuffleBlind();
  statusEl.textContent = "New blind order. Rate A, B and C again for the next situation.";
});

document.querySelector("#blind-reveal-button")!.addEventListener("click", async () => {
  await stopLive();
  const mapping = blindOrder.map((engine, i) => `${"ABC"[i]} = ${engine}`).join(", ");
  blindRevealEl.textContent = mapping;
  blindNotesEl.value += `${blindNotesEl.value ? "\n" : ""}[${mapping}] ${navigator.userAgent}`;
});

statusEl.textContent = "Ready.";
