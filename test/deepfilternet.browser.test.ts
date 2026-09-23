import { describe, expect, test } from "vitest";
import { createDeepFilterNetAudioWorklet, DEEPFILTERNET_SAMPLE_RATE } from "../src/deepfilternet";
import { PauseGate, type PauseGateOptions } from "../src/pause-gate";
import cleanVoiceClipUrl from "../clips/clean-voice.wav?url";

const FRAME = 480;
const GATE: PauseGateOptions = {
  extraAttenuationDb: 20,
  lookaheadFrames: 3,
  hangoverFrames: 10,
  releaseDbPerFrame: 0.6,
  speechAboveFloorDb: 10,
};

function seededNoise(length: number, amplitude: number, seed = 123456789): Float32Array {
  const out = new Float32Array(length);
  let state = seed >>> 0;
  for (let i = 0; i < length; i++) {
    state = (1664525 * state + 1013904223) >>> 0;
    out[i] = ((state / 0xffffffff) * 2 - 1) * amplitude;
  }
  return out;
}

function tone(length: number, amplitude: number, offset = 0): Float32Array {
  return Float32Array.from({ length }, (_, i) => amplitude * Math.sin((2 * Math.PI * 220 * (i + offset)) / 48000));
}

function levelDb(samples: Float32Array): number {
  let energy = 0;
  for (const sample of samples) {
    energy += sample * sample;
  }
  return 10 * Math.log10(energy / samples.length + 1e-12);
}

describe("PauseGate", () => {
  test("delays the signal by the lookahead", () => {
    const gate = new PauseGate(GATE);
    const outputs = Array.from({ length: 4 }, (_, i) => gate.process(tone(FRAME, 0.5, i * FRAME)));

    expect(outputs.slice(0, 3).every((frame) => frame.every((sample) => sample === 0))).toBe(true);
    expect(levelDb(outputs[3]!)).toBeGreaterThan(-20);
  });

  test("attenuates long pauses by the extra attenuation", () => {
    const gate = new PauseGate(GATE);
    let last: Float32Array = new Float32Array(FRAME);
    for (let i = 0; i < 200; i++) {
      last = gate.process(seededNoise(FRAME, 0.01, i + 1));
    }

    expect(levelDb(last)).toBeCloseTo(levelDb(seededNoise(FRAME, 0.01, 200)) - 20, 0);
  });

  test("still closes when the signal starts with digital silence", () => {
    const gate = new PauseGate(GATE);
    for (let i = 0; i < 20; i++) {
      gate.process(new Float32Array(FRAME));
    }
    let last: Float32Array = new Float32Array(FRAME);
    for (let i = 0; i < 60; i++) {
      last = gate.process(seededNoise(FRAME, 0.01, i + 1));
    }

    expect(levelDb(last)).toBeLessThan(levelDb(seededNoise(FRAME, 0.01, 60)) - 15);
  });

  test("is fully open when the first speech frame comes out after a pause", () => {
    const gate = new PauseGate(GATE);
    for (let i = 0; i < 200; i++) {
      gate.process(seededNoise(FRAME, 0.001, i + 1));
    }
    const speech = tone(FRAME, 0.5);
    const outputs = [speech, ...Array.from({ length: 3 }, (_, i) => tone(FRAME, 0.5, (i + 1) * FRAME))].map((frame) =>
      gate.process(frame)
    );

    // The speech frame entered 3 frames ago: it must come out at full level, with no ramp left.
    expect(levelDb(outputs[3]!)).toBeCloseTo(levelDb(speech), 1);
  });
});

describe("DeepFilterNet3 AudioWorklet", () => {
  test("rejects a context that does not run at 48 kHz", async () => {
    const context = new OfflineAudioContext(1, 16000, 16000);

    await expect(createDeepFilterNetAudioWorklet(context)).rejects.toThrow("48000 Hz");
  });

  async function denoise(input: Float32Array): Promise<{ output: Float32Array; frameSamples: number }> {
    const context = new OfflineAudioContext(1, input.length, DEEPFILTERNET_SAMPLE_RATE);
    const handle = await createDeepFilterNetAudioWorklet(context, { bypassUntilReady: false });
    const { frameSamples } = await handle.ready;
    const buffer = new AudioBuffer({
      length: input.length,
      sampleRate: DEEPFILTERNET_SAMPLE_RATE,
      numberOfChannels: 1,
    });
    buffer.getChannelData(0).set(input);
    const source = new AudioBufferSourceNode(context, { buffer });
    source.connect(handle.node).connect(context.destination);
    source.start();
    const output = (await context.startRendering()).getChannelData(0);
    handle.dispose();
    return { output, frameSamples };
  }

  async function loadVoice(): Promise<Float32Array> {
    const decoder = new OfflineAudioContext(1, 1, DEEPFILTERNET_SAMPLE_RATE);
    const bytes = await (await fetch(cleanVoiceClipUrl)).arrayBuffer();
    return (await decoder.decodeAudioData(bytes)).getChannelData(0);
  }

  // Model (~40 ms) + pause gate lookahead (30 ms).
  const DELAY_SAMPLES = 3360;

  test("leaves clean speech untouched", async () => {
    const voice = await loadVoice();
    const { output, frameSamples } = await denoise(voice);

    expect(frameSamples).toBe(480);
    expect(output.every(Number.isFinite)).toBe(true);
    const voiceOut = output.subarray(DELAY_SAMPLES);
    expect(levelDb(voiceOut)).toBeCloseTo(levelDb(voice.subarray(0, voiceOut.length)), 0);
  });

  test("removes noise in pauses and keeps speech in noise", async () => {
    const rate = DEEPFILTERNET_SAMPLE_RATE;
    const voice = await loadVoice();
    // 2 s of noise only, then the voice over the same noise (white noise, ~16 dB below the voice).
    const noise = seededNoise(2 * rate + voice.length, 0.02);
    const input = noise.map((sample, i) => (i < 2 * rate ? sample : sample + voice[i - 2 * rate]!));
    const { output } = await denoise(input);

    // Noise only, once the model and the pause gate have settled (the gate needs ~0.45 s to close):
    // 25 dB limit + 20 dB gate.
    const noiseRange = [rate * 1.5, rate * 1.95] as const;
    expect(levelDb(noise.subarray(...noiseRange)) - levelDb(output.subarray(...noiseRange))).toBeGreaterThan(35);
    // White noise overlaps the whole voice spectrum, so the model trades a few dB of speech for it (4-5 dB here,
    // with or without the gate).
    const voiceOut = output.subarray(2 * rate + DELAY_SAMPLES);
    expect(levelDb(voice.subarray(0, voiceOut.length)) - levelDb(voiceOut)).toBeLessThan(6);
  });
});
