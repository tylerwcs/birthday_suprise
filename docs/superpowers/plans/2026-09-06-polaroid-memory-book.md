# 3D 拍立得回忆录 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 一个纯静态的 Three.js 网页：一叠 3D 拍立得卡片，点击翻面看文字，左右划切换，带封面、结尾祝福、背景音乐和漂浮光点。

**Architecture:** 无构建步骤的 ES module 站点，`index.html` 用 importmap 从 CDN 加载 Three.js。纯逻辑（换行、导航状态机、手势判定、堆叠布局、补间）拆成独立模块并用 Node 内置测试覆盖；`cards.js` 用 Canvas 2D 绘制卡片正反面贴图，`main.js` 负责组装场景与交互。

**Tech Stack:** Three.js 0.170.0 (CDN importmap)、Canvas 2D、Pointer Events、Google Fonts（Ma Shan Zheng + Caveat）、`node:test`。

**Spec:** `docs/superpowers/specs/2026-09-06-polaroid-memory-book-design.md`

## Global Constraints

- Three.js 固定版本 `0.170.0`，只通过 importmap 的 `three` 裸模块名引入。
- 所有文字用手写字体：中文 `"Ma Shan Zheng"`，英文 `"Caveat"`；Canvas 贴图必须在 `document.fonts.load()` 完成（或 3 秒超时）后绘制。
- 除 Three.js 外不引入任何运行时依赖；测试零依赖（`node --test`）。
- 卡片尺寸常量：世界单位 宽 1.76 × 高 2.14 × 厚 0.02；贴图 1024 × 1245 px。
- 用户内容只在 `content.js` 里改。
- 本目录不是 git 仓库，本计划不含 commit 步骤。

---

## File Structure

| 文件 | 职责 |
|---|---|
| `package.json` | `"type":"module"`，`npm test` 脚本 |
| `content.js` | 用户内容配置（名字、照片、文字、音乐） |
| `photos/placeholder-*.svg` | 占位照片 |
| `index.html` | 骨架、importmap、字体链接、加载层、按钮 |
| `style.css` | 覆盖层样式 |
| `src/textLayout.js` | 纯逻辑：分词、换行、自适应字号 |
| `src/navigation.js` | 纯逻辑：index / flipped / animating 状态机 |
| `src/gestures.js` | `classifyGesture` 纯逻辑 + `attachGestures` DOM 绑定 |
| `src/stack.js` | 纯逻辑：给定卡片索引与当前索引，返回目标姿态；姿态插值 |
| `src/tween.js` | 缓动函数、`animate`/`tickTweens` |
| `src/cards.js` | Canvas 绘制正反面、封面、结尾；创建卡片 Mesh |
| `src/particles.js` | 背景光点 |
| `src/main.js` | 入口：加载 → 场景 → 输入 → 主循环 |
| `tests/*.test.js` | 纯逻辑模块的单测 |

---

### Task 1: 项目脚手架与内容配置

**Files:**
- Create: `package.json`, `content.js`, `photos/placeholder-1.svg` … `placeholder-6.svg`, `audio/README.txt`

**Interfaces:**
- Produces: `content.js` default export `{ recipient, cover:{title, subtitle}, photos:[{src, caption, text}], ending:{title, text}, music }`

- [x] **Step 1: 写 package.json**

```json
{
  "name": "polaroid-memory-book",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "dev": "npx --yes serve -l 5173 ."
  }
}
```

- [x] **Step 2: 写 content.js（占位内容）**

```js
// 只需要改这个文件：名字、照片、文字、音乐。
export default {
  recipient: "小 X",
  cover: { title: "Happy Birthday", subtitle: "点一下，打开我们的回忆" },
  photos: [
    { src: "photos/placeholder-1.svg", caption: "第一次见面的那天", text: "还记得那天下午的阳光吗？\n我紧张得把咖啡洒了一半，你笑了很久。" },
    { src: "photos/placeholder-2.svg", caption: "海边 · 夏天", text: "你说想看日出，我们凌晨四点就出发了。\n结果日出被云挡住，但那杯热豆浆真的很好喝。" },
    { src: "photos/placeholder-3.svg", caption: "那年的雪", text: "第一次一起看雪。\n你的手很冷，我的口袋一直是给你留的。" },
    { src: "photos/placeholder-4.svg", caption: "深夜的便利店", text: "考试周的深夜，一起吃关东煮。\n那时候觉得未来很远，其实只是很近。" },
    { src: "photos/placeholder-5.svg", caption: "去年生日", text: "蛋糕上的字写歪了，你却说这是你收过最好看的蛋糕。" },
    { src: "photos/placeholder-6.svg", caption: "最后一张", text: "这些照片我一直留着。\n谢谢你出现在我的故事里。" },
  ],
  ending: { title: "生日快乐", text: "不管我们现在是什么关系，\n希望你今年依然被温柔对待，\n依然有人为你点蜡烛。\n\n生日快乐。" },
  music: "audio/song.mp3", // 不要音乐就写 null
};
```

