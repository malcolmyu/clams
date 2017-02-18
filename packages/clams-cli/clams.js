import program from 'commander';

import init from './init';
import watch from './watch';
import parseConfig from './parse-config';
import pkg from '../../package.json';

import { clerk } from './utils';

program
  .version(pkg.version);

program
  .command('init [folder]')
  .alias('i')
  .description('在当前路径初始化项目，或指定文件夹名称 folder')
  .action(folder => {
    parseConfig({ folder }).then(init).catch(e => clerk.error(e.stack))
  });

// program
//     .command('create [page-name]')
//     .alias('c')
//     .description('在当前路径初始化项目')
//     .action(options => {
//         console.log(options);
//     });

program
  .command('build')
  .alias('b')
  .description('编译当前项目')
  .option('--src [dir]', '源码目录，默认为 src 文件夹')
  .option('--dist [dir]', '目标目录，默认为 dist 文件夹')
  .option('-w, --watch', '编译当前项目，并自动监听文件改动')
  .option('--config', '选择对应的配置文件')
  .action(options => {
    parseConfig(options).then(watch).catch(e => clerk.error(e.stack));
  });

program.parse(process.argv);

if (!program.args.length) program.help();
