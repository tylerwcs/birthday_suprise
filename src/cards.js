// 用 Canvas 2D 绘制卡片正反面，再做成带圆角和厚度的 Three.js 卡片
import * as THREE from 'three';
import { fitText } from './textLayout.js';

// 卡片最大尺寸（世界单位）；实际尺寸按照片比例在这个框内 contain
export const CARD = { maxW: 2.0, maxH: 2.14, depth: 0.02, radius: 0.07, maxPx: 1536 };
const DEFAULT_ASPECT = 1.76 / 2.14; // 封面 / 结尾 / 占位卡的比例

export const FONTS = {
  zh: '"Ma Shan Zheng", "KaiTi", "STKaiti", cursive',
  en: '"Caveat", "Ma Shan Zheng", cursive',
};

/** 等手写字体就位再绘制贴图；sampleText 用于让 Google Fonts 只下载需要的字形分片。 */
export async function loadFonts(sampleText, timeoutMs = 3000) {
  if (!document.fonts) return;
  const wanted = [
    document.fonts.load('64px "Ma Shan Zheng"', sampleText),
    document.fonts.load('64px "Caveat"', 'Happy Birthday'),
  ];
  await Promise.race([Promise.all(wanted), new Promise(r => setTimeout(r, timeoutMs))]);
}

/** 给定宽高比，返回卡片的世界尺寸 {w, h} */
export function cardSizeFor(aspect = DEFAULT_ASPECT) {
  let h = CARD.maxH, w = h * aspect;
  if (w > CARD.maxW) { w = CARD.maxW; h = w / aspect; }
  return { w, h };
}

function canvasFor({ w, h }) {
  const s = CARD.maxPx / Math.max(w, h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * s);
  c.height = Math.round(h * s);
  return c;
}

function paper(ctx, color) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(0,0,0,0.035)';
  const n = Math.round((width * height) / 210);
  for (let i = 0; i < n; i++) ctx.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
}

function drawParagraph(ctx, text, { x, y, maxWidth, maxHeight, fontSize, minFontSize, lineHeight, color, font }) {
  const measureAt = size => { ctx.font = `${size}px ${font}`; return s => ctx.measureText(s).width; };
  const { fontSize: size, lines } = fitText(text, { maxWidth, maxHeight, fontSize, minFontSize, lineHeight, measureAt });
  ctx.font = `${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = size * lineHeight;
  let cy = y + (maxHeight - lines.length * step) / 2 + step / 2;
  for (const line of lines) { ctx.fillText(line, x, cy); cy += step; }
}

/** 照片卡正面：照片铺满整张卡 */
export function drawPhoto(image, size) {
  const c = canvasFor(size), ctx = c.getContext('2d');
  if (image) {
    ctx.drawImage(image, 0, 0, c.width, c.height);
    return c;
  }
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#d9c8b8'); g.addColorStop(1, '#a89383');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `${c.width * 0.07}px ${FONTS.zh}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('照片走丢了', c.width / 2, c.height / 2);
  return c;
}

/** 卡片背面：米色纸 + 手写长文字 */
export function drawBack(text, size) {
  const c = canvasFor(size), ctx = c.getContext('2d');
  paper(ctx, '#f4ecd8');
  const m = c.width * 0.09;
  if (text) {
    drawParagraph(ctx, text, {
      x: c.width / 2, y: m, maxWidth: c.width - m * 2, maxHeight: c.height - m * 2 - c.width * 0.08,
      fontSize: c.width * 0.064, minFontSize: c.width * 0.034, lineHeight: 1.65, color: '#4a3f35', font: FONTS.zh,
    });
  }
  ctx.fillStyle = 'rgba(160,80,80,0.55)';
  ctx.font = `${c.width * 0.055}px ${FONTS.en}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('♡', c.width / 2, c.height - m * 0.8);
  return c;
}

/** 封面卡：暖色渐变 + 标题 + 名字 + 底部提示 */
export function drawCoverCard({ title, recipient, subtitle }, size) {
  const c = canvasFor(size), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#f7b7a3'); g.addColorStop(0.55, '#e88ea6'); g.addColorStop(1, '#8e7cc3');
  ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `700 ${c.width * 0.165}px ${FONTS.en}`;
  ctx.fillText(title, c.width / 2, c.height * 0.40);
  ctx.font = `${c.width * 0.125}px ${FONTS.zh}`;
  ctx.fillText(recipient, c.width / 2, c.height * 0.56);

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = `${c.width * 0.055}px ${FONTS.zh}`;
  ctx.fillText(subtitle, c.width / 2, c.height * 0.86);
  return c;
}

/** 结尾祝福卡 */
export function drawEnding({ title, text }, size) {
  const c = canvasFor(size), ctx = c.getContext('2d');
  paper(ctx, '#f4ecd8');
  ctx.fillStyle = '#b3554f';
  ctx.font = `${c.width * 0.12}px ${FONTS.zh}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(title, c.width / 2, c.height * 0.12);
  const m = c.width * 0.08;
  drawParagraph(ctx, text, {
    x: c.width / 2, y: c.height * 0.21, maxWidth: c.width - m * 2, maxHeight: c.height * 0.74,
    fontSize: c.width * 0.06, minFontSize: c.width * 0.026, lineHeight: 1.6, color: '#4a3f35', font: FONTS.zh,
  });
  return c;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ShapeGeometry 的 UV 是形状坐标，映射回 0..1
function remapUV(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}

/**
 * 圆角、有厚度的卡片：正面贴图 + 背面贴图 + 白色侧边。
 * 返回 THREE.Group，userData 上有 setOpacity / setCastShadow / setRenderOrder / size。
 */
export function createCardMesh(frontCanvas, backCanvas, size, maxAnisotropy = 1) {
  const { w, h } = size;
  const tex = canvas => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAnisotropy;
    return t;
  };
  const frontMat = new THREE.MeshStandardMaterial({ map: tex(frontCanvas), roughness: 0.5, transparent: true });
  const backMat = new THREE.MeshStandardMaterial({ map: tex(backCanvas), roughness: 0.85, transparent: true });
  const sideMat = new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.9, transparent: true });
  const hiddenMat = new THREE.MeshBasicMaterial({ visible: false });

  const shape = roundedRect(w, h, CARD.radius);
  const faceGeo = new THREE.ShapeGeometry(shape, 12);
  remapUV(faceGeo, w, h);

  const front = new THREE.Mesh(faceGeo, frontMat);
  front.position.z = CARD.depth / 2;
  const back = new THREE.Mesh(faceGeo, backMat);
  back.rotation.y = Math.PI;                 // 旋转而非镜像，背面文字从背后看是正的
  back.position.z = -CARD.depth / 2;
  const sideGeo = new THREE.ExtrudeGeometry(shape, { depth: CARD.depth, bevelEnabled: false, curveSegments: 12 });
  sideGeo.translate(0, 0, -CARD.depth / 2);
  const sides = new THREE.Mesh(sideGeo, [hiddenMat, sideMat]); // 组 0 是盖面（隐藏），组 1 是侧壁

  const parts = [front, back, sides];
  for (const p of parts) { p.castShadow = true; p.receiveShadow = true; }

  const group = new THREE.Group();
  group.add(...parts);
  group.userData.size = { w, h };
  group.userData.setOpacity = v => { frontMat.opacity = backMat.opacity = sideMat.opacity = v; };
  group.userData.setCastShadow = v => { for (const p of parts) p.castShadow = v; };
  group.userData.setRenderOrder = n => { for (const p of parts) p.renderOrder = n; };
  return group;
}
