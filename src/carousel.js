// 轮播的物理模型（纯逻辑）：一个连续的"当前位置" cur（以卡片索引为单位），
// 用弹簧追随目标。拖动时目标跟着手指（硬弹簧、有惯性），松手后目标是某张卡（软弹簧、临界阻尼）。

/** 越界时带阻力的夹取：超出 [lo, hi] 的部分被压缩成最多 give 的位移 */
export function rubber(x, lo, hi, give = 0.25) {
  if (x < lo) return lo - give * (1 - Math.exp(-(lo - x) * 2.5));
  if (x > hi) return hi + give * (1 - Math.exp(-(x - hi) * 2.5));
  return x;
}

/**
 * 松手时决定落到哪张卡。
 * base：松手前的基准索引；cur：当前位置；velocity：索引/秒（正 = 往下一张）。
 * 位移超过 threshold 或速度超过 flick 就翻一张，否则回到 base。
 */
export function decideTarget({ base, cur, velocity = 0, total, threshold = 0.3, flick = 1.2 }) {
  const p = cur - base;
  const projected = p + velocity * 0.2;
  let step = 0;
  if (Math.abs(velocity) >= flick) step = Math.sign(velocity);
  else if (projected > threshold) step = 1;
  else if (projected < -threshold) step = -1;
  return Math.max(0, Math.min(total - 1, base + step));
}

export function createCarousel({ total, stiffness = 110, dampingRatio = 0.92, followStiffness = 600 }) {
  const st = { cur: -1, vel: 0, target: -1, active: false, grabbing: false, grabCur: 0 };

  return {
    get position() { return st.cur; },
    get velocity() { return st.vel; },
    get target() { return st.target; },
    get active() { return st.active; },
    get grabbing() { return st.grabbing; },

    /** 直接放到某个位置，不动画 */
    jump(pos) { st.cur = st.target = pos; st.vel = 0; st.active = false; st.grabbing = false; },

    /** 弹簧过渡到某张卡，可带初速度（索引/秒） */
    transitionTo(index, initialVelocity = 0) {
      st.target = index; st.vel = initialVelocity; st.active = true; st.grabbing = false;
    },

    /** 手指按住：从当前位置接管（过渡途中也可以） */
    grab() { st.grabbing = true; st.grabCur = st.cur; st.target = st.cur; st.active = true; },

    /** 拖动中，delta 为相对按下点的位移（索引单位，正 = 往下一张） */
    drag(delta) {
      if (!st.grabbing) return;
      st.target = rubber(st.grabCur + delta, 0, total - 1);
    },

    /** 松手：返回应该落到的索引，调用方决定导航后再 transitionTo */
    release({ base, velocity = 0 }) {
      st.grabbing = false;
      return decideTarget({ base, cur: st.cur, velocity, total });
    },

    /** 每帧推进物理，返回是否刚好停稳 */
    step(dt) {
      if (!st.active) return false;
      const k = st.grabbing ? followStiffness : stiffness;
      const c = 2 * Math.sqrt(k) * (st.grabbing ? 1 : dampingRatio);
      const n = Math.max(1, Math.ceil(dt / 0.008));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        const a = -k * (st.cur - st.target) - c * st.vel;
        st.vel += a * h;
        st.cur += st.vel * h;
      }
      if (!st.grabbing && Math.abs(st.cur - st.target) < 0.0015 && Math.abs(st.vel) < 0.02) {
        st.cur = st.target; st.vel = 0; st.active = false;
        return true;
      }
      return false;
    },
  };
}
