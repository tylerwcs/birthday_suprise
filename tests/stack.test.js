import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor, lerpPose } from '../src/stack.js';

test('当前卡在原点、无旋转、满尺寸、可见', () => {
  const p = layoutFor(2, 2);
  assert.deepEqual(
    [p.x, p.y, p.z, p.rx, p.ry, p.rz, p.scale, p.opacity, p.visible],
    [0, 0, 0, 0, 0, 0, 1, 1, true],
  );
});

test('没看的下一张在左边屏外，且参与动画（可见）', () => {
  const p = layoutFor(1, 0);
  assert.equal(p.x, -1);
  assert.equal(p.visible, true);
  assert.equal(p.opacity, 1);
});

test('看过的上一张在右边屏外，且参与动画（可见）', () => {
  const p = layoutFor(0, 1);
  assert.equal(p.x, 1);
  assert.equal(p.visible, true);
});

test('相隔两张以上的卡不可见、透明', () => {
  assert.equal(layoutFor(2, 0).visible, false);
  assert.equal(layoutFor(2, 0).opacity, 0);
  assert.equal(layoutFor(0, 3).visible, false);
});

test('屏外的卡略小、略退后', () => {
  const p = layoutFor(1, 0);
  assert.ok(p.scale < 1);
  assert.ok(p.z < 0);
});

test('布局是确定性的', () => {
  assert.deepEqual(layoutFor(3, 0), layoutFor(3, 0));
});

test('lerpPose 中点插值，visible 取或', () => {
  const a = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1, visible: true };
  const b = { x: 2, y: 4, z: -2, rx: 0, ry: 1, rz: 0.2, scale: 0.5, opacity: 0, visible: false };
  const m = lerpPose(a, b, 0.5);
  assert.equal(m.x, 1); assert.equal(m.y, 2); assert.equal(m.z, -1);
  assert.equal(m.ry, 0.5); assert.equal(m.scale, 0.75); assert.equal(m.opacity, 0.5);
  assert.equal(m.visible, true);
});
