import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import ep from 'es6-promisify';
import { DOMParser } from 'xmldom';

import { preParseJSContent, babelTransform } from './build-mix';
import { clerk, isFromEntry } from './utils';
import buildJS from './build-js';

const babel = require('babel-core');
const template = require('babel-template');

const reEvent = /^(bind|catch)\w+/;
const reCustomComponent = /^[A-Z]\w+/;
const reVar = /^[A-Za-z$_][\w$]+$/;
const reAllIte = /^\{\{([^}]+)}}$/;
const reIte = /\{\{([^}]+)}}/g;

const nameSpaces = ['state', 'props'];

const VISITED = '__visited';

const filterKeys = (obj) => {
  if (obj == null) return [];
  return Object.keys(obj).filter(k => /^\d+$/.test(k)).map(k => obj[k]);
};

// 实在是不想传参数了。。
let bindList = {};

/**
 * 干他喵的 xml 解析！
 * 主要两个点，解析实例组件和解析组件内部元素
 *
 * 1. 解析实例组件
 *
 * 将用户手撸的 <counter title="{{state.title}}" click="onClick" />
 * 解析成两部分
 * xml 部分：<template is="counter" data="{{path: 'myCounter', ...myCounter}}"/>
 * js 部分：
 *
 * ```js
 * children() {
 *   myCounter: {
 *     component: Counter,
 *     props: {
 *       title: this.state.title,
 *       onClick: this.onClick.bind(this)
 *     }
 *   }
 * }
 * ```
 *
 * 这里需要根据用户手撸的情况生成 key，就像上文所写的 myCounter
 *
 * 2. 解析组件内部构造
 *
 * 将组件里面的绑定解析正确（都使用 _d）
 * 将用户手撸的：<text bindtap="tapTag">点我改变</text>
 * 解析为：<text bindtap="_d" data-bindtap="tapTag" data-path="{{$p}}">点我改变</text>
 *
 */
async function parsePageWXMLContent(isEntry, compName, content, from, options, filename) {
  let _id = 0;
  const uid = () => _id++;
  const loopStack = [];
  const jsContent = [];

  if (!isEntry) content = `<template name="${compName}">${content}</template>`;
  try {
    const document = new DOMParser().parseFromString(content);
    parseBind({
      document,
      node: document,
      isEntry,
      loopStack,
      uid,
      jsContent
    });

    // 这里将所有解析 xml 生成的 js 代码推到一个依赖文件中（比如叫 inception.js）
    // 然后在 app.js 里注入这个依赖= =？d
    const inception = getInception(jsContent, compName);
    const filePath = path.relative(options.src, filename);

    await buildJS(
      options,
      path.join(options.dist, '_inception.js'),
      path.join(options.dist, '_inception.js'),
      { inception, compName, filePath, isEntry }
    );

    return document.toString();
  } catch (e) {
    console.log('error: ', from.file, e.stack);
  }
  return content;
}

function getInception(jsContent, compName) {
  if (!jsContent.length) return false;
  const bindFunList = [];
  Object.keys(bindList).forEach(key => {
    bindFunList.push(bindList[key]);
  });

  return `
\n_y.inceptionRegister('${compName}', function() {
    var _t = this;
    ${bindFunList.join(';\n')}
    return {
        ${jsContent.join(',\n')}
    }
});
`
}

/**
 * 遍历 dom，解析所有绑定
 * @param bindData
 */
