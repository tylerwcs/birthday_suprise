// 背景漂浮光点
import * as THREE from 'three';

function spriteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const rand = (a, b) => a + Math.random() * (b - a);

export function createParticles({ count = 250, size = 0.14, opacity = 0.7, color = 0xffd6a5 } = {}) {
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(-7, 7);
    pos[i * 3 + 1] = rand(-6, 6);
    pos[i * 3 + 2] = rand(-7, -1.2);
    phase[i] = rand(0, Math.PI * 2);
    speed[i] = rand(0.08, 0.25);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: spriteTexture(),
    color, size, opacity,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  let time = 0;

  return {
    points,
    update(dt) {
      time += dt;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] += speed[i] * dt;
        pos[i * 3] += Math.sin(time * 0.6 + phase[i]) * 0.0025;
        if (pos[i * 3 + 1] > 6) pos[i * 3 + 1] = -6;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
