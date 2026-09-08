// 吹气检测：麦克风音量 → 进度条。纯逻辑部分（rmsOf / createBlowMeter）可在 Node 里测试。

/** 时域采样（Uint8Array，128 为静音中心）的均方根，归一化到 0..1 */
export function rmsOf(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = (samples[i] - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * 把持续的音量变成 0..1 的进度。
 * 音量高于 threshold 时进度上升，持续 fillSeconds 秒吹满；停下来会慢慢回落，
 * 但不会低于已经"吹灭"的那一档（steps 档），灭掉的蜡烛不会复燃。
 */
export function createBlowMeter({ threshold = 0.02, fillSeconds = 0.6, decayPerSecond = 0.15, steps = 5, calibrateSeconds = 0.7 } = {}) {
  let progress = 0;
  // 自适应底噪：前 calibrateSeconds 秒里的安静采样求平均，触发线取"底噪的 2.2 倍 + 一点余量"和 threshold 中较大者
  let calibrated = 0, floorSum = 0, floorN = 0, floor = 0;
  const effectiveThreshold = () => Math.max(threshold, floor * 2.2 + 0.006);
  return {
    get progress() { return progress; },
    get threshold() { return effectiveThreshold(); },
    get floor() { return floor; },
    feed(level, dt) {
      if (calibrated < calibrateSeconds) {
        calibrated += dt;
        if (level < 0.15) { floorSum += level; floorN += 1; floor = floorSum / floorN; }
      }
      const th = effectiveThreshold();
      if (level > th) {
        const strength = Math.min(1, (level - th) / (0.2 - th) + 0.6);
        progress += (dt / fillSeconds) * strength;
      } else {
        const committed = Math.floor(progress * steps + 1e-9) / steps;
        progress = Math.max(committed, progress - decayPerSecond * dt);
      }
      progress = Math.min(1, progress);
      return progress;
    },
  };
}

/** 在用户手势里创建 AudioContext（iOS 要求），之后 startMic 复用它 */
export function createAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  ctx.resume().catch(() => {});
  return ctx;
}

/** 打开麦克风，返回 { level(): 0..1, stop() }；不可用或被拒绝时返回 null */
export async function startMic(sharedCtx = null) {
  if (!navigator.mediaDevices?.getUserMedia) return null;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const ctx = sharedCtx || createAudioContext();
    if (!ctx) { stream.getTracks().forEach(t => t.stop()); return null; }
    await ctx.resume().catch(() => {});
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    return {
      level() { analyser.getByteTimeDomainData(buf); return rmsOf(buf); },
      stop() { stream.getTracks().forEach(t => t.stop()); source.disconnect(); if (!sharedCtx) ctx.close().catch(() => {}); },
    };
  } catch {
    return null;
  }
}
