#!/usr/bin/env node
/**
 * 打包脚本，由于要区分框架包和工具包，因此在 build 和 watch 的时候都要进行不同情况的处理
 * 将 packages 打到 lib 中去
 */
require('colors');
const fs = require('fs');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const program = require('commander');
const chokidar = require('chokidar');

program
  .version('0.0.1')
  .option('-w --watch', '开启构建监听')
  .parse(process.argv);

spawnSync('rm', ['-r', 'lib']);
spawnSync('mkdir', ['-p', 'lib']);

console.log('构建 lib 目录……'.blue);

spawnSync('cp', ['-r', 'packages/clams', 'lib']);
spawnSync('cp', ['-r', 'packages/template', 'lib']);
spawnSync('babel', ['packages/clams-cli', '--out-dir', 'lib/clams-cli']);

if (program.watch) {
  console.log('开启编译监听……'.blue);
  chokidar.watch('packages').on('change', (filePath) => {
    const reCLI = /clams-cli/;
    const targetPath = filePath.replace(/^packages/, 'lib');

    if (reCLI.test(filePath)) {
      spawnSync('babel', [filePath, '--out-file', targetPath]);
    } else {
      spawnSync('cp', [filePath, targetPath]);
    }

    console.log(filePath, ' -> ', targetPath);
  })
}