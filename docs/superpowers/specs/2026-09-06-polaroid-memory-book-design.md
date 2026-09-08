# 3D 拍立得回忆录生日网页 — 设计文档

日期：2026-09-06

## 目标

一个发给前任的生日祝福网页：一叠 3D 拍立得照片卡，点击翻面看文字，向右划看下一张。
开场有封面，结尾有生日祝福页，带背景音乐和漂浮光点氛围。手机竖屏优先，桌面端也可用。
所有文字使用手写字体。

## 技术选型

- 纯静态站点，无构建步骤。`index.html` 通过 `<script type="importmap">` 从 CDN 加载 Three.js（固定版本 0.170.0）。
- 部署方式：整个文件夹拖到 Netlify Drop / GitHub Pages / Vercel。
- 本地开发用任意静态服务器（`npx serve` 或 `python -m http.server`），因为 ES module 不能用 `file://` 打开。
- 字体：Google Fonts，中文手写体 `Ma Shan Zheng`，英文手写体 `Caveat`。所有 Canvas 贴图在 `document.fonts.load()` 完成后再绘制，避免回退到系统字体。

## 内容配置（`content.js`）

用户只需要改这个文件。结构：

```js
export default {
  recipient: "名字",
  cover: { title: "Happy Birthday", subtitle: "点一下，打开我们的回忆", },
  photos: [
    { src: "photos/01.jpg", caption: "2023 夏天 · 海边", text: "背面的文字……" },
  ],
  ending: { title: "生日快乐", text: "最终的祝福……" },
  music: "audio/song.mp3",   // 可为 null 表示无音乐
};
```

照片 5-10 张，全部一次性预加载。

## 页面流程

1. **加载页**（HTML 覆盖层）：预加载字体、全部照片贴图；显示进度条。完成后淡出。
2. **封面卡**：拍立得样式，正面写 `cover.title` + `recipient` 和 `cover.subtitle`。不可翻面。点击或右划 → 开始播放音乐 → 进入第一张照片。
3. **照片卡 × N**：
   - 正面：白色拍立得边框，照片按 cover 裁切填充，底部手写小标题 `caption`。
   - 背面：米色纸面，`text` 用手写体自动换行居中显示；文字过多时按比例缩小字号直到装下。
   - 点击/轻触（无明显位移）→ 绕 Y 轴翻转 180°，再点翻回。
4. **结尾卡**：正面直接显示 `ending.title` 和 `ending.text`，不可翻面。右划无动作（轻微弹回）。
5. **导航**：
   - 右划（手指/鼠标向右拖超过阈值 或 释放速度足够）→ 下一张；左划 → 上一张。
   - 桌面端：键盘 ← →，屏幕两侧半透明箭头按钮。
   - 拖动中当前卡跟手位移并轻微倾斜，松手后要么完成翻页要么弹回。
   - 翻页过程中忽略新的输入，直到动画结束。

## 3D 场景

- 正交感较弱的透视相机，视野按视口宽高比自适应，保证卡片在手机竖屏和桌面横屏都完整可见。
- 卡片：`BoxGeometry`（有 2-3mm 厚度感），6 个面材质：正面贴图、背面贴图、四侧白色。正反面贴图由 Canvas 绘制，分辨率按 `devicePixelRatio` 提高，最大 2048px。
- 材质用 `MeshStandardMaterial`，配一盏环境光 + 一盏主方向光 + 一盏侧补光，翻转时表面有高光变化。
- 堆叠：当前卡在 z=0 正对相机；后面最多 3 张依次向后偏移、缩小、带固定的随机小角度旋转（每张卡的旋转是稳定的，由索引决定）。已翻过的卡不再显示。
- 换卡动画：当前卡向右上方飞出并旋转、透明度降低，后面的卡同时向前补位；反向导航则从右侧飞回。
- 背景：CSS 深色渐变作为 canvas 背景（透明渲染），场景内 ~300 个暖色光点粒子（`Points` + 圆形 sprite 贴图，加法混合），缓慢上浮飘动；根据鼠标位置或手机陀螺仪做轻微视差。
- 动画：自写的简单 tween（缓动函数），不引入额外动画库。

## 模块划分

```
index.html         骨架、importmap、加载层、音乐开关按钮、箭头按钮
style.css          覆盖层样式、手写字体声明
content.js         用户内容配置
src/main.js        入口：加载资源 → 建场景 → 挂输入 → 主循环
src/textLayout.js  纯逻辑：中文/英文混排换行、自适应字号
src/navigation.js  纯逻辑：状态机 {index, flipped, animating}，next/prev/flip 的合法性判断
src/cards.js       绘制正反面 Canvas 贴图，创建卡片 Mesh
src/stack.js       卡堆布局：给定当前索引，计算每张卡的目标位置/旋转/缩放；换卡动画
src/gestures.js    指针事件 → 拖动中回调 / 释放时判定 swipe-left / swipe-right / tap
src/particles.js   背景粒子
src/tween.js       缓动与补间工具
```

## 错误处理

- 某张照片加载失败：在正面画一个带文字「照片走丢了」的占位，不阻塞整体。
- 音乐加载失败或被浏览器拦截：静默忽略，音乐按钮显示为静音状态。
- 字体加载超时（3 秒）：继续用回退字体绘制，不无限等待。
- WebGL 不可用：加载层显示一句提示。

## 测试

- `src/textLayout.js` 与 `src/navigation.js` 为纯函数模块，用 Node 内置 `node:test` 写单测（`npm test` → `node --test tests/`），零依赖。
- 3D 表现、手势、音乐在浏览器中手动验证：桌面 Chrome + 手机竖屏模拟（375×812）。

## 后续需用户提供

- 对方名字（填入 `content.js`）
- 照片文件放入 `photos/`，每张的标题与背面文字
- mp3 放入 `audio/`
