// 生日蛋糕：双层蛋糕 + 蜡烛 + 会被吹歪、吹灭的火苗 + 烟
import * as THREE from 'three';

const CANDLE_COLORS = [0xf9a8c9, 0xa8d8f9, 0xfbe38e, 0xb8f0c8, 0xd9b8f9, 0xffc7a3];

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 96;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 60, 2, 32, 52, 40);
  g.addColorStop(0, 'rgba(255,255,235,1)');
  g.addColorStop(0.25, 'rgba(255,220,120,0.95)');
  g.addColorStop(0.6, 'rgba(255,140,40,0.55)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(32, 52, 26, 44, 0, 0, Math.PI * 2);
  ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(200,200,210,0.6)');
  g.addColorStop(1, 'rgba(200,200,210,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, transparent: true, ...extra });

/**
 * 返回 { group, update(dt), setWind(level 0..1), setBlow(progress 0..1), litCount }
 * group.userData 带 size / setOpacity / setCastShadow / setRenderOrder，能像卡片一样被布局。
 */
export function createCake({ candles = 5 } = {}) {
  const group = new THREE.Group();
  const materials = [];
  const meshes = [];
  const add = (geo, mat, y, parent = group) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    parent.add(m); materials.push(mat); meshes.push(m);
    return m;
  };

  // 盘子与两层蛋糕
  add(new THREE.CylinderGeometry(0.98, 0.98, 0.04, 56), std(0xfbf7f0, { roughness: 0.4 }), -0.64);
  add(new THREE.CylinderGeometry(0.72, 0.72, 0.38, 56), std(0xf6b3c3), -0.43);
  add(new THREE.TorusGeometry(0.71, 0.05, 12, 56), std(0xfff8f2, { roughness: 0.5 }), -0.24).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.5, 0.5, 0.32, 56), std(0xfff1e2), -0.08);
  add(new THREE.TorusGeometry(0.49, 0.045, 12, 56), std(0xf6b3c3, { roughness: 0.5 }), 0.08).rotation.x = Math.PI / 2;
  // 顶上撒一圈小糖珠
  const bead = new THREE.SphereGeometry(0.025, 10, 8);
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const m = add(bead, std(CANDLE_COLORS[i % CANDLE_COLORS.length], { roughness: 0.3 }), 0.11);
    m.position.set(Math.cos(a) * 0.4, 0.11, Math.sin(a) * 0.4);
  }

  // 蜡烛
  const flameTex = flameTexture();
  const TOP = 0.08;
  const flames = [];
  const candleGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.3, 16);
  const wickGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.045, 6);
  for (let i = 0; i < candles; i++) {
    const a = (i / candles) * Math.PI * 2 - Math.PI / 2;
    const r = candles === 1 ? 0 : 0.26;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const c = add(candleGeo, std(CANDLE_COLORS[i % CANDLE_COLORS.length], { roughness: 0.5 }), TOP + 0.15);
    c.position.x = x; c.position.z = z;
    const w = add(wickGeo, std(0x3a2a22), TOP + 0.32);
    w.position.x = x; w.position.z = z;

    const mat = new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, TOP + 0.43, z);
    sprite.scale.set(0.13, 0.22, 1);
    group.add(sprite);
    materials.push(mat);
    flames.push({ sprite, mat, base: { x, y: TOP + 0.43, z }, phase: Math.random() * Math.PI * 2, lit: true });
  }

  // 火光
  const glow = new THREE.PointLight(0xffb060, 0.5, 4, 2);
  glow.position.set(0, TOP + 0.7, 0);
  group.add(glow);

  // 烟
  const smokeTex = smokeTexture();
  const puffs = [];
  function puff(at) {
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.7 });
      const s = new THREE.Sprite(mat);
      s.position.set(at.x + (Math.random() - 0.5) * 0.04, at.y, at.z + (Math.random() - 0.5) * 0.04);
      s.scale.setScalar(0.08);
      group.add(s);
      puffs.push({ s, mat, vx: (Math.random() - 0.5) * 0.12 + windX * 0.4, vy: 0.35 + Math.random() * 0.25, life: 0, ttl: 1.4 + Math.random() * 0.6 });
    }
  }

  let time = 0, windX = 0, opacity = 1;
  const api = {
    group,
    get litCount() { return flames.filter(f => f.lit).length; },

    setWind(level) { windX = level; },

    /** progress 0..1 → 前 floor(progress*n) 根蜡烛熄灭 */
    setBlow(progress) {
      const out = Math.min(candles, Math.floor(progress * candles + 1e-9));
      flames.forEach((f, i) => {
        if (f.lit && i < out) {
          f.lit = false;
          f.sprite.visible = false;
          puff(f.base);
        }
      });
    },

    update(dt) {
      time += dt;
      const lit = api.litCount;
      flames.forEach(f => {
        if (!f.lit) return;
        const flick = 1 + 0.18 * Math.sin(time * 13 + f.phase) + 0.08 * Math.sin(time * 29 + f.phase * 2);
        const shrink = 1 - windX * 0.45;
        f.sprite.scale.set(0.13 * flick * shrink, 0.22 * (0.7 + 0.3 * flick) * shrink, 1);
        f.sprite.position.set(
          f.base.x + windX * 0.09 + Math.sin(time * 7 + f.phase) * 0.006,
          f.base.y - windX * 0.03,
          f.base.z,
        );
        f.mat.opacity = opacity * (0.85 + 0.15 * Math.sin(time * 17 + f.phase));
      });
      glow.intensity = (lit / candles) * 0.5 * (1 + 0.25 * Math.sin(time * 9)) * opacity;

      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life += dt;
        p.s.position.x += p.vx * dt;
        p.s.position.y += p.vy * dt;
        p.s.scale.setScalar(0.08 + p.life * 0.16);
        p.mat.opacity = 0.7 * (1 - p.life / p.ttl) * opacity;
        if (p.life >= p.ttl) { group.remove(p.s); p.mat.dispose(); puffs.splice(i, 1); }
      }
    },
  };

  group.rotation.x = 0.42; // 朝镜头倾一点，能看到蛋糕顶面
  group.userData.size = { w: 2.0, h: 2.0 };
  group.userData.setOpacity = v => { opacity = v; for (const m of materials) if (!(m instanceof THREE.SpriteMaterial)) m.opacity = v; };
  group.userData.setCastShadow = v => { for (const m of meshes) m.castShadow = v; };
  group.userData.setRenderOrder = () => {};
  return api;
}
