// 极简补间：animate() 登记一个动画，主循环每帧调用 tickTweens(dt)

export const ease = {
  linear: t => t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

const active = new Set();

/** onUpdate 立即收到 0，之后随 tick 收到缓动后的 0..1；结束时 resolve。 */
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
