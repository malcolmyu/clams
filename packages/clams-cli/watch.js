import chokidar from 'chokidar';
import del from 'del';
import 'colors';

import build from './build';
import buildFile from './build-file';
import { clerk } from './utils';

export default async function watch(options) {
  if (options.clear) {
    await del(options.dist);
  }

  await build(options);

  if (options.watch) {
    const watcher = chokidar.watch(options.src, { ignored: /^\./ });
    // 仅需要监听修改和删除，因为添加的时候也会触发 change
    const subscribedEvents = ['change', 'unlink'];

    watcher.on('all', (event, path) => {
      if (subscribedEvents.indexOf(event) > -1) {
        clerk.info(`监听到文件 ${path} ${event === 'unlink' ? '被删除' : '改动'}`.dim);
        buildFile(event, options, path);
      }
    });
  }
}
