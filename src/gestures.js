// 手势判定（纯逻辑）+ DOM 绑定

/**
 * 根据一次按下-抬起的位移和用时判定手势。
 * dt 单位 ms；velocity 单位 px/ms。
 * 返回 'tap' | 'right' | 'left' | null
 */
export function classifyGesture({ dx, dy, dt }, { threshold = 60, velocity = 0.5, tapSlop = 8 } = {}) {
  if (Math.abs(dx) <= tapSlop && Math.abs(dy) <= tapSlop) return 'tap';
  if (Math.abs(dx) < Math.abs(dy) * 0.8) return null; // 主要是竖直滑动
  const vx = dt > 0 ? dx / dt : 0;
  if (dx >= threshold || vx >= velocity) return 'right';
  if (dx <= -threshold || vx <= -velocity) return 'left';
  return null;
}

/**
 * 在 el 上绑定 pointer 事件与键盘：
 *   onDragMove(dx, dy)  拖动中
 *   onSwipe('left'|'right', info)   info = { dx, dy, dt, vx }，vx 单位 px/ms；键盘触发时 info 为 null
 *   onTap()
 *   onCancel(info)      松手但不构成手势
 *   onPress(down)       按下 / 松开（用于"长按吹蜡烛"这类需要持续状态的交互）
 */
export function attachGestures(el, handlers, options) {
  let start = null;
  el.style.touchAction = 'none';

  el.addEventListener('pointerdown', e => {
    start = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
    el.setPointerCapture(e.pointerId);
    handlers.onPress?.(true);
  });

  el.addEventListener('pointermove', e => {
    if (!start || e.pointerId !== start.id) return;
    handlers.onDragMove?.(e.clientX - start.x, e.clientY - start.y);
  });

  el.addEventListener('pointerup', e => {
    if (!start || e.pointerId !== start.id) return;
    const g = { dx: e.clientX - start.x, dy: e.clientY - start.y, dt: performance.now() - start.t };
    g.vx = g.dt > 0 ? g.dx / g.dt : 0;
    start = null;
    handlers.onPress?.(false);
    const kind = classifyGesture(g, options);
    if (kind === 'tap') handlers.onTap?.();
    else if (kind) handlers.onSwipe?.(kind, g);
    else handlers.onCancel?.(g);
  });

  el.addEventListener('pointercancel', () => { start = null; handlers.onPress?.(false); handlers.onCancel?.(null); });

  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') handlers.onSwipe?.('right', null);
    else if (e.key === 'ArrowLeft') handlers.onSwipe?.('left', null);
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handlers.onTap?.(); }
  });
}
