import fs from 'fs';
import path from 'path';
import ep from 'es6-promisify';

import buildXML from './build-xml';
import buildJS from './build-js';
import buildStyle from './build-style';
import buildJSON from './build-json';
import { clerk, getDistPath, parsePath } from './utils';

let styleHasBuild = false;

async function buildFileByExtension(event, options, fromPath) {
  try {
    const from = parsePath(options.src, fromPath);
    const to = getDistPath(options, from);

    // 处理删除
    if (event === 'unlink') {
      await fs.unlink(to.file);
      return;
    }

    switch (from.ext) {
    case '.js':
      await buildJS(options, from, to);
      break;
    case '.less':
    case '.scss':
    case '.sass': {
      if (event === 'build' && styleHasBuild) break;
      styleHasBuild = true;

      const appFromPath = parsePath(options.src, path.join(options.src, `app${from.ext}`));
      // 寻找 app 入口，以便确定整体样式的解析类型
      try {
        await ep(fs.access)(appFromPath.file);
      } catch (e) {
        clerk.error(`无法找到 ${appFromPath.file}，请确保有该入口文件`);
        break;
      }

      const appToPath = parsePath(options.dist, path.join(options.dist, 'app.wxss'));
      await buildStyle(event, options, appFromPath, appToPath);
      break;
    }
    case '.wxml':
      await buildXML(options, from, to);
      break;
    case '.json':
      await buildJSON(options, from, to);
      break;
    default:
      break;
    }
  } catch (e) {
    clerk.error(e.stack);
  }
}

export default buildFileByExtension;