function parseBind(bindData) {
  const {
    document,
    node,
    isEntry,
    loopStack,
    uid,
    jsContent
  } = bindData;

  let pushedLoopStack = false;
  const { attributes, childNodes, tagName } = node;
  const attrList = filterKeys(attributes);

  // 解析属性
  if (attributes) {
    let wxKey = null;

    attrList.forEach(attr => {
      // 处理事件绑定
      if (reEvent.test(attr.name)) {
        node.setAttribute(`data-${attr.name}`, attr.value);
        attr.value = '_d';
        // 对于非入口文件需要设置
        if (!isEntry) node.setAttribute('data-path', '{{$p + (__p || \'\')}}');
      }

      // 进入循环
      if (attr.name === 'wx:for') {
        pushedLoopStack = true;
        const loopData = attr.value;
        const itemKey = node.getAttribute('wx:for-item') || 'item';
        const indexKey = node.getAttribute('wx:for-index') || 'index';

        loopStack.push({ loopData, itemKey, indexKey });
      }

      // 记录 wx:key，最后再推到 loopStack 里，防止它写在 wx:for 前面
      if (attr.name === 'wx:key') {
        wxKey = attr.value;
      }
    });

    // 记录 wx:key
    const len = loopStack.length;
    if (len && wxKey !== null) {
      loopStack[len - 1].key = wxKey;
    }
  }

  // 解析自定义组件，解析属性比解析自定义组件靠前，这样
  // <Switch wx:for="{{data}}" /> 这样的就可以自动套在循环里
  if (tagName && reCustomComponent.test(tagName)) {
    // list/single component
    const prefix = loopStack.length ? 'l' : 's';

    const key = `$${prefix}_${tagName}_${uid()}`;
    const tempNode = document.createElement('template');
    const usedKeys = [];

    tempNode.setAttribute('is', tagName);

    if (loopStack.length) {
      let keyWithIndex = key;
      let dataWithIndex = key;

      loopStack.forEach(loop => {
        if (usedKeys.indexOf(loop.indexKey) > -1) {
          throw new Error(`在循环嵌套中存在相同的 index: ${loop.indexKey}, 生成组件时将产生错误`);
        }
        usedKeys.push(loop.indexKey );

        keyWithIndex += `['+${loop.indexKey}+']`;
        dataWithIndex += `[${loop.indexKey}]`;
      });

      if (!isEntry) {
        keyWithIndex = `$p + (__p || '') + '.${key}'`;
      } else {
        keyWithIndex = `'${key}'`;
      }

      tempNode.setAttribute('data', `{{$p:${keyWithIndex},...${dataWithIndex}}}`);
    } else {
      let keyIte = key;
      const dataIte = key;

      if (!isEntry) {
        keyIte = `$p + '.${keyIte}'`;
      } else {
        keyIte = `'${keyIte}'`;
      }

      tempNode.setAttribute('data', `{{$p:${keyIte},...${dataIte}}}`);
    }

    // 解析插值语法，如 <Counter title="{{state.hello}} + 'hello'" @click="click" />
    jsContent.push(attrToChildren(key, tagName, attrList, loopStack));

    node.parentNode.replaceChild(tempNode, node);

    if (childNodes && childNodes.length) {
      clerk.warn(`自定义组件不支持传入子元素，${tagName} 的子元素将被忽略`);
      return;
    }
  }

  // 递归遍历子组件
  if (childNodes) {
    filterKeys(childNodes).forEach(childNode => {
      parseBind({
        document,
        node: childNode,
        isEntry,
        loopStack,
        uid,
        jsContent
      });
    });
  }

  // 退出循环栈
  if (pushedLoopStack) loopStack.pop();
}

function handleReserveWord(loopKey, item) {
  // 小程序的文档里说明了，loopKey 只允许是字符串或 *this，其他情况应该都忽略掉
  if (loopKey.indexOf('{') > -1) return null;

  return loopKey === '*this' ? item.itemKey : `${item.itemKey}.${loopKey}`;
}

function attrToChildren(key, tagName, attrList, loopStack) {
  const len = loopStack.length;
  if (len) {
    /**
     * 目标，将循环配置的组件转换为 map 语法生成组件
     * 例如：
     * <block wx:for="{{state.list}}" wx:for-item="listItem">
     *   <block wx:for="{{listItem.tags}}">
     *     <Tag title="{{item}}" click="onClick">
     *   </block>
     * </block>
     *
     * 需要生成为：
     * $l_Counter_id: this.state.list.map(function(listItem, index){
         *   return listItem.map(function(item, index){
         *     return {component:'Counter',key:index,props:{title:item.title,click:_t.click.bind(_t)}}
         *   });
         * });
     */
    const lastItem = loopStack[len - 1];
    const handleKey = handleReserveWord(lastItem.key, lastItem);

    const loopKey = handleKey ? `key: ${handleKey},` : '';

    // 先推入最后 map 返回的值
    let propsExpression = `
return {
    component: '${tagName}',
    __data: ${lastItem.itemKey},
    ${loopKey}
    props: {
        ${attrToProps(attrList, loopStack)}
    }
}`;

    for (let i = len - 1; i >= 0; i--) {
      const loopItem = loopStack[i];
      const { loopData, itemKey, indexKey } = loopItem;
      const ld = parseItExpression(loopData, loopStack);
      propsExpression = `${ld}.map(function(${itemKey},${indexKey}) {
${propsExpression}
})`;

      const handleKey = handleReserveWord(loopItem.key, loopItem);
      if (i > 0) {
        propsExpression = `return ${propsExpression}`
      } else {
        propsExpression = `${key}:${propsExpression}`
      }
    }

    return propsExpression;
  } else {
    return `
    ${key}: {
        component: '${tagName}',
        props: {${attrToProps(attrList, loopStack)}}
    }`;
  }
}

