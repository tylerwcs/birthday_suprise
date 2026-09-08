# 3D 拍立得回忆录

一叠 3D 卡片：正面是手写的话，点一下翻过来才是照片，标题在卡片下方逐字浮现，左右滑动换页。带封面、结尾祝福、背景音乐和漂浮光点。

## 怎么改内容

只需要改 `content.js`：

- `recipient`：对方的名字
- `cover.image`：全屏封面图（放在 `photos/`），`cover.title` / `cover.subtitle` 叠在图上
- `intro`：封面之后、照片之前的前言页，`lines` 每一项是一行（`""` 空一行），`hint` 是最后出现的提示；删掉整个 `intro` 就跳过这页
- `photos`：每张 `{ src, caption, text }`
  - 照片放进 `photos/` 文件夹，建议长边 1000-1600px；卡片形状跟随照片比例
  - `caption` 是正面底部一行小字，`text` 是背面的话，用 `\n` 换行
- `cake`：吹蜡烛页。`candles` 蜡烛数量，`hint` / `holdHint` 是有无麦克风时的提示，`done` 是吹灭后停留显示的话（不会自动跳到下一页）
- `ending`：最后一页。卡片上只有 `title` 和 `hint`，点一下打开全屏信纸，`text` 一行行浮现，`close` 是收起按钮的字
- `music`：mp3 放进 `audio/`，这里填 `"audio/你的文件.mp3"`；不要音乐写 `null`

## 本地预览

```bash
npx --yes serve -l 5173 .
```

然后打开 http://localhost:5173 。不能直接双击 `index.html` 打开，ES module 需要通过 http 访问。

## 发布

把整个文件夹拖到 https://app.netlify.com/drop ，几秒后拿到链接，直接发给对方即可。
吹蜡烛要用麦克风，浏览器要求 HTTPS（Netlify 默认就是），第一次会弹出授权提示；拒绝或不支持时会自动退化为长按屏幕。
GitHub Pages / Vercel 也可以，都是纯静态文件。

## 测试

```bash
npm test
```

## 结构

```
content.js          你唯一需要改的文件
index.html          页面骨架
style.css           覆盖层样式
src/main.js         入口：加载 → 场景 → 输入 → 主循环
src/cards.js        Canvas 绘制卡片正反面 + 创建 Mesh
src/stack.js        卡堆布局
src/navigation.js   翻页/翻面状态机
src/gestures.js     手势判定
src/particles.js    背景光点
src/tween.js        补间
src/textLayout.js   中英混排换行
tests/              纯逻辑单测
```