- [x] **Step 3: 生成 6 张占位 SVG（1000×1000，渐变 + 编号）**

颜色对依次为 `#f6a5a5/#f9d29d`、`#a5c8f6/#c9a5f6`、`#f6e3a5/#f6a5c8`、`#a5f6d5/#a5c8f6`、`#f6c1a5/#f6a5e0`、`#d5a5f6/#a5b8f6`。每个文件：

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="C1"/><stop offset="1" stop-color="C2"/></linearGradient></defs>
  <rect width="1000" height="1000" fill="url(#g)"/>
  <text x="500" y="540" font-family="Georgia, serif" font-size="220" text-anchor="middle" fill="rgba(255,255,255,0.75)">N</text>
</svg>
```

- [x] **Step 4: audio/README.txt**

```
把背景音乐 mp3 放到这个文件夹，然后在 content.js 的 music 字段填文件名，例如 "audio/song.mp3"。
```

- [x] **Step 5: 验证 content.js 可被 Node 导入**

Run: `node -e "import('./content.js').then(m=>console.log(m.default.photos.length))"`
Expected: `6`

---

### Task 2: 文本换行与自适应字号（textLayout）

**Files:**
- Create: `src/textLayout.js`, `tests/textLayout.test.js`

**Interfaces:**
- Produces:
  - `tokenize(text: string): string[]` — CJK 逐字、拉丁按词、保留 `' '` 和 `'\n'` 记号
  - `wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[]`
  - `fitText(text, { maxWidth, maxHeight, fontSize, minFontSize, lineHeight = 1.5, measureAt: (size) => (s) => number }): { fontSize, lines }`

- [x] **Step 1: 写失败的测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, wrapText, fitText } from '../src/textLayout.js';

const mono = s => s.length * 10;

test('tokenize: CJK 逐字，拉丁按词，保留空格与换行', () => {
  assert.deepEqual(tokenize('你好 hello\n世界'), ['你', '好', ' ', 'hello', '\n', '世', '界']);
});
test('wrapText: 中文按字换行', () => {
  assert.deepEqual(wrapText('你好世界', 25, mono), ['你好', '世界']);
});
test('wrapText: 英文按词换行并去掉行尾空格', () => {
  assert.deepEqual(wrapText('hello world foo', 110, mono), ['hello world', 'foo']);
});
test('wrapText: 显式换行符生效，连续换行产生空行', () => {
  assert.deepEqual(wrapText('a\n\nb', 100, mono), ['a', '', 'b']);
});
test('wrapText: 超长单词按字符拆开', () => {
  assert.deepEqual(wrapText('abcdefgh', 30, mono), ['abc', 'def', 'gh']);
});
test('wrapText: 标点不放行首，允许挂在上一行末尾', () => {
  assert.deepEqual(wrapText('你好，', 20, mono), ['你好，']);
});
test('fitText: 高度不够时缩小字号直到装下', () => {
  const measureAt = size => s => s.length * size;
  const r = fitText('一二三四五六七八', { maxWidth: 40, maxHeight: 60, fontSize: 20, minFontSize: 8, lineHeight: 1, measureAt });
  assert.ok(r.fontSize < 20);
  assert.ok(r.lines.length * r.fontSize <= 60);
});
test('fitText: 到最小字号仍装不下则停在最小字号', () => {
  const measureAt = size => s => s.length * size;
  const r = fitText('一二三四五六七八九十一二三四五六七八九十', { maxWidth: 10, maxHeight: 10, fontSize: 20, minFontSize: 10, lineHeight: 1, measureAt });
  assert.equal(r.fontSize, 10);
});
```

- [x] **Step 2: 运行确认失败** — Run: `npm test`，Expected: FAIL（模块不存在）

- [x] **Step 3: 实现**

```js
const CJK = /[⺀-⿟　-〿぀-ヿ㄀-ㄯ㐀-䶿一-鿿豈-﫿＀-￯]/;
const NO_LINE_START = /^[，。！？、；：）」』】》〉”’…—,.!?;:)\]}]$/;

export function tokenize(text) {
  const tokens = [];
  let word = '';
  const flush = () => { if (word) { tokens.push(word); word = ''; } };
  for (const ch of text) {
    if (ch === '\n' || ch === ' ') { flush(); tokens.push(ch); }
    else if (CJK.test(ch)) { flush(); tokens.push(ch); }
    else word += ch;
  }
  flush();
  return tokens;
}

export function wrapText(text, maxWidth, measure) {
  const lines = [];
  let line = '';
  const push = () => { lines.push(line.replace(/\s+$/, '')); line = ''; };
  for (const tok of tokenize(text)) {
    if (tok === '\n') { push(); continue; }
    if (tok === ' ' && line === '') continue;
    const candidate = line + tok;
    if (measure(candidate) <= maxWidth) { line = candidate; continue; }
    if (tok === ' ') { push(); continue; }
    if (NO_LINE_START.test(tok) && line !== '') { line = candidate; continue; }
    if (line !== '') push();
    if (measure(tok) <= maxWidth) { line = tok; continue; }
    for (const ch of tok) {
      if (line && measure(line + ch) > maxWidth) push();
      line += ch;
    }
  }
  if (line !== '') push();
  return lines;
}

export function fitText(text, { maxWidth, maxHeight, fontSize, minFontSize, lineHeight = 1.5, measureAt }) {
  let size = fontSize;
  for (;;) {
    const lines = wrapText(text, maxWidth, measureAt(size));
    const height = lines.length * size * lineHeight;
    if (height <= maxHeight || size <= minFontSize) return { fontSize: size, lines };
    size = Math.max(minFontSize, Math.floor(size * 0.92));
  }
}
```

- [x] **Step 4: 运行确认通过** — Run: `npm test`，Expected: 8 PASS

---

### Task 3: 导航状态机（navigation）

**Files:**
- Create: `src/navigation.js`, `tests/navigation.test.js`

**Interfaces:**
- Produces: `createNavigation({ total, flippable: (index) => boolean })` →
  - `state` getter → `{ index, flipped, animating }`
  - `next(): {type:'next', from, to} | null`、`prev(): {type:'prev', from, to} | null`、`flip(): {type:'flip', index, flipped} | null`
  - `finish(): void` — 动画结束后调用；任何非 null 动作都会把 `animating` 置 true

- [x] **Step 1: 写失败的测试**

```js
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
test('翻面后 next/prev 会重置 flipped', () => {
  const nav = make();
  nav.next(); nav.finish();
  nav.flip(); nav.finish();
  assert.equal(nav.state.flipped, true);
  assert.deepEqual(nav.prev(), { type: 'prev', from: 1, to: 0 });
  assert.equal(nav.state.flipped, false);
});
```

- [x] **Step 2: 运行确认失败** — Run: `npm test`

- [x] **Step 3: 实现**

```js
export function createNavigation({ total, flippable }) {
  let index = 0, flipped = false, animating = false;
  return {
    get state() { return { index, flipped, animating }; },
    next() {
      if (animating || index >= total - 1) return null;
      const from = index; index += 1; flipped = false; animating = true;
      return { type: 'next', from, to: index };
    },
    prev() {
      if (animating || index <= 0) return null;
      const from = index; index -= 1; flipped = false; animating = true;
      return { type: 'prev', from, to: index };
    },
    flip() {
      if (animating || !flippable(index)) return null;
      flipped = !flipped; animating = true;
      return { type: 'flip', index, flipped };
    },
    finish() { animating = false; },
  };
}
```

- [x] **Step 4: 运行确认通过** — Run: `npm test`

---

### Task 4: 手势判定与绑定（gestures）

**Files:**
- Create: `src/gestures.js`, `tests/gestures.test.js`

**Interfaces:**
- Produces:
  - `classifyGesture({dx, dy, dt}, {threshold=60, velocity=0.5, tapSlop=8}): 'tap' | 'right' | 'left' | null`（dt 毫秒，velocity px/ms）
  - `attachGestures(el, { onDragMove(dx, dy), onSwipe(dir), onTap(), onCancel() }, options)` — pointer 事件 + 键盘 ←/→/空格/回车

- [x] **Step 1: 写失败的测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGesture } from '../src/gestures.js';