function attrToProps(attrList, loopStack) {
  const props = [];

  attrList.forEach(attr => {
    // 带 {{}} 的认为是插值
    if (attr.value.indexOf('{') > -1) {
      props.push(`${attr.name}:${parseItExpression(attr.value, loopStack)}`);
      return;
    }

    // 想绑定字符串，请直接写插值，例如 title="{{'hello world'}}"

    // 否则全认为是函数绑定
    props.push(`${attr.name}: ${parseItFunction(attr.value)}`);
  });

  return props.join(',');
}

function parseItFunction(value) {
  if (reVar.test(value)) {
    if (!bindList[value]) bindList[value] = `_t.__${value}_bind = _t.__${value}_bind || _t.${value}.bind(_t)`;
    return `_t.__${value}_bind`;
  }
  clerk.warn(`无法解析函数插值 ${value}`);
  if (!bindList.__noop) bindList.__noop = `_t.__noop = function() {}`;
  // TODO: 使用 noop 替代
  return '_t.__noop';
}

function parseItExpression(content, loopStack) {
  let matched;
  // 全量插值的需要返回对应的属性
  if (matched = content.match(reAllIte)) {
    return parseIte(matched[1], loopStack);
  }

  // 否则全部解析为字符串
  let lastIndex = 0;

  const result = [];

  while((matched = reIte.exec(content)) != null) {
    const [match, ite] = matched;
    const parsed = parseIte(ite, loopStack);
    // 截取前面的字符串，比如 "{{data1}}abc{{data2}}"，就需要截取 abc 存起来
    const prevStr = content.substr(lastIndex, reIte.lastIndex - match.length);

    result.push(`"${prevStr}"`);
    result.push(parsed);
    lastIndex = reIte.lastIndex;
  }

  if (lastIndex < content.length - 1) {
    result.push(`"${content.substr(lastIndex + 1)}"`)
  }

  return result.join('+');
}

function parseIte(ite, loopStack) {
  let result;
  try {
    try {
      result = babelTransform(ite, [presetParseScope(loopStack)]);
    } catch (e) {
      result = babelTransform(ite, [presetParseScope(loopStack)]);
    }
  } catch (e) {
    throw new Error(`无法解析插值表达式：{{${ite}}}，错误原因为 ${e.message}`);
  }
  return result.code.replace(/;$/, '');
}

const buildThisExtension = template('this.$id');

const presetParseScope = loopStack => babel => {
  const t = babel.types;
  const visitor = {};
  const scopeNameList = [];

  if (loopStack) {
    loopStack.forEach(item => {
      scopeNameList.push(item.indexKey);
      scopeNameList.push(item.itemKey);
    });
  }

  visitor.Identifier = (path) => {
    const { node, parent } = path;
    if (!path[VISITED]) {
      path[VISITED] = true;

      // 判断是对象表达式的第一个标识符或不是对象表达式，本身就是标识符
      if (parent.type !== 'MemberExpression' || parent.object === node) {
        // 对于已存在的 scope 不予处理
        if (scopeNameList.indexOf(node.name) > -1) {
          return;
        }
        if (nameSpaces.indexOf(node.name) === -1) {
          throw new SyntaxError(`发现无效变量引用 ${node.name}，XML 模板只能引用组件 'props' 和 'state' 中的数据`);
        }
        // 处理变量引用，都加上 this
        path.replaceWith(buildThisExtension({ $id: t.identifier(node.name) }));
      }
    }
  };

  return { visitor }
};

async function parseScript(content, from, options, isEntry) {
  const { dir, name } = from;
  const filename = `${dir}/${name}.js`;
  let jsContent;

  try {
    jsContent = await ep(fs.readFile)(filename);
  } catch (e) {
    return content;
  }
  const { status } = preParseJSContent(jsContent, options, from);
  const compName = status.extendFromComponent;

  if (compName) {
    // 证明在 js 文件中使用了 extends Component
    // 证明对应的 xml 是组件的一部分，因此需要对组件进行魔改
    return await parsePageWXMLContent(isEntry, compName, content, from, options, filename);
  }

  // 如果根本没有继承自组件，那么就直接不解析了，原样返回
  return content;
}

export default async function buildXML(options, from, to) {
  clerk.transfer('构建 WXML', from, to);
  const content = await ep(fs.readFile)(from.file, 'utf8');
  const isEntry = isFromEntry(from, options, '.wxml');

  bindList = {};
  const result = await parseScript(content, from, options, isEntry);

  await ep(mkdirp)(to.dir);
  await ep(fs.writeFile)(to.file, result);
}