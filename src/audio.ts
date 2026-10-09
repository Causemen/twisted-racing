// Звук: двигатель и занос игрока из файлов, выстрелы и взрывы синтезируются на лету.

let ctx: AudioContext | null = null;
let master: GainNode;
const buffers = new Map<string, AudioBuffer>();
let engine: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let skid: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let noise: AudioBuffer;
let muted = false;

try {
  muted = localStorage.getItem('tr-muted') === '1';
} catch {
  /* хранилище может быть недоступно */
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem('tr-muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (master) master.gain.value = muted ? 0 : 0.8;
  return muted;
}

/** Вызывать из обработчика клика: браузеры разрешают звук только после действия игрока. */
export async function initAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(ctx.destination);

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  await Promise.all(
    ['engine', 'skid', 'impact'].map(async (name) => {
      try {
        const res = await fetch(`audio/${name}.ogg`);
        buffers.set(name, await ctx!.decodeAudioData(await res.arrayBuffer()));
      } catch {
        /* без звука игра всё равно работает */
      }
    }),
  );
  engine = loop('engine');
  skid = loop('skid');
}

function loop(name: string) {
  const buf = buffers.get(name);
  if (!ctx || !buf) return null;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(gain).connect(master);
  src.start();
  return { src, gain };
}

export function updateCarSound(speed: number, maxSpeed: number, slip: number, alive: boolean) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const k = Math.min(1.4, speed / maxSpeed);
  if (engine) {
    engine.src.playbackRate.setTargetAtTime(0.7 + k * 1.1, t, 0.05);
    engine.gain.gain.setTargetAtTime(alive ? 0.25 + k * 0.2 : 0, t, 0.1);
  }
  if (skid) skid.gain.gain.setTargetAtTime(alive ? Math.min(0.5, Math.max(0, slip - 4) * 0.05) : 0, t, 0.05);
}

function burst(opts: { dur: number; vol: number; freq: number; q?: number; type?: BiquadFilterType; pitchDrop?: number }, distGain = 1) {
  if (!ctx || distGain < 0.02) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = opts.type ?? 'lowpass';
  f.frequency.setValueAtTime(opts.freq, t);
  if (opts.pitchDrop) f.frequency.exponentialRampToValueAtTime(opts.freq * opts.pitchDrop, t + opts.dur);
  f.Q.value = opts.q ?? 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(opts.vol * distGain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + opts.dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + opts.dur + 0.05);
}

export const sfx = {
  gun: (g = 1) => burst({ dur: 0.07, vol: 0.35, freq: 2400, q: 0.7, type: 'bandpass' }, g),
  rocket: (g = 1) => burst({ dur: 0.5, vol: 0.4, freq: 1800, pitchDrop: 0.3 }, g),
  explosion: (g = 1) => {
    burst({ dur: 1.4, vol: 1.0, freq: 900, pitchDrop: 0.08 }, g);
    burst({ dur: 0.25, vol: 0.6, freq: 3000, type: 'bandpass' }, g);
  },
  impact: (g = 1) => {
    const buf = buffers.get('impact');
    if (!ctx || !buf || g < 0.02) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;
    const gain = ctx.createGain();
    gain.gain.value = 0.6 * g;
    src.connect(gain).connect(master);
    src.start();
  },
  pickup: () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.22);
  },
};
