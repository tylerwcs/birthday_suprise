import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, wrapText, fitText } from '../src/textLayout.js';

const mono = s => s.length * 10; // 每个字符 10 宽

test('tokenize: CJK 逐字，拉丁按词，保留空格与换行', () => {
  assert.deepEqual(tokenize('你好 hello\n世界'), ['你', '好', ' ', 'hello', '\n', '世', '界']);
});

test('wrapText: 中文按字换行', () => {
  assert.deepEqual(wrapText('你好世界', 25, mono), ['你好', '世界']);
});

test('wrapText: 英文按词换行并去掉行尾空格', () => {
  assert.deepEqual(wrapText('hello world foo', 110, mono), ['hello world', 'foo']);
});

test('wrapText: 显式换行符生效，连续换行产生空行', () => {
  assert.deepEqual(wrapText('a\n\nb', 100, mono), ['a', '', 'b']);
});

test('wrapText: 超长单词按字符拆开', () => {
  assert.deepEqual(wrapText('abcdefgh', 30, mono), ['abc', 'def', 'gh']);
});

test('wrapText: 标点不放行首，允许挂在上一行末尾', () => {
  assert.deepEqual(wrapText('你好，', 20, mono), ['你好，']);
});

test('fitText: 高度不够时缩小字号直到装下', () => {
  const measureAt = size => s => s.length * size;
  const r = fitText('一二三四五六七八', { maxWidth: 40, maxHeight: 60, fontSize: 20, minFontSize: 8, lineHeight: 1, measureAt });
  assert.ok(r.fontSize < 20);
  assert.ok(r.lines.length * r.fontSize <= 60);
});

test('fitText: 到最小字号仍装不下则停在最小字号', () => {
  const measureAt = size => s => s.length * size;
  const r = fitText('一二三四五六七八九十一二三四五六七八九十', { maxWidth: 10, maxHeight: 10, fontSize: 20, minFontSize: 10, lineHeight: 1, measureAt });
  assert.equal(r.fontSize, 10);
});
