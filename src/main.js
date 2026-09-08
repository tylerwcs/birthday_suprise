import * as THREE from 'three';
import content from '../content.js';
import { cardSizeFor, loadFonts, drawPhoto, drawBack, drawEnding, createCardMesh } from './cards.js';
import { createCake } from './cake.js';
import { startMic, createBlowMeter, createAudioContext } from './blow.js';
import { createNavigation } from './navigation.js';
import { layoutFor, lerpPose } from './stack.js';
import { attachGestures } from './gestures.js';
import { createParticles } from './particles.js';
import { animate, tickTweens, ease } from './tween.js';
import { createCarousel } from './carousel.js';

const $ = s => document.querySelector(s);
const loadingEl = $('#loading');
const barEl = $('#loading .bar');
const prevBtn = $('#prev'), nextBtn = $('#next'), musicBtn = $('#music'), hintEl = $('#hint'), captionEl = $('#caption');
const coverEl = $('#cover');

// 相机固定距离，卡片按视口自适应缩放
const CAM_DIST = 6;
const CARD_ASPECT = 9 / 16;      // 封面 / 结尾 / 占位卡的比例，和手机照片一致
const FILL_W = 0.90;             // 卡片最多占可视宽度的比例
const FILL_H = 0.72;             // 卡片最多占可视高度的比例
const CARD_CENTER_FROM_TOP = 0.42; // 卡片中心在屏幕高度的位置（从上往下），下面留给标题

