import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rubber, decideTarget, createCarousel } from '../src/carousel.js';

test('rubber: 范围内原样返回，越界被压缩且不超过 give', () => {
  assert.equal(rubber(1.5, 0, 3), 1.5);
  assert.ok(rubber(-2, 0, 3) < 0 && rubber(-2, 0, 3) > -0.25);
  assert.ok(rubber(10, 0, 3) > 3 && rubber(10, 0, 3) < 3.25);
  assert.ok(rubber(-1, 0, 3) > rubber(-3, 0, 3)); // 拖得越远阻力越大但仍单调
});

test('decideTarget: 位移小回到原位，超过阈值翻一张', () => {
  assert.equal(decideTarget({ base: 2, cur: 2.1, total: 6 }), 2);
  assert.equal(decideTarget({ base: 2, cur: 2.45, total: 6 }), 3);
  assert.equal(decideTarget({ base: 2, cur: 1.55, total: 6 }), 1);
});

test('decideTarget: 快速甩动即使位移小也翻页，方向跟速度', () => {
  assert.equal(decideTarget({ base: 2, cur: 2.05, velocity: 3, total: 6 }), 3);
  assert.equal(decideTarget({ base: 2, cur: 2.05, velocity: -3, total: 6 }), 1);
});

test('decideTarget: 首尾不越界', () => {
  assert.equal(decideTarget({ base: 0, cur: -0.2, velocity: -5, total: 6 }), 0);
  assert.equal(decideTarget({ base: 5, cur: 5.4, total: 6 }), 5);
});

test('弹簧过渡会收敛到目标并停稳，过程不越过目标太多', () => {
  const car = createCarousel({ total: 6 });
  car.jump(0);
  car.transitionTo(1);
  let settled = false, maxPos = 0, frames = 0;
  while (!settled && frames < 600) { settled = car.step(1 / 60); maxPos = Math.max(maxPos, car.position); frames++; }
  assert.ok(settled);
  assert.equal(car.position, 1);
  assert.ok(maxPos < 1.05);
  assert.ok(frames < 120, `应在 2 秒内停稳，实际 ${frames} 帧`);
});

test('按住后拖动，位置追随目标；松手返回该落到的索引', () => {
  const car = createCarousel({ total: 6 });
  car.jump(2);
  car.grab();
  car.drag(0.6);
  for (let i = 0; i < 30; i++) car.step(1 / 60);
  assert.ok(Math.abs(car.position - 2.6) < 0.05);
  assert.equal(car.release({ base: 2, velocity: 0 }), 3);
  assert.equal(car.grabbing, false);
});
