// 中英混排换行与自适应字号（纯逻辑，不依赖 DOM）

const CJK = /[⺀-⿟　-〿぀-ヿ㄀-ㄯ㐀-䶿一-鿿豈-﫿＀-￯]/;
// 这些标点不应该出现在行首，放不下时挂在上一行末尾
const NO_LINE_START = /^[，。！？、；：）」』】》〉”’…—,.!?;:)\]}]$/;

/** 把文本切成记号：CJK 逐字、拉丁按词，空格和换行原样保留。 */
export function tokenize(text) {
  const tokens = [];
  let word = '';
  const flush = () => { if (word) { tokens.push(word); word = ''; } };
  for (const ch of text) {
    if (ch === '\n' || ch === ' ') { flush(); tokens.push(ch); }
    else if (CJK.test(ch)) { flush(); tokens.push(ch); }
    else word += ch;
  }
  flush();
  return tokens;
}

/** 贪心换行。measure(str) 返回该字符串的像素宽度。 */
export function wrapText(text, maxWidth, measure) {
  const lines = [];
  let line = '';
  const push = () => { lines.push(line.replace(/\s+$/, '')); line = ''; };

  for (const tok of tokenize(text)) {
    if (tok === '\n') { push(); continue; }
    if (tok === ' ' && line === '') continue;
    const candidate = line + tok;
    if (measure(candidate) <= maxWidth) { line = candidate; continue; }
    if (tok === ' ') { push(); continue; }
    if (NO_LINE_START.test(tok) && line !== '') { line = candidate; continue; }
    if (line !== '') push();
    if (measure(tok) <= maxWidth) { line = tok; continue; }
    // 单个记号比整行还宽：按字符硬拆
    for (const ch of tok) {
      if (line && measure(line + ch) > maxWidth) push();
      line += ch;
    }
  }
  if (line !== '') push();
  return lines;
}

/** 从 fontSize 开始逐步缩小，直到全部行装进 maxHeight，或到达 minFontSize。 */
export function fitText(text, { maxWidth, maxHeight, fontSize, minFontSize, lineHeight = 1.5, measureAt }) {
  let size = fontSize;
  for (;;) {
    const lines = wrapText(text, maxWidth, measureAt(size));
    const height = lines.length * size * lineHeight;
    if (height <= maxHeight || size <= minFontSize) return { fontSize: size, lines };
    size = Math.max(minFontSize, Math.floor(size * 0.92));
  }
}
