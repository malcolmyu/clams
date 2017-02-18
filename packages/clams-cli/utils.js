import fs from 'fs';
import path from 'path';
import 'colors';
import mkdirp from 'mkdirp';
import ep from 'es6-promisify';

const EXT_MAP = {
  js: 'js',
  sass: 'wxss',
  scss: 'wxss',
  less: 'wxss',
  wxml: 'wxml',
  xml: 'wxml',
  json: 'json'
};

export const getDistExtname = (fromExt) => {
  const ext = fromExt.replace(/^\./, '');
  const toExt = EXT_MAP[ext];
  if (toExt == null) {
    return fromExt;
  }
  return `.${toExt}`;
};

export const parsePath = (base, sourcePath) => {
  const pathFormat = path.parse(sourcePath);
  const dirname = path.join(pathFormat.dir, pathFormat.name);
  const relname = path.relative(base, dirname);

  return {
    // path.parse('/home/user/dir/file.txt')
    // Returns:
    // {
    //    root : "/",
    //    dir : "/home/user/dir",
    //    base : "file.txt",
    //    ext : ".txt",
    //    name : "file"
    // }
    ...pathFormat,
    dirname,
    relname,
    cwd: process.cwd(),
    file: path.normalize(sourcePath),
    relative: path.relative(base, sourcePath)
  };
};

export const getDistPath = (options, from) => {
  const toPath = path.join(options.dist, from.relname + getDistExtname(from.ext));
  return parsePath(options.dist, toPath);
};

export const clerk = {
    /* eslint-disable no-console */
  log: console.log,
    /* eslint-enable no-console */
  info: (...args) => clerk.log('[info]'.cyan.dim, '  ', ...args),
  warn: (...args) => clerk.log('[warn]'.yellow.dim, '  ', args.join('').yellow),
  error: (...args) => clerk.log('[error]'.red.dim, ' ', args.join('').red),

  transfer(info, from, to) {
    this.info(info.cyan, from.file.cyan, '->', to.file.blue);
  }
};

async function getContent(file, getFileContent) {
  if (getFileContent) {
    return await ep(fs.readFile)(file, 'utf8');
  }
  return file;
}

/**
 * 递归遍历文件夹以获取文件
 *
 * @export
 * @param {String} root 文件夹路径
 * @param {String} [extname] 后缀名，设置的话将会获取对应后缀名的
 * @param {Boolean} [getFileContent] 是否直接获取文件的内容
 * @returns {Array} 文件名称/内容列表
 */
export async function traverseDirectory(root, extname, getFileContent) {
  let result = [];
  const fileList = await ep(fs.readdir)(root);
  const len = fileList.length;
  let i = 0;

  for (; i < len; i++) {
    const file = path.join(root, fileList[i]);

    // 默认不处理 '.' 开头的文件或文件夹
    if (!/^\./.test(fileList[i])) {
      const stat = await ep(fs.stat)(file);

      if (stat.isDirectory()) {
        const subResult = await traverseDirectory(file, extname, getFileContent);
        result = result.concat(subResult);
      } else {
        const { ext } = path.parse(file);
        if (!extname || ext === extname) {
          result.push(await getContent(file, getFileContent));
        }
      }
    }
  }

  return result;
}

export function isFromEntry(from, options, type) {
  if (options && options.appConfig && options.appConfig.pages) {
    const { pages } = options.appConfig;
    const pagesWithSrc = pages.map(page => path.join(options.src, page + type));

    if (pagesWithSrc.indexOf(from.file) > -1) {
      return true;
    }
  }
  return false;
}

export async function copyRunTimeFile(from, to) {
  const list = await traverseDirectory(from);
  await ep(mkdirp)(to);
  list.forEach((name) => {
    fs.createReadStream(name).pipe(fs.createWriteStream(path.join(to, path.basename(name))));
  });
}
