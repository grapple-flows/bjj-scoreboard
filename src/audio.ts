// Scoreboard sounds, synthesized in the browser (no audio files to host).
//
//   bell  - 1.5 kHz tone held for a second. Ends a match.
//   clack - a short, dry knock. Played on 10, 9 and 8 seconds left.
//
// Ported from the Grapple Flows app's timer audio. The app plays a recorded
// wood hit for the clack; this package synthesizes one instead so it ships no
// assets. iOS prefers an HTMLAudioElement per sound (more reliable with the
// silent switch), unlocked inside the first tap.

export type ScoreboardSounds = {
  unlock: () => Promise<void>;
  bell: () => void;
  clack: () => void;
};

type SoundId = "bell" | "clack";
const SOUND_IDS: SoundId[] = ["bell", "clack"];

type Recipe = { hz: number; seconds: number; decay?: boolean };
const RECIPES: Record<SoundId, Recipe> = {
  bell: { hz: 1500, seconds: 1 },
  clack: { hz: 900, seconds: 0.09, decay: true },
};

const getAudioContextCtor = (): typeof AudioContext | null => {
  if (typeof window === "undefined") return null;
  const extended = window as Window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext ?? extended.webkitAudioContext ?? null;
};

const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

/** A sine with two harmonics, fast attack, soft-clipped and normalized so it
 *  carries on phone and laptop speakers. `decay` gives a percussive knock. */
export const renderTone = async (recipe: Recipe, sampleRate = 44100): Promise<AudioBuffer> => {
  const { hz, seconds, decay } = recipe;
  const offline = new OfflineAudioContext(1, Math.ceil(sampleRate * (seconds + 0.01)), sampleRate);
  const env = offline.createGain();
  env.gain.setValueAtTime(0, 0);
  env.gain.linearRampToValueAtTime(1, 0.003);
  if (decay) {
    env.gain.exponentialRampToValueAtTime(0.001, seconds);
  } else {
    env.gain.setValueAtTime(1, seconds - 0.04);
    env.gain.linearRampToValueAtTime(0, seconds - 0.01);
  }
  env.connect(offline.destination);
  const partials: Array<[number, number]> = decay
    ? [
        [1, 1],
        [2.7, 0.5],
        [5.4, 0.25],
      ]
    : [
        [1, 1],
        [2, 0.3],
        [3, 0.15],
      ];
  for (const [ratio, level] of partials) {
    const osc = offline.createOscillator();
    const gain = offline.createGain();
    osc.frequency.value = hz * ratio;
    gain.gain.value = level;
    osc.connect(gain);
    gain.connect(env);
    osc.start(0);
    osc.stop(seconds);
  }
  const rendered = await offline.startRendering();
  const data = rendered.getChannelData(0);
  const drive = 2.5;
  const first = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0) || 1;
  for (let i = 0; i < data.length; i += 1) data[i] = Math.tanh((data[i] / first) * drive);
  const second = data.reduce((max, v) => Math.max(max, Math.abs(v)), 0) || 1;
  for (let i = 0; i < data.length; i += 1) data[i] *= 0.9 / second;
  return rendered;
};

/** 16-bit mono WAV, so iOS can play the tone through an <audio> element. */
export const encodeWav = (buffer: AudioBuffer): ArrayBuffer => {
  const channel = buffer.getChannelData(0);
  const dataLength = channel.length * 2;
  const view = new DataView(new ArrayBuffer(44 + dataLength));
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let i = 0; i < channel.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }
  return view.buffer;
};

/** Lazily builds the sounds. Every method is a safe no-op where Web Audio is
 *  missing (server rendering, tests, very old browsers). */
export const createScoreboardSounds = (): ScoreboardSounds => {
  const AudioContextCtor = getAudioContextCtor();
  const preferHtml = isIOS();
  let context: AudioContext | null = null;
  let unlocked = false;
  const buffers: Partial<Record<SoundId, Promise<AudioBuffer | null>>> = {};
  const players: Partial<Record<SoundId, HTMLAudioElement>> = {};

  const ensureRunning = async (): Promise<AudioContext | null> => {
    if (!AudioContextCtor) return null;
    if (!context || context.state === "closed") context = new AudioContextCtor();
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        /* needs a user gesture; the next tap resumes it */
      }
    }
    return context;
  };

  const getBuffer = (id: SoundId): Promise<AudioBuffer | null> => {
    buffers[id] ??= (async () => {
      try {
        if (typeof OfflineAudioContext === "undefined") return null;
        const buffer = await renderTone(RECIPES[id]);
        if (typeof Audio !== "undefined" && typeof URL?.createObjectURL === "function" && !players[id]) {
          const player = new Audio(URL.createObjectURL(new Blob([encodeWav(buffer)], { type: "audio/wav" })));
          player.setAttribute("playsinline", "true");
          player.preload = "auto";
          players[id] = player;
        }
        return buffer;
      } catch {
        delete buffers[id];
        return null;
      }
    })();
    return buffers[id] as Promise<AudioBuffer | null>;
  };

  // Render up front so the first tap only has to unlock, not synthesize:
  // iOS drops the gesture if unlock() waits too long before play().
  if (typeof window !== "undefined") SOUND_IDS.forEach((id) => void getBuffer(id));

  const playBuffer = async (id: SoundId) => {
    const [active, buffer] = await Promise.all([ensureRunning(), getBuffer(id)]);
    if (!active || !buffer) return;
    const source = active.createBufferSource();
    source.buffer = buffer;
    source.connect(active.destination);
    source.start();
  };

  const play = (id: SoundId) => {
    const player = players[id];
    if (preferHtml && player) {
      player.currentTime = 0;
      player.volume = 1;
      void player.play()?.catch(() => void playBuffer(id));
      return;
    }
    void playBuffer(id);
  };

  return {
    unlock: async () => {
      if (unlocked || !AudioContextCtor) return;
      const active = await ensureRunning();
      // Stay "locked" if the browser refused (not a user gesture), so the
      // next tap tries again.
      unlocked = active?.state === "running";
      if (active) {
        // A silent buffer inside the gesture unlocks Web Audio on Safari.
        const silent = active.createBuffer(1, 1, active.sampleRate);
        const source = active.createBufferSource();
        source.buffer = silent;
        source.connect(active.destination);
        source.start(0);
      }
      if (!preferHtml) {
        await Promise.all(SOUND_IDS.map(getBuffer));
        return;
      }
      // iOS only unlocks the same HTMLAudioElement that played during a gesture.
      await Promise.all(
        SOUND_IDS.map(async (id) => {
          const player = players[id];
          if (!player) return;
          try {
            player.volume = 0.001;
            await player.play();
            player.pause();
            player.currentTime = 0;
          } catch {
            /* falls back to Web Audio at play time */
          } finally {
            player.volume = 1;
          }
        }),
      );
    },
    bell: () => play("bell"),
    clack: () => play("clack"),
  };
};
