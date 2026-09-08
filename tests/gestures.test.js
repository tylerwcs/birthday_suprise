import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGesture } from '../src/gestures.js';

test('几乎没移动是 tap', () => {
  assert.equal(classifyGesture({ dx: 3, dy: -4, dt: 120 }), 'tap');
});

test('向右拖超过阈值是 right', () => {
  assert.equal(classifyGesture({ dx: 90, dy: 5, dt: 400 }), 'right');
});

test('向左快速甩动即使距离短也是 left', () => {
  assert.equal(classifyGesture({ dx: -30, dy: 0, dt: 40 }), 'left');
});

test('距离与速度都不够返回 null', () => {
  assert.equal(classifyGesture({ dx: 30, dy: 0, dt: 500 }), null);
});

test('主要是竖直移动返回 null', () => {
  assert.equal(classifyGesture({ dx: 70, dy: 200, dt: 300 }), null);
});