test('几乎没移动是 tap', () => { assert.equal(classifyGesture({ dx: 3, dy: -4, dt: 120 }), 'tap'); });
test('向右拖超过阈值是 right', () => { assert.equal(classifyGesture({ dx: 90, dy: 5, dt: 400 }), 'right'); });
test('向左快速甩动即使距离短也是 left', () => { assert.equal(classifyGesture({ dx: -30, dy: 0, dt: 40 }), 'left'); });
test('距离与速度都不够返回 null', () => { assert.equal(classifyGesture({ dx: 30, dy: 0, dt: 500 }), null); });
test('主要是竖直移动返回 null', () => { assert.equal(classifyGesture({ dx: 70, dy: 200, dt: 300 }), null); });
```

- [x] **Step 2: 运行确认失败** — Run: `npm test`

- [x] **Step 3: 实现**

```js
export function classifyGesture({ dx, dy, dt }, { threshold = 60, velocity = 0.5, tapSlop = 8 } = {}) {
  if (Math.abs(dx) <= tapSlop && Math.abs(dy) <= tapSlop) return 'tap';
  if (Math.abs(dx) < Math.abs(dy) * 0.8) return null;
  const vx = dt > 0 ? dx / dt : 0;
  if (dx >= threshold || vx >= velocity) return 'right';
  if (dx <= -threshold || vx <= -velocity) return 'left';
  return null;
}

export function attachGestures(el, handlers, options) {
  let start = null;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => {
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    handlers.onDragMove?.(e.clientX - start.x, e.clientY - start.y);
  });
  el.addEventListener('pointerup', e => {
    if (!start || e.pointerId !== start.id) return;
    const g = { dx: e.clientX - start.x, dy: e.clientY - start.y, dt: performance.now() - start.t };
    start = null;
    const kind = classifyGesture(g, options);
    if (kind === 'tap') handlers.onTap?.();
    else if (kind) handlers.onSwipe?.(kind);
    else handlers.onCancel?.();
  });
  el.addEventListener('pointercancel', () => { start = null; handlers.onCancel?.(); });
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') handlers.onSwipe?.('right');
    else if (e.key === 'ArrowLeft') handlers.onSwipe?.('left');
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handlers.onTap?.(); }
  });
}
```

- [x] **Step 4: 运行确认通过** — Run: `npm test`

---

### Task 5: 卡堆布局与姿态插值（stack）

**Files:**
- Create: `src/stack.js`, `tests/stack.test.js`

**Interfaces:**
- Produces:
  - `Pose = { x, y, z, rx, ry, rz, scale, opacity, visible }`
  - `layoutFor(cardIndex, currentIndex): Pose` — 确定性
  - `lerpPose(a, b, t): Pose` — 数值字段线性插值，`visible = a.visible || b.visible`
  - `MAX_BEHIND = 3`

- [x] **Step 1: 写失败的测试**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor, lerpPose, MAX_BEHIND } from '../src/stack.js';

test('当前卡在原点、无旋转、满尺寸、可见', () => {
  const p = layoutFor(2, 2);
  assert.deepEqual([p.x, p.y, p.z, p.rx, p.ry, p.rz, p.scale, p.opacity, p.visible], [0, 0, 0, 0, 0, 0, 1, 1, true]);
});
test('后面的卡依次更靠后、更小、略高', () => {
  const a = layoutFor(1, 0), b = layoutFor(2, 0);
  assert.ok(a.z < 0 && b.z < a.z);
  assert.ok(a.scale < 1 && b.scale < a.scale);
  assert.ok(a.y > 0 && b.y > a.y);
  assert.ok(a.visible && b.visible);
});
test('超过 MAX_BEHIND 的卡不可见但保留位置', () => {
  const p = layoutFor(MAX_BEHIND + 1, 0);
  assert.equal(p.visible, false);
  assert.equal(p.opacity, 0);
});
test('已翻过的卡飞到右侧、不可见、透明', () => {
  const p = layoutFor(0, 1);
  assert.ok(p.x > 2);
  assert.equal(p.visible, false);
  assert.equal(p.opacity, 0);
});
test('布局是确定性的', () => { assert.deepEqual(layoutFor(3, 0), layoutFor(3, 0)); });
test('lerpPose 中点插值，visible 取或', () => {
  const a = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1, visible: true };
  const b = { x: 2, y: 4, z: -2, rx: 0, ry: 1, rz: 0.2, scale: 0.5, opacity: 0, visible: false };
  const m = lerpPose(a, b, 0.5);
  assert.equal(m.x, 1); assert.equal(m.y, 2); assert.equal(m.z, -1);
  assert.equal(m.ry, 0.5); assert.equal(m.scale, 0.75); assert.equal(m.opacity, 0.5);
  assert.equal(m.visible, true);
});
```