function fail(message) {
  loadingEl.querySelector('.track')?.remove();
  loadingEl.querySelector('.msg').textContent = message;
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function preload() {
  const total = content.photos.length + 2;
  let done = 0;
  const tick = () => { done += 1; barEl.style.transform = `scaleX(${(done / total).toFixed(3)})`; };
  const sample = [
    content.recipient, content.cover.subtitle, content.ending.title, content.ending.text,
    content.cake.hint, content.cake.holdHint, content.cake.done,
    ...(content.intro?.lines || []), content.intro?.hint || '',
    ...content.photos.flatMap(p => [p.caption, p.text]),
  ].join('');
  const fonts = loadFonts(sample).then(tick);
  const cover = loadImage(content.cover.image).then(tick);
  const images = Promise.all(content.photos.map(p => loadImage(p.src).then(img => { tick(); return img; })));
  await Promise.all([fonts, cover]);
  return images;
}

/** z=0 平面上的可视宽高（世界单位） */
function visibleSize(camera) {
  const visH = 2 * CAM_DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return { visW: visH * camera.aspect, visH };
}

/** 标题逐字淡入：每个字一个 span，用 CSS 动画延迟错开 */
function showCaption(text) {
  captionEl.innerHTML = '';
  captionEl.classList.remove('hide');
  if (!text) return;
  const chars = [...text];
  const step = Math.min(70, 2200 / chars.length);
  chars.forEach((ch, i) => {
    const span = document.createElement('span');
    span.textContent = ch;
    if (ch === ' ') span.className = 'sp';
    span.style.setProperty('--d', `${Math.round(i * step)}ms`);
    captionEl.appendChild(span);
  });
}

function hideCaption() {
  captionEl.classList.add('hide');
}

async function main() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, alpha: true });
  } catch {
    fail('这个浏览器不支持 3D 显示，换个浏览器再试试吧');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  // 不做色调映射：照片颜色按原样输出。Lambert 漫反射除以 π，正对镜头的灯光总量≈π 时白纸恰好为白
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // PCF 才响应 shadow.radius 的柔化

  const images = await preload();

  // ---------- 场景 ----------
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

  scene.add(new THREE.AmbientLight(0xfff4ea, 1.3));
  const key = new THREE.DirectionalLight(0xfff1e0, 1.5);
  key.position.set(2.5, 3.5, 4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9b8ff, 0.5);
  fill.position.set(-3, -1, 3);
  scene.add(fill);

  // 专门负责投影的灯：方向偏正面，影子落在卡片右下方一点，不会甩得太远
  const shadowLight = new THREE.DirectionalLight(0xffffff, 0.5);
  shadowLight.position.set(-0.9, 1.8, 6);
  shadowLight.castShadow = true;
  shadowLight.shadow.mapSize.set(2048, 2048);
  shadowLight.shadow.radius = 8;
  shadowLight.shadow.bias = -0.0006;
  Object.assign(shadowLight.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 15 });
  scene.add(shadowLight);

  // 只显示阴影的透明接收面，放在整叠卡后面
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45 }));
  backdrop.position.z = -1.25;
  backdrop.receiveShadow = true;
  scene.add(backdrop);

  const small = createParticles({ count: 260, size: 0.11, opacity: 0.6 });
  const big = createParticles({ count: 60, size: 0.28, opacity: 0.35, color: 0xffb8c6 });
  scene.add(small.points, big.points);

  // ---------- 卡片 ----------
  // 顺序：照片…… → 蛋糕 → 结尾祝福（封面是全屏 HTML，不在卡组里）
  const kinds = [...content.photos.map(() => 'photo'), 'cake', 'ending'];
  const total = kinds.length;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const cake = createCake({ candles: content.cake.candles });

  const cards = kinds.map((kind, i) => {
    let size = cardSizeFor(CARD_ASPECT), mesh, caption = '';
    if (kind === 'cake') {
      mesh = cake.group;
      size = mesh.userData.size;
    } else if (kind === 'ending') {
      mesh = createCardMesh(drawEnding(content.ending, size), drawBack('', size), size, maxAniso);
    } else {
      const photo = content.photos[i], img = images[i];
      if (img) size = cardSizeFor(img.width / img.height);   // 卡片形状跟随照片比例
      // 正面是手写的话，点一下翻过来才看到照片
      mesh = createCardMesh(drawBack(photo.text, size), drawPhoto(img, size), size, maxAniso);
      caption = photo.caption;
    }
    scene.add(mesh);
    // 开场前所有卡都在"第 -1 张"的右边，即第一张在左边屏外等着滑入
    return { mesh, kind, size, caption, flipAngle: 0, lift: 0, pose: layoutFor(i, -1) };
  });

  // 前面的卡后渲染，避免透明排序问题
  cards.forEach((c, i) => { c.mesh.userData.setRenderOrder(total - i); });

  // 视口相关：可视尺寸，以及每张卡为了填满屏幕需要的缩放
  const view = { visW: 1, visH: 1 };
  const fitScaleFor = card => Math.min((view.visW * FILL_W) / card.size.w, (view.visH * FILL_H) / card.size.h);
  // 把 layout 里 ±1 的归一化 x 换成"刚好在屏外"的世界坐标
  // 余量要覆盖：卡片自身半宽、倾斜后甩出的边角、视差带来的相机偏移，再补偿 z 退后造成的透视内收
  const offscreenX = card => {
    const fs = fitScaleFor(card);
    const halfW = (card.size.w * fs) / 2, halfH = (card.size.h * fs) / 2;
    return (view.visW / 2 + halfW + halfH * 0.16 + 0.5) * ((CAM_DIST + 0.35) / CAM_DIST);
  };

  function applyPose(card) {
    const p = card.pose, m = card.mesh;
    const fs = fitScaleFor(card);
    m.position.set(p.x * offscreenX(card), p.y, p.z + card.lift);
    m.rotation.set(p.rx, p.ry + card.flipAngle, p.rz);
    m.scale.setScalar((p.scale + card.lift * 0.12) * fs);
    m.visible = p.visible;
    m.userData.setCastShadow(p.opacity > 0.4); // 淡出到一半后不再投影，避免半透明卡带着实影
    m.userData.setOpacity(p.opacity);
  }

  // 按连续位置 pos（索引单位，可为小数）摆放所有卡：在相邻两个整数位置的布局之间插值
  function renderAt(pos) {
    const lo = Math.floor(pos), frac = pos - lo;
    cards.forEach((c, i) => {
      c.pose = frac === 0 ? layoutFor(i, lo) : lerpPose(layoutFor(i, lo), layoutFor(i, lo + 1), frac);
      if (i === lo || i === lo + 1) c.pose.z += Math.sin(Math.PI * frac) * 0.28; // 交接的两张朝镜头轻抬
      applyPose(c);
    });
  }
  renderAt(-1);

  const nav = createNavigation({ total, flippable: i => kinds[i] === 'photo' });
  const current = () => cards[nav.state.index];
  const carousel = createCarousel({ total });
  carousel.jump(-1);

  // ---------- 音乐 ----------
  let audio = null, musicStarted = false;
  if (content.music) {
    audio = new Audio(content.music);
    audio.loop = true;
    audio.volume = 0.6;
    audio.preload = 'auto';
    audio.addEventListener('error', () => { audio = null; musicBtn.hidden = true; });
  }
  function startMusic() {
    if (!audio || musicStarted) return;
    musicStarted = true;
    audio.play()
      .then(() => { musicBtn.hidden = false; musicBtn.classList.remove('off'); })
      .catch(() => { musicBtn.hidden = false; musicBtn.classList.add('off'); });
  }
  musicBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!audio) return;
    if (audio.paused) { audio.play().catch(() => {}); musicBtn.classList.remove('off'); }
    else { audio.pause(); musicBtn.classList.add('off'); }
  });

  // ---------- UI ----------
  let hintShown = false;
  function updateUI() {
    const { index } = nav.state;
    prevBtn.hidden = index === 0;
    nextBtn.hidden = index === total - 1;
    if (index === 0 && !hintShown) {
      hintShown = true;
      hintEl.hidden = false;
      requestAnimationFrame(() => hintEl.classList.add('show'));
      setTimeout(() => hintEl.classList.remove('show'), 3500);
    }
  }

  // ---------- 翻页（弹簧驱动） ----------
  let settledIndex = -1;          // 上次停稳时所在的卡
  let flipping = false;

  /** 离开 settledIndex 去 to：清理当前卡的状态，启动弹簧 */
  function transitionTo(to, initialVelocity = 0) {
    if (settledIndex >= 0 && cards[settledIndex].kind === 'cake') stopBlowing();
    if (settledIndex >= 0) cards[settledIndex].flipAngle = cards[settledIndex].flipAngle > Math.PI / 2 ? Math.PI : 0;
    cards[to].flipAngle = 0;
    hideCaption();
    carousel.transitionTo(to, initialVelocity);
  }

  /** 弹簧停稳后的收尾 */
  function onSettled() {
    const index = nav.state.index;
    nav.finish();
    updateUI();
    if (index !== settledIndex || captionEl.classList.contains('hide')) {
      settledIndex = index;
      if (cards[index].kind === 'cake') startBlowing();
      else if (cards[index].kind === 'photo') showCaption('');   // 照片卡的标题等翻到照片那面再浮现
      else showCaption(cards[index].caption);
    }
  }

  /** 键盘 / 按钮 / 自动前进用的整页翻页 */
  function go(step) {
    if (carousel.grabbing || flipping || letterOpen) return;
    if (carousel.active) nav.finish();            // 过渡途中再按：接管，带着当前速度继续
    const a = step > 0 ? nav.next() : nav.prev();
    if (a) transitionTo(a.to, carousel.velocity);
    else if (carousel.active) nav.lock();         // 到头了，让进行中的过渡继续把状态机占着
  }

  // ---------- 吹蜡烛 ----------
  let blowing = null; // { mic, meter, holding, done }
  let audioCtx = null; // 在点封面的手势里创建，iOS 才允许之后读麦克风
  const cakeMeter = createBlowMeter({ steps: content.cake.candles, threshold: content.cake.threshold, fillSeconds: content.cake.blowSeconds }); // 跨次进入保留进度，灭掉的蜡烛不用重吹
  // 网址加 ?debug 时在左上角显示麦克风读数，方便真机上调灵敏度
  let debugEl = null;
  if (location.search.includes('debug')) {
    debugEl = document.createElement('div');
    debugEl.style.cssText = 'position:fixed;top:8px;left:8px;z-index:20;font:12px/1.4 monospace;color:#fff;background:rgba(0,0,0,.55);padding:6px 8px;border-radius:6px;pointer-events:none;white-space:pre';
    document.body.appendChild(debugEl);
  }
  async function startBlowing() {
    blowing = { mic: null, meter: cakeMeter, holding: false, done: cakeMeter.progress >= 1 };
    const mine = blowing;
    showCaption(content.cake.holdHint);
    const mic = await startMic(audioCtx);
    if (blowing !== mine) { mic?.stop(); return; }   // 等麦克风期间已经划走了
    if (mic) { mine.mic = mic; showCaption(content.cake.hint); }
  }
  function stopBlowing() {
    blowing?.mic?.stop();
    blowing = null;
    cake.setWind(0);
  }
  function updateBlowing(dt) {
    if (!blowing) return;
    const micLevel = blowing.mic ? blowing.mic.level() : 0;
    const level = blowing.holding ? Math.max(0.6, micLevel) : micLevel;
    const progress = blowing.meter.feed(level, dt);
    cake.setWind(Math.min(1, (level / Math.max(0.05, blowing.meter.threshold * 3)) * 0.8));
    cake.setBlow(progress);
    if (debugEl) {
      debugEl.textContent = `mic ${blowing.mic ? 'on' : 'off'}  level ${micLevel.toFixed(3)}  floor ${blowing.meter.floor.toFixed(3)}  th ${blowing.meter.threshold.toFixed(3)}  progress ${(progress * 100).toFixed(0)}%`;
    }
    if (progress >= 1 && !blowing.done) {
      blowing.done = true;
      showCaption(content.cake.done); // 停在这一页，由她自己划到下一页
    }
  }

  async function flip({ index, flipped }) {
    const card = cards[index];
    const from = card.flipAngle, to = flipped ? Math.PI : 0;
    flipping = true;
    if (!flipped) hideCaption();                    // 翻回文字面时把标题收起
    let revealed = false;
    await animate(720, ease.inOutCubic, t => {
      card.flipAngle = from + (to - from) * t;
      card.lift = Math.sin(Math.PI * t) * 0.45;
      applyPose(card);
      if (flipped && !revealed && t >= 0.5) {       // 照片露出来的那一刻，标题开始逐字浮现
        revealed = true;
        showCaption(card.caption);
      }
    });
    card.lift = 0;
    applyPose(card);
    flipping = false;
    nav.finish();
  }

  // 手指位移(px) → 索引单位：拖过"一张卡滑出屏幕"的距离算 1
  const pxToIndex = dx => (dx * (view.visW / window.innerWidth)) / offscreenX(current());
  let started = false;   // 点过封面之后才响应手势

  /** 松手：根据位置和速度决定落到哪张，再交给弹簧 */
  function release(info) {
    if (!carousel.grabbing) return;
    const base = nav.state.index;
    const velocity = info ? pxToIndex(info.vx * 1000) : 0;
    const to = carousel.release({ base, velocity });
    let ok = to === base ? nav.lock() : (to > base ? nav.next() : nav.prev());
    if (!ok) { nav.lock(); }
    transitionTo(to, velocity);
  }

  attachGestures(renderer.domElement, {
    onPress(down) {
      if (blowing) blowing.holding = down;
      if (down) audioCtx?.resume().catch(() => {});
      if (!down || !started || flipping) return;
      // 过渡途中按住：直接接管，把状态机还回来
      if (carousel.active && !carousel.grabbing) nav.finish();
      if (!nav.state.animating) carousel.grab();
    },
    onDragMove(dx) {
      if (!carousel.grabbing) return;
      carousel.drag(pxToIndex(dx));
      if (Math.abs(carousel.target - nav.state.index) > 0.04) hideCaption();
    },
    onSwipe(dir, info) {
      startMusic();
      if (!started) return;
      if (info) { release(info); return; }          // 手指滑动：按物理松手
      go(dir === 'right' ? 1 : -1);                  // 键盘
    },
    onTap() {
      startMusic();
      if (!started) return;
      if (carousel.grabbing) {
        // 没怎么动就松开了：原地停下，然后翻面
        carousel.jump(nav.state.index);
        renderAt(nav.state.index);
        nav.finish();
      }
      if (carousel.active) return;
      if (current().kind === 'ending') { openLetter(); return; }
      const a = nav.flip();
      if (a) flip(a);
    },
    onCancel(info) { if (started) release(info); },
  });
  prevBtn.addEventListener('click', () => { startMusic(); go(-1); });
  nextBtn.addEventListener('click', () => { startMusic(); go(1); });

  // ---------- 视差 ----------
  const parallax = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  window.addEventListener('pointermove', e => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });
  window.addEventListener('deviceorientation', e => {
    if (e.gamma == null || e.beta == null) return;
    target.x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
    target.y = THREE.MathUtils.clamp((e.beta - 45) / -30, -1, 1);
  });

  // ---------- 尺寸 ----------
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = CAM_DIST;
    camera.updateProjectionMatrix();
    Object.assign(view, visibleSize(camera));
    // 让原点（卡片中心）出现在屏幕 CARD_CENTER_FROM_TOP 的高度
    lookY = -(0.5 - CARD_CENTER_FROM_TOP) * view.visH;
    renderAt(carousel.position);
  }
  let lookY = 0;
  window.addEventListener('resize', resize);
  resize();

  // 标题贴在当前卡片底边下方：把卡片底边中点投影到屏幕
  const bottomPoint = new THREE.Vector3();
  function placeCaption() {
    const card = current();
    const m = card.mesh;
    bottomPoint.set(0, -card.size.h / 2 * m.scale.y, 0).applyQuaternion(m.quaternion).add(m.position);
    bottomPoint.project(camera);
    const y = (1 - bottomPoint.y) / 2 * window.innerHeight;
    captionEl.style.top = `${Math.round(y + 18)}px`;
  }

  // ---------- 主循环 ----------
  let last = performance.now();
  function loop(now) {
    const elapsedMs = now - last;
    last = now;
    // 补间按真实时间推进，低帧率下动画时长也不变；粒子用限幅 dt 防止跳跃
    tickTweens(elapsedMs);
    const dt = Math.min(0.05, elapsedMs / 1000);
    small.update(dt);
    big.update(dt);
    cake.update(dt);
    updateBlowing(dt);
    if (carousel.active) {
      // 弹簧按真实时间推进（上限 0.25s），低帧率下过渡时长也不变
      const settled = carousel.step(Math.min(0.25, elapsedMs / 1000));
      renderAt(carousel.position);
      if (settled) onSettled();
    }
    parallax.x += (target.x - parallax.x) * 0.04;
    parallax.y += (target.y - parallax.y) * 0.04;
    camera.position.x = parallax.x * 0.4;
    camera.position.y = lookY + parallax.y * 0.25;
    camera.lookAt(0, lookY, 0);
    placeCaption();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  // 先渲染一帧把着色器编译掉，再淡出加载层，否则淡出动画会被首帧卡顿吞掉
  renderer.render(scene, camera);
  requestAnimationFrame(loop);

  // ---------- 全屏封面 ----------
  coverEl.style.backgroundImage = `url("${content.cover.image}")`;
  coverEl.querySelector('.en').textContent = content.cover.title;
  coverEl.querySelector('.zh').textContent = content.recipient;
  coverEl.querySelector('.cover-sub').textContent = content.cover.subtitle;
  coverEl.classList.remove('pending');
  prevBtn.hidden = nextBtn.hidden = true;
  nav.lock(); // 封面期间不响应翻页
  // ---------- 结尾信纸 ----------
  const letterEl = $('#letter');
  let letterOpen = false;
  function openLetter() {
    const lines = content.ending.text.split('\n');
    const box = letterEl.querySelector('.letter-lines');
    const closeBtn = letterEl.querySelector('.letter-close');
    letterEl.querySelector('.letter-title').textContent = content.ending.title;
    closeBtn.textContent = content.ending.close || '收起';
    box.innerHTML = '';
    let t = 900;
    lines.forEach(line => {
      const span = document.createElement('span');
      span.textContent = line;
      span.style.setProperty('--d', `${t}ms`);
      box.appendChild(span);
      t += line ? 650 : 250;
    });
    closeBtn.classList.remove('show');
    letterEl.hidden = false;
    letterEl.classList.remove('hide');
    letterEl.scrollTop = 0;
    letterOpen = true;
    setTimeout(() => closeBtn.classList.add('show'), t + 400);
  }
  letterEl.querySelector('.letter-close').addEventListener('click', () => {
    letterEl.classList.add('hide');
    letterOpen = false;
    setTimeout(() => { if (!letterOpen) letterEl.hidden = true; }, 800);
  });

  // ---------- 前言页 ----------
  const introEl = $('#intro');
  const introLines = content.intro?.lines?.length ? content.intro.lines : null;
  function showIntro() {
    const box = introEl.querySelector('.intro-lines');
    const hint = introEl.querySelector('.intro-hint');
    box.innerHTML = '';
    const step = 900;                       // 每行间隔
    introLines.forEach((line, i) => {
      const span = document.createElement('span');
      span.textContent = line;
      span.style.setProperty('--d', `${400 + i * step}ms`);
      box.appendChild(span);
    });
    hint.textContent = content.intro.hint || '点一下，继续';
    introEl.hidden = false;
    const total = 400 + introLines.length * step + 600;
    setTimeout(() => hint.classList.add('show'), total);
    let ready = false;
    setTimeout(() => { ready = true; }, 1500); // 防止手抖连点直接跳过
    introEl.addEventListener('click', () => {
      if (!ready || introEl.classList.contains('hide')) return;
      introEl.classList.add('hide');
      beginDeck();
    });
  }

  function beginDeck() {
    started = true;
    transitionTo(0);            // 第一张从左边滑入；停稳时 onSettled 释放状态机
  }

  coverEl.addEventListener('click', () => {
    if (coverEl.classList.contains('hide')) return;
    startMusic();
    audioCtx = createAudioContext();
    coverEl.classList.add('hide');
    if (introLines) showIntro();
    else beginDeck();
  }, { once: true });

  loadingEl.classList.add('hide');
}

main().catch(err => {
  console.error(err);
  fail('加载出了点问题，刷新试试');
});
