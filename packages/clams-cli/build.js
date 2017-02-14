import 'colors';
import path from 'path';

import buildFile from './build-file';
import { clerk, traverseDirectory, copyRunTimeFile } from './utils';

export default async function build(options) {
  const fileList = await traverseDirectory(options.src);
  const { length } = fileList;

  clerk.info('开始进行项目构建……'.dim);
  await copyRunTimeFile(path.join(__dirname, '../clams'), path.join(options.dist, 'clams'));

  for (let i = 0; i < length; i++) {
    await buildFile('build', options, fileList[i])
  }
}