- [x] **Step 2: 运行确认失败** — Run: `npm test`

- [x] **Step 3: 实现**

```js
export const MAX_BEHIND = 3;
const DEPTH_STEP = 0.32, RISE_STEP = 0.10, SCALE_STEP = 0.045;

export function seeded(i) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export function layoutFor(cardIndex, currentIndex) {
  const offset = cardIndex - currentIndex;
  const r1 = seeded(cardIndex) * 2 - 1;
  const r2 = seeded(cardIndex + 100) * 2 - 1;
  if (offset === 0) return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1, visible: true };
  if (offset < 0) return { x: 3.4, y: 0.8, z: 0.6, rx: 0, ry: -0.7, rz: -0.55 - 0.2 * r1, scale: 1, opacity: 0, visible: false };
  const k = Math.min(offset, MAX_BEHIND);
  const shown = offset <= MAX_BEHIND;
  return { x: r1 * 0.18 * k, y: RISE_STEP * k, z: -DEPTH_STEP * k, rx: 0, ry: 0, rz: r2 * 0.09, scale: 1 - SCALE_STEP * k, opacity: shown ? 1 : 0, visible: shown };
}

const NUM_KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale', 'opacity'];
export function lerpPose(a, b, t) {
  const out = { visible: a.visible || b.visible };
  for (const k of NUM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}
```

- [x] **Step 4: 运行确认通过** — Run: `npm test`

---

### Task 6: 补间工具（tween）

**Files:**
- Create: `src/tween.js`, `tests/tween.test.js`

**Interfaces:**
- Produces: `ease = { linear, outCubic, inOutCubic, outBack }`；`animate(durationMs, easing, onUpdate(t)): Promise<void>`（立即调一次 `onUpdate(0)`）；`tickTweens(dtMs)`

- [x] **Step 1: 写失败的测试**

```js
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
    assert.equal(fn(0), 0);
    assert.ok(Math.abs(fn(1) - 1) < 1e-9);
  }
});
```

- [x] **Step 2: 运行确认失败** — Run: `npm test`

- [x] **Step 3: 实现**

```js
export const ease = {
  linear: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
};
const active = new Set();
export function animate(duration, easing, onUpdate) {
  return new Promise(resolve => {
    active.add({ elapsed: 0, duration, easing, onUpdate, resolve });
    onUpdate(0);
  });
}
export function tickTweens(dt) {
  for (const tw of [...active]) {
    tw.elapsed += dt;
    const t = Math.min(1, tw.elapsed / tw.duration);
    tw.onUpdate(tw.easing(t));
    if (t >= 1) { active.delete(tw); tw.resolve(); }
  }
}
```

- [x] **Step 4: 运行确认通过** — Run: `npm test`

---

### Task 7: 卡片贴图与 Mesh（cards）+ 背景粒子（particles）

浏览器专用模块，在 Task 8 里整体验证。

**Files:**
- Create: `src/cards.js`, `src/particles.js`

**Interfaces:**
- Consumes: `fitText` from `src/textLayout.js`
- Produces (`cards.js`): `CARD = { w: 1.76, h: 2.14, depth: 0.02, px: 1024, py: 1245 }`、`FONTS = { zh, en }`、`loadFonts(sampleText, timeoutMs = 3000)`、`drawFront({ image, caption })`、`drawBack({ text })`、`drawCoverCard({ title, recipient, subtitle })`、`drawEnding({ title, text })`（均返回 HTMLCanvasElement）、`createCardMesh(frontCanvas, backCanvas, maxAnisotropy): THREE.Mesh`（`mesh.userData.setOpacity(v)`）
- Produces (`particles.js`): `createParticles({ count, size, opacity, color }): { points: THREE.Points, update(dtSeconds) }`

- [x] **Step 1: 写 src/cards.js**（正面：白框 + 912px 正方形照片区 + 底部 269px 白边写 caption；背面：米色纸 + fitText 段落 + 底部 ♡；封面：照片区填暖色渐变，Caveat 168px 标题 + 名字 128px；结尾：标题 150px + 段落。Mesh 用 BoxGeometry 6 材质：4 侧白、+z 正面、-z 背面，全部 `transparent: true`。）

