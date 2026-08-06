/**
 * Browser voice capture for the Construction Copilot.
 *
 * We deliberately do NOT use MediaRecorder: Chrome records audio/webm and iOS
 * Safari records fragmented audio/mp4, and neither decodes reliably server-side.
 * Instead we capture raw PCM with the Web Audio API and encode a complete,
 * 16 kHz mono 16-bit WAV file — the format Sarvam AI's STT accepts everywhere.
 */

const TARGET_RATE = 16000;

function downsample(input: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (outputRate >= inputRate) return input;
  const ratio = inputRate / outputRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = end > start ? sum / (end - start) : 0;
  }
  return out;
}

function encodeWav(chunks: Float32Array[], inputRate: number): Blob {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  const samples = downsample(merged, inputRate, TARGET_RATE);

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(pos + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    pos += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface Recorder {
  stop: () => Promise<Blob>;
  cancel: () => void;
  /** 0..1 live input level, for the waveform indicator. */
  level: () => number;
}

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  let live = true;

  processor.onaudioprocess = (e) => {
    if (!live) return;
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };

  source.connect(analyser);
  source.connect(processor);
  // Muted sink: ScriptProcessor only fires while connected to the graph.
  const silent = ctx.createGain();
  silent.gain.value = 0;
  processor.connect(silent);
  silent.connect(ctx.destination);

  const levelData = new Uint8Array(analyser.frequencyBinCount);

  const teardown = () => {
    live = false;
    processor.onaudioprocess = null;
    try {
      processor.disconnect();
      silent.disconnect();
      analyser.disconnect();
      source.disconnect();
    } catch {
      /* noop */
    }
    stream.getTracks().forEach((t) => t.stop());
  };

  return {
    level() {
      analyser.getByteTimeDomainData(levelData);
      let peak = 0;
      for (const v of levelData) peak = Math.max(peak, Math.abs(v - 128) / 128);
      return peak;
    },
    async stop() {
      const rate = ctx.sampleRate;
      teardown();
      const blob = encodeWav(chunks, rate);
      await ctx.close().catch(() => undefined);
      return blob;
    },
    cancel() {
      teardown();
      void ctx.close().catch(() => undefined);
    },
  };
}

/** Plays base64 WAV segments returned by /api/tts back-to-back. */
export async function playWavSegments(
  base64Segments: string[],
  onEnd?: () => void,
): Promise<() => void> {
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === "suspended") await ctx.resume().catch(() => undefined);

  const sources: AudioBufferSourceNode[] = [];
  let stopped = false;
  let playhead = ctx.currentTime + 0.05;

  for (const b64 of base64Segments) {
    if (stopped) break;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    let buffer: AudioBuffer;
    try {
      buffer = await ctx.decodeAudioData(bytes.buffer);
    } catch {
      continue;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(Math.max(playhead, ctx.currentTime));
    playhead = Math.max(playhead, ctx.currentTime) + buffer.duration;
    sources.push(src);
  }

  const last = sources[sources.length - 1];
  if (last) last.onended = () => onEnd?.();
  else onEnd?.();

  return () => {
    stopped = true;
    sources.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* noop */
      }
    });
    void ctx.close().catch(() => undefined);
    onEnd?.();
  };
}
