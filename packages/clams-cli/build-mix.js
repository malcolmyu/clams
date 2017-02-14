import systemPath from 'path';
import { SLOGAN } from './constants';

const babel = require('babel-core');
const template = require('babel-template');

import { parseAlias } from './parse-config';
import { isFromEntry } from './utils';
import * as C from './constants';

const DEV = process.env.NODE_ENV === 'development';
const p = preset => systemPath.join(__dirname, '../../node_modules', `babel-preset-${preset}`);

// TODO: 使用缓存存储转换的 str
export function babelTransform(content, plugins) {
  return babel.transform(content, {
    presets: [ p('stage-0') ],
    plugins
  });
}

export function preParseJSContent(content, options, from) {
  const transformStatus = {
    extendFromComponent: false
  };

  const result = babelTransform(content, [
    clamsPreset(transformStatus, from, options)
  ]);

  // await ep(fs.writeFile)(to.file + '.json', result.ast, 'utf8');

  return {
    code: result.code,
    status: transformStatus
  };
}

export async function postParseJSContent(content) {
  return content;
}

const VISITED = '__visited';
const buildGlobalComponent = template(`
const __$$cp = Clams.createPage;
const __$$rc = Clams.register;
`);
const buildRegisterComponent = template(`__$$rc($name, $Comp, $path)`);
const buildCreatePage = template(`Page(__$$cp($name))`);

const presetParseAlias = ({ t, from, options, useClams }) => path => {
  const { node, parent } = path;
  if (!path[VISITED]) {
    path[VISITED] = true;
    const isImportSource = parent.type === 'ImportDeclaration';
    const isRequireArgs = parent.type === 'CallExpression' &&
      parent.callee.name === 'require';

    if (isImportSource || isRequireArgs) {
      const parsedPath = parseAlias(node.value, from, options);
      path.replaceWith(t.stringLiteral(parsedPath));

      if (node.value === 'clams') {
        useClams.use = true;
      }
    }
  }
};

const presetParseExtends = (t, transformStatus, from, options) => path => {
  const { node } = path;
  if (!path[VISITED]) {
    path[VISITED] = true;

    if (node.superClass && node.superClass.name === 'Component') {
      const isEntry = isFromEntry(from, options, '.js');

      transformStatus.extendFromComponent = node.id.name;

      path.insertBefore(buildGlobalComponent());
      let wxPageName = systemPath.join(from.dir, from.name);
      wxPageName = systemPath.relative(options.src, wxPageName);
      wxPageName = systemPath.join(systemPath.sep, wxPageName);

      const ast = buildRegisterComponent({
        $name: t.stringLiteral(node.id.name),
        $Comp: node.id,
        $path: t.stringLiteral(wxPageName)
      });
      if (isEntry) {
        path.insertAfter(buildCreatePage({
          $name: t.identifier(node.id.name)
        }));
      }
      path.insertAfter(ast);
    }
  }
};

const clamsPreset = (transformStatus, from, options) => (babel) => {
  const t = babel.types;
  const visitor = {};
  const useClams = {};

  // 传入了这两个参数证明需要解析 alias
  if (from && options) {
    // 魔改 import/require 语句，注入 alias
    visitor.StringLiteral = presetParseAlias({ t, from, options, useClams });
  }
  // 魔改 class Hello extends Component 语句，前后注入依赖代码
  visitor.ClassDeclaration = presetParseExtends(t, transformStatus, from, options);

  return { visitor };
};

const argName = C.ARG_NAME;
const buildApp = template(`
import Clams from './clams/index';
import { insertChildren, insertRequire } from './_inception.js';

const ${argName} = $arg;

const ${argName} = $arg;
const onLaunch = ${argName}.onLaunch;
${argName}.onLaunch = function() {
    if (typeof onLaunch === 'function') {
        onLaunch();
    }
    insertRequire();
};

${argName}.Clams = Clams;
insertChildren(${argName}.Clams);

App(${argName});
`);

const appPreset = (options, from) => (babel) => {
  const t = babel.types;
  const visitor = {};

  // 传入了这两个参数证明需要解析 alias
  if (from && options) {
    // 魔改 import/require 语句，注入 alias
    visitor.StringLiteral = presetParseAlias({ t, from, options });
  }

  visitor.CallExpression = (path) => {
    const { node } = path;
    if (!path[VISITED]) {
      path[VISITED] = true;
      if (node.callee.name === 'App') {
        // 判断 App(xxx) 里面的 xxx 是对象还是变量名
        const [arg] = node.arguments;

        if (arg.type === 'ObjectExpression') {
          // 发现是个对象，就直接用变量取出来
          // 比如 App({ a, b, c})，就给搞成
          // var __$$yaa={a,b,c};App(__$$yaa);
          path.replaceWithMultiple(buildApp({ $arg: arg }));
        } else if (arg.type === 'Identifier') {
          // 发现是个变量，也替换一遍
          // 比如 App(arg)，就给搞成
          // var __$$yaa=arg;App(__$$yaa);
          if (arg.name !== argName) {
            path.replaceWithMultiple(buildApp({ $arg: t.identifier(arg.name) }));
          }
        }
      }
    }
  };

  return { visitor };
};

const requireBuilder = template(`require($filename);`);

const incPreset = ({ inception, compName, filePath, isEntry }) => (babel) => {
  const t = babel.types;
  const visitor = {};

  let inserted = false;
  let required = false;
  let fun;

  if (inception) {
    const funAst = babelTransform(inception);
    fun = funAst.ast.program.body[0];

    visitor.ExpressionStatement = (path) => {
      const { node } = path;
      if (!path[VISITED]) {
        path[VISITED] = true;
        const exp = node.expression;

        if (exp && exp.left && exp.left.type === 'MemberExpression') {
          const prop = exp.left.property;
          if (prop.type === 'StringLiteral' && prop.value === compName) {
            path.replaceWith(fun);
            inserted = true;
          }
        }
      }
    };
  }

  visitor.StringLiteral = (path) => {
    const { node, parent } = path;
    if (!path[VISITED]) {
      path[VISITED] = true;
      const isRequireArgs = parent.type === 'CallExpression' &&
        parent.callee.name === 'require';
      if (isRequireArgs && node.value === filePath) {
        required = true;
      }
    }
  };

  visitor.ReturnStatement = (path) => {
    // 我们在最后有一个 EOF 标记
    const { node } = path;
    if (!path[VISITED]) {
      path[VISITED] = true;

      // console.log(filePath, inserted, isEntry, node.argument.value);

      if (node.argument.value === 'IN_EOF' && !inserted && inception) {
        // 插入 inception
        path.insertBefore(fun);
      }

      // 插入 require
      if (node.argument.value === 'RE_EOF' && !isEntry && !required) {
        path.insertBefore(requireBuilder({
          $filename: t.stringLiteral(filePath)
        }));
      }
    }
  };

  return { visitor };
};

// 构建 app.js，这里需要干的事情多得很那！
export function parseAppEntryJS(content, options, from) {
  // 劫持函数调用，找到 App() 进行注册
  return babelTransform(content, [ appPreset(options, from) ]);
}

export function parseInceptionJS(content, opt) {
  return babelTransform(content, [ incPreset(opt) ]);
}
