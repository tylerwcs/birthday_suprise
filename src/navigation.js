// 翻页 / 翻面状态机（纯逻辑）
// 每个成功的动作都会把 animating 置为 true，动画结束后由调用方 finish()。

export function createNavigation({ total, flippable }) {
  let index = 0;
  let flipped = false;
  let animating = false;

  return {
    get state() { return { index, flipped, animating }; },

    next() {
      if (animating || index >= total - 1) return null;
      const from = index;
      index += 1; flipped = false; animating = true;
      return { type: 'next', from, to: index };
    },

    prev() {
      if (animating || index <= 0) return null;
      const from = index;
      index -= 1; flipped = false; animating = true;
      return { type: 'prev', from, to: index };
    },

    flip() {
      if (animating || !flippable(index)) return null;
      flipped = !flipped; animating = true;
      return { type: 'flip', index, flipped };
    },

    /** 外部动画（比如开场滑入）占用状态机；已在动画中则返回 false */
    lock() {
      if (animating) return false;
      animating = true;
      return true;
    },

    finish() { animating = false; },
  };
}
