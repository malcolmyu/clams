import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import ep from 'es6-promisify';

import { clerk, getDistPath, parsePath } from './utils';
import {
  preParseJSContent,
  postParseJSContent,
  parseAppEntryJS,
  parseInceptionJS
} from './build-mix';
import { INCEPTION_INIT } from './constants';

// TODO: 处理开发场景
const DEV = process.env.NODE_ENV === 'development';

export default async function buildJS(options, from, to, opt) {
  // TODO: 这个 from to 有必要拿出来解析了
  if (typeof from === 'string') {
    from = parsePath(opt ? options.dist : options.src, from);
  }
  if (typeof to === 'string') {
    to = getDistPath(options, from);
  }

  clerk.transfer('构建 JS  ', from, to);
  const content = await ep(fs.readFile)(from.file, 'utf8');

  let result;

  switch (from.relative) {
  case 'app.js':
    result = parseAppEntryJS(content, options, from).code;
    const incPath = path.join(to.dir, '_inception.js');
    try {
      await ep(fs.stat)(incPath);
    } catch (e) {
      await ep(mkdirp)(to.dir);
      await ep(fs.writeFile)(incPath, INCEPTION_INIT, 'utf8');
    }
    break;
  case '_inception.js':
    result = parseInceptionJS(content, opt).code;
    break;
  default:
    const code = preParseJSContent(content, options, from).code;
    result = await postParseJSContent(code);
    break;
  }
  await ep(mkdirp)(to.dir);
  await ep(fs.writeFile)(to.file, result, 'utf8');
}
