import fs from 'fs';
import less from 'less';
import sass from 'node-sass';
import ep from 'es6-promisify';
import mkdirp from 'mkdirp';

import { clerk, traverseDirectory } from './utils';
import { R_IMPORT, R_M_COMMENT, R_S_COMMENT } from './constants';

const rSass = /\.s[ac]ss$/;

const mark = '/* I_HAVE_TO_RECORD_YOU_$INDEX */';
const getMark = index => mark.replace('$INDEX', index);
const rMark = new RegExp(mark.replace(/\*/g, '\\*').replace('$INDEX', '(\\d+)'), 'g');

// const CONTENT_LIST = null;

async function collectStyleContents(entryExtname, base) {
  const fileList = await traverseDirectory(base, entryExtname);

  const commentList = [];
  const contentMap = [];
  const len = fileList.length;

  let commentIndex = 0;
  let i = 0;
  let hasImportStatement = false;

  const restoreComment = (matched) => {
    commentList[commentIndex] = matched;
    return getMark(commentIndex++);
  };

  // 干掉 import，不对其做任何解析
  const removeImporter = () => {
    hasImportStatement = true;
    return '';
  };

  for (; i < len; i++) {
    const file = fileList[i];
    const content = await ep(fs.readFile)(file, 'utf8');
    // 处理一下注释
    contentMap[file] = content
    // 单行注释就直接干掉了，wxss 根本不滋瓷，sass 转 css 也不处理的
      .replace(R_S_COMMENT, '')
      // 多行注释记下来，回头可以还原一下
      .replace(R_M_COMMENT, restoreComment)
      .replace(R_IMPORT, removeImporter);
  }

  if (hasImportStatement) {
    clerk.warn('为减少小程序体积，所有的样式会统一编译到 app.wxss 中，因此没有必要书写 @import 语句');
  }
  return Object.keys(contentMap).map(k => contentMap[k]).join('\n').replace(rMark, (_, num) => commentList[num]);
}

async function buildCSS(event, options, from) {
  const entryExtname = from.ext;
  // TODO: 如果对于大量文件性能特别慢，可以用 event 来进行性能优化
  // 但微信小程序最大也就 1M，感觉不用进行啥优化……
  const data = await collectStyleContents(entryExtname, options.src);

  if (rSass.test(entryExtname)) {
    const result = await ep(sass.render)({ data });
    return result.css;
  }
  const result = await less(data, { filename: from.file });
  return result.css;
}

export default async function buildStyle(event, options, from, to) {
  clerk.transfer('构建 WXSS', from, to);
  const result = await buildCSS(event, options, from);
  await ep(mkdirp)(to.dir);
  await ep(fs.writeFile)(to.file, result);
}
