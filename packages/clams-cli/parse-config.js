import fs from 'fs';
import path from 'path';
import ep from 'es6-promisify';

import { clerk } from './utils';

const defaultConfig = {
  src: 'src',
  dist: 'dist'
};

export default async (options) => {
  const filename = options.config || 'clams.config';
  const configFile = path.join(process.cwd(), filename);
  let content;
  try {
    content = await ep(fs.readFile)(configFile, 'utf8');
  } catch (e) {
    // 没有配置文件
    return { ...defaultConfig, ...options };
  }

  let configInfo;
  let finalInfo;

  try {
    configInfo = JSON.parse(content);
    finalInfo = { ...defaultConfig, ...configInfo, ...options };

    // 同时也读取一下 app.json，合成统一的 options
    const appJSONFile = path.join(process.cwd(), finalInfo.src, 'app.json');
    const appJSON = await ep(fs.readFile)(appJSONFile, 'utf8');

    finalInfo.appConfig = JSON.parse(appJSON);
  } catch (e) {
    clerk.error('解析配置文件不合法, 错误信息为: ' + e.message);
  }

  // 命令行优先级最高，其次配置项，最后是默认配置
  return finalInfo;
};

export function parseAlias(importPath, from, options) {
  // src/pages/hello/hello.js 使用相对路径引用 components/switch/switch
  // 要先判断相对路径有没有对应的文件，例如 src/pages/hello/components/switch/switch
  if (from.ext === '.js') {
    const file = path.join(from.dir, importPath);
    const matched = [];
    // 视情况补全 file
    switch (true) {
    case /\/$/.test(file):
      matched.push(`${file}index.js`);
      break;
    case /\.js$/.test(file):
      matched.push(file);
      break;
    default:
      matched.push(`${file}/index.js`);
      matched.push(`${file}.js`);
      break;
    }

    let i = 0;
    let accessFile = true;
    const len = matched.length;

    for (; i < len; i++) {
      try {
        fs.readFileSync(file);
        break;
      } catch (e) {
        accessFile = false;
      }
    }

    if (accessFile) return importPath;
    // 没有找到对应的 js，应该从 alias 里面找
    const { alias } = options;
    // 注入默认 alias
    alias.clams = path.join(options.src, 'clams/index.js');

    const keys = Object.keys(alias);
    // TODO: 可能需要进行特殊字符替换，比如 '.'
    const rkeys = keys.map(k => new RegExp(`^${k}(.*)$`));
    let matchedIndex = -1;
    let matchedContent = null;

    rkeys.some((rk, i) => {
      const m = importPath.match(rk);
      if (m) {
        matchedIndex = i;
        matchedContent = m[1] || '';
        return true;
      }
    });

    // 匹配成功，进行替换
    if (matchedIndex > -1) {
      return path.relative(from.dir, alias[keys[matchedIndex]] + matchedContent);
    }
  }

  // 没匹配到的都原样返回
  return importPath;
}
