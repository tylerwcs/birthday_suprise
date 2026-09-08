// 横向轮播布局（纯逻辑）：当前卡居中，没看的在左边屏外，看过的在右边屏外。
// x 是归一化的"屏外方向"：-1 = 完全在左边屏外，+1 = 完全在右边屏外，由渲染层按视口宽度换算成世界坐标。

export function layoutFor(cardIndex, currentIndex) {
  const offset = cardIndex - currentIndex;
  if (offset === 0) {
    return { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, opacity: 1, visible: true };
  }
  const dir = offset < 0 ? 1 : -1;          // 看过的去右边，没看的在左边
  const near = Math.abs(offset) === 1;      // 只有紧邻的一张需要参与滑入/滑出动画
  return {
    x: dir,
    y: 0.12,
    z: -0.35,
    rx: 0,
    ry: dir * -0.3,                         // 滑动时带一点朝向变化，像被甩出去/递进来
    rz: dir * -0.15,
    scale: 0.92,
    opacity: near ? 1 : 0,
    visible: near,
  };
}

const NUM_KEYS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'scale', 'opacity'];

export function lerpPose(a, b, t) {
  const out = { visible: a.visible || b.visible };
  for (const k of NUM_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}