- [x] **Step 2: 写 src/particles.js**（`Points` + 径向渐变 sprite、AdditiveBlending、depthWrite false；粒子在 x±7、y±6、z −7..−1.2 的盒子内上浮并横向摆动，越过 y=6 回到 −6。）

- [x] **Step 3: 语法检查** — Run: `node --check src/cards.js && node --check src/particles.js`

---

### Task 8: 页面骨架、样式与入口（index.html / style.css / main.js）

**Files:**
- Create: `index.html`, `style.css`, `src/main.js`

**Interfaces:**
- Consumes: 上面所有模块的导出
- DOM 约定：`#loading`（内含 `.msg`、`.track > .bar`）、`#music`、`#prev`、`#next`、`#hint`、`canvas#scene`

- [x] **Step 1: index.html** — importmap 指向 `https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js`；Google Fonts link `family=Ma+Shan+Zheng&family=Caveat:wght@500;700`；上述 DOM。
- [x] **Step 2: style.css** — 深色径向渐变背景，加载层、圆形半透明按钮、底部提示；`max-width: 640px` 隐藏箭头。
- [x] **Step 3: src/main.js** — 流程：
  1. 创建 WebGLRenderer（失败 → 加载层显示提示）
  2. `preload()`：`loadFonts(全部文字拼接)` + 图片 Promise，进度条
  3. 场景：PerspectiveCamera fov 32；Ambient + 主方向光 + 冷色补光；两组粒子（小 260 个、大 60 个粉色）
  4. `kinds = ['cover', ...photo, 'ending']`，为每张卡建 `{ mesh, kind, flipAngle, lift, drag:{x,ry,rz}, pose }`；`applyPose` 把 pose+drag+flipAngle+lift 写到 mesh
  5. `createNavigation({ total, flippable: i => kinds[i]==='photo' })`
  6. `goTo({from,to})`：捕获起始姿态（含 drag），目标 `layoutFor(i,to)`，620ms outCubic 插值，离开/进入的卡加 `sin(πt)*0.35` 弧线；完成后 `nav.finish()` + `updateUI()`
  7. `flip({index,flipped})`：720ms inOutCubic 转 flipAngle 至 π/0，`lift = sin(πt)*0.45`
  8. `snapBack()`：380ms outBack 把 drag 归零
  9. 手势：`onDragMove` 按 `3.2/innerWidth` 比例位移 + 轻微 rz/ry；`onSwipe('right')`→next、`'left'`→prev、失败则 snapBack；`onTap` 在封面→next，照片→flip；所有输入首次触发 `startMusic()`
  10. 音乐：`new Audio(content.music)` loop、volume 0.6；播放失败按钮显示 off 状态；按钮切换暂停
  11. UI：首尾隐藏对应箭头；到第 1 张时显示 `#hint` 3.5 秒
  12. 视差：pointermove / deviceorientation → 相机 x±0.4、y±0.25 平滑跟随并 lookAt 原点
  13. resize：`camera.position.z = max(CARD.h*1.45, CARD.w*1.55/aspect) / (2·tan(fov/2))`
  14. 主循环：`tickTweens`、粒子 update、渲染
- [x] **Step 4: 启动本地服务器并在浏览器检查**

Run: `npx --yes serve -l 5173 .`，打开 `http://localhost:5173`

检查清单：
1. 加载层进度条后淡出，封面「Happy Birthday / 小 X」为手写体。
2. 封面后能看到 3 张略歪的卡。
3. 点击封面 → 封面向右上飞出，第一张照片卡到最前。
4. 点击照片卡 → 绕竖轴翻转看到米色背面 + 手写中文，再点翻回。
5. 向右拖 → 卡跟手倾斜；拖过一半松手 → 下一张；拖一点松手 → 弹回。
6. 键盘 ← → 有效；首张隐藏「‹」、末张隐藏「›」。
7. 结尾卡点击无翻转，右划弹回。
8. 背景有暖色光点上浮，移动鼠标有轻微视差。
9. 控制台无报错（mp3 不存在允许一次 404，按钮消失）。

- [x] **Step 5: 手机竖屏检查** — 375×812：卡片完整可见，触摸行为同上，箭头隐藏。

---

### Task 9: 收尾 — README

**Files:**
- Create: `README.md`

- [x] **Step 1: 写 README.md** — 说明：怎么改 `content.js`、本地预览命令、Netlify Drop 发布、`npm test`。
- [x] **Step 2: 最终回归** — `npm test` 全部 PASS；再走一遍 Task 8 Step 4 清单。
