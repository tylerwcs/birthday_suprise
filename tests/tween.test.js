import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animate, tickTweens, ease } from '../src/tween.js';

test('animate 立即回调 0，tick 推进进度，结束后 resolve', async () => {
  const seen = [];
  const done = animate(100, ease.linear, t => seen.push(t));
  assert.deepEqual(seen, [0]);
  tickTweens(50);
  assert.deepEqual(seen, [0, 0.5]);
  tickTweens(80);
  assert.equal(seen.at(-1), 1);
  await done;
});

test('缓动函数端点正确', () => {
  for (const fn of Object.values(ease)) {
    assert.ok(Math.abs(fn(0)) < 1e-9);
    assert.ok(Math.abs(fn(1) - 1) < 1e-9);
  }
});
