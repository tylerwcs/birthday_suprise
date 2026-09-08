import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmsOf, createBlowMeter } from '../src/blow.js';

test('rmsOf: 静音为 0，满幅方波接近 1', () => {
  assert.equal(rmsOf(new Uint8Array(64).fill(128)), 0);
  const sq = new Uint8Array(64).map((_, i) => (i % 2 ? 255 : 1));
  assert.ok(rmsOf(sq) > 0.98);
});

test('meter: 持续吹气会在 fillSeconds 内吹满', () => {
  const m = createBlowMeter({ threshold: 0.1, fillSeconds: 1, steps: 5 });
  let p = 0;
  for (let i = 0; i < 100; i++) p = m.feed(0.5, 0.016); // 1.6 秒大声
  assert.equal(p, 1);
});

test('meter: 触发线随环境底噪自适应，且不低于基础阈值', () => {
  const m = createBlowMeter({ threshold: 0.02 });
  for (let i = 0; i < 50; i++) m.feed(0.05, 0.016); // 0.8 秒的嘈杂环境
  assert.ok(m.threshold > 0.1, `底噪 0.05 时触发线应明显高于 0.05，实际 ${m.threshold}`);
  assert.equal(m.progress, 0);
  const quiet = createBlowMeter({ threshold: 0.02 });
  for (let i = 0; i < 50; i++) quiet.feed(0.003, 0.016);
  assert.equal(quiet.threshold, 0.02);
});

test('meter: 低于阈值不上升', () => {
  const m = createBlowMeter({ threshold: 0.1 });
  for (let i = 0; i < 60; i++) m.feed(0.05, 0.016);
  assert.equal(m.progress, 0);
});

test('meter: 停下来会回落，但不低于已吹灭的那一档', () => {
  const m = createBlowMeter({ threshold: 0.1, fillSeconds: 1, decayPerSecond: 1, steps: 5 });
  for (let i = 0; i < 30; i++) m.feed(0.5, 0.016); // 约 0.48 秒 → 进度 ≈ 0.5 左右，已过 2/5
  const peak = m.progress;
  assert.ok(peak >= 0.4 && peak < 1);
  for (let i = 0; i < 200; i++) m.feed(0, 0.016);   // 安静 3.2 秒
  assert.ok(m.progress < peak);
  assert.equal(m.progress, Math.floor(peak * 5) / 5);
});
