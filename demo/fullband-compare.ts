// Experiment: DTLN (current, 16 kHz) vs DeepFilterNet3 (48 kHz fullband), same clip, same browser.
// Each engine renders the whole clip through its real AudioWorklet in an OfflineAudioContext, so
// render time / clip duration is the real-time factor of one audio thread (lower is better, must stay well under 1).
import FFT from "fft.js";
import { createNoiseSuppressionAudioWorklet } from "../src/audio-worklet";
import { createDeepFilterNetAudioWorklet } from "../src/deepfilternet";

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

async function createEngine(context: BaseAudioContext, engine: Engine): Promise<EngineGraph> {
  if (engine === "dtln") {
    const handle = await createNoiseSuppressionAudioWorklet(context, { bypassUntilReady: false });
    await handle.ready;
    return { node: handle.node, dispose: () => handle.dispose() };
  }
  if (engine === "dfn3") {
    // The packaged engine, exactly what applications get.
    const handle = await createDeepFilterNetAudioWorklet(context, {
      bypassUntilReady: false,
      speechAttenuationDb: Number(attenInput.value),
      pauseAttenuationDb: Number(silenceAttenInput.value),
    });
    await handle.ready;
    return { node: handle.node, dispose: () => handle.dispose() };
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
  window.clearInterval(statsTimer);
  live.graph.dispose();
  live.stream.getTracks().forEach((track) => track.stop());
  await live.context.close();
  live = undefined;
}

const statsEl = document.querySelector<HTMLParagraphElement>("#stats")!;
let statsTimer: number | undefined;

interface PlaybackStats {
  underrunEvents: number;
  underrunDuration: number;
}

async function startLive(engine: Engine, showStats: boolean) {
  await stopLive();
  const context = new AudioContext({ sampleRate: sampleRateOf(engine), latencyHint: "interactive" });
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, autoGainControl: true, noiseSuppression: false, channelCount: 1 },
  });
  const graph = await createEngine(context, engine);
  context.createMediaStreamSource(stream).connect(graph.node).connect(context.destination);
  live = { context, stream, graph };

  // Real audio glitches (the output ran dry because processing was late), where the browser reports them.
  window.clearInterval(statsTimer);
  statsEl.textContent = "";
  if (showStats) {
    const startedAt = performance.now();
    statsTimer = window.setInterval(() => {
      const stats = (context as unknown as { playbackStats?: PlaybackStats }).playbackStats;
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(0);
      statsEl.textContent = stats
        ? `${engine}, ${seconds} s: ${stats.underrunEvents} audio glitches ` +
          `(${(stats.underrunDuration * 1000).toFixed(0)} ms in total). 0 = the machine keeps up.`
        : "This browser does not report audio glitches (AudioContext.playbackStats): use a recent Chrome.";
    }, 1000);
  }
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
