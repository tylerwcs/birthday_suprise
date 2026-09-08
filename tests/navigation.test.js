import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNavigation } from '../src/navigation.js';

const make = () => createNavigation({ total: 4, flippable: i => i === 1 || i === 2 });

test('初始状态在第 0 张，未翻面，不在动画中', () => {
  assert.deepEqual(make().state, { index: 0, flipped: false, animating: false });
});

test('next 前进一张并进入动画中', () => {
  const nav = make();
  assert.deepEqual(nav.next(), { type: 'next', from: 0, to: 1 });
  assert.equal(nav.state.index, 1);
  assert.equal(nav.state.animating, true);
});

test('动画中一切动作都返回 null，finish 后恢复', () => {
  const nav = make();
  nav.next();
  assert.equal(nav.next(), null);
  assert.equal(nav.prev(), null);
  assert.equal(nav.flip(), null);
  nav.finish();
  assert.deepEqual(nav.flip(), { type: 'flip', index: 1, flipped: true });
});

test('最后一张 next 返回 null，第一张 prev 返回 null', () => {
  const nav = make();
  assert.equal(nav.prev(), null);
  for (let i = 0; i < 3; i++) { nav.next(); nav.finish(); }
  assert.equal(nav.state.index, 3);
  assert.equal(nav.next(), null);
});

test('不可翻面的卡 flip 返回 null', () => {
  assert.equal(make().flip(), null);
});

test('lock 占用状态机，期间动作被拒，finish 后释放', () => {
  const nav = make();
  assert.equal(nav.lock(), true);
  assert.equal(nav.lock(), false);
  assert.equal(nav.next(), null);
  nav.finish();
  assert.deepEqual(nav.next(), { type: 'next', from: 0, to: 1 });
});

test('翻面后 next/prev 会重置 flipped', () => {
  const nav = make();
  nav.next(); nav.finish();
  nav.flip(); nav.finish();
  assert.equal(nav.state.flipped, true);
  assert.deepEqual(nav.prev(), { type: 'prev', from: 1, to: 0 });
  assert.equal(nav.state.flipped, false);
});
