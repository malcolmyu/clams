import fs from 'fs';
import mkdirp from 'mkdirp';
import ep from 'es6-promisify';

import { clerk } from './utils';

export default async function buildJSON(options, from, to) {
  clerk.transfer('构建 JSON', from, to);
  const result = await ep(fs.readFile)(from.file);
  await ep(mkdirp)(to.dir);
  await ep(fs.writeFile)(to.file, result);
}
