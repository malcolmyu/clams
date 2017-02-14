import cp from 'copy-dir';
import path from 'path';
import ep from 'es6-promisify';
import ora from 'ora';

export default async ({ folder = '' }) => {
  const from = path.join(__dirname, '../template');
  const to = path.join(process.cwd(), folder);

  const spinner = ora({ text: '初始化 clams demo 项目' });
  spinner.start();
  try {
    await ep(cp)(from, to);
    spinner.succeed();
  } catch (e) {
    spinner.text = `创建项目失败！错误信息为：${e.message}`;
    spinner.fail();
  }
}