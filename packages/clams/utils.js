const TYPE_LIST = 'Boolean,Number,String,Function,Array,Date,RegExp,Arguments,Null,Undefined'.split(',');
export const types = {};

TYPE_LIST.forEach(v => {
  types[`is${v}`] = value => Object.prototype.toString.call(value).slice(8, -1) === v;
});

// 处理一下 path 查找
const reArr = /^([a-zA-Z_$][\w$]*)(?:\[(\d+)])*$/;
const reVar = /^[a-zA-Z_$][\w$]*$/;
const reSub = /\[(\d+)]/g;

// 处理连续数组
function parseConArray(data, m) {
  let result = data;
  let matched;

  while ((matched = reSub.exec(m)) !== null) {
    if (matched && matched[1]) {
      const num = matched[1];
      result = result[+num];
    }
  }

  return result;
}

export function getPath(data, path, sub = null) {
  let d = data;
  let i = 0;

  // 没有路径证明就是首页事件，直接返回了就行
  if (path === '') return d;

  const keys = path.split('.');
  const { length } = keys;

  for (; i < length; i++) {
    const k = keys[i];
    let matched;

    if (matched = k.match(reArr)) {
      const [m, key] = matched;
      d = sub ? parseConArray(d[sub + ''][key], m) : parseConArray(d[key], m);
    } else if (reVar.test(k)) {
      d = sub ? d[sub + ''][k] : d[k];
    } else {
      console.error(`无法解析对应路径 ${path}`);
      return;
    }
  }

  return d;
}

export function buildListItem(list, item) {
  let newItem = item;
  if (list && list.length && item.__k != null) {
    Object.keys(list).some(key => {
      if (list[key].__k != null && list[key].__k === item.__k) {
        newItem = Object.assign({}, list[key], item);
      }
    })
  }
  return newItem;
}

// 处理 deepEqual

export function deepEqual(actual, expected) {
  if (actual === expected) {
    return true;
  } else if (actual instanceof Date && expected instanceof Date) {
    return actual.getTime() === expected.getTime();
  } else if (!actual || !expected || typeof actual != 'object' && typeof expected != 'object') {
    return actual === expected;
  } else {
    return objEquiv(actual, expected);
  }
}

function isUndefinedOrNull(value) {
  return value === null || value === undefined;
}

function objEquiv(a, b, opts) {
  let i, key;
  if (isUndefinedOrNull(a) || isUndefinedOrNull(b))
    return false;
  if (a.prototype !== b.prototype) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length != kb.length)
    return false;
  ka.sort();
  kb.sort();

  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!deepEqual(a[key], b[key], opts)) {
      return false;
    }
  }
  return typeof a === typeof b;
}

export function lifecycleMap(comp, ctx, name) {
  const lifecycle = ['onReady', 'onShow', 'onHide', 'onUnload', 'onPullDownRefresh', 'onReachBottom', 'onShareAppMessage'];
  const markedLifecycle = ['onReady', 'onShow', 'onHide', 'onUnload'];

  function setCtxName(name) {
    ctx[name] = function(...args) {
      if (markedLifecycle.indexOf(name) > -1) {
        ctx[`_${name}`] = true;
      }
      comp[name].apply(ctx, args);
    };
  }

  if (name) {
    setCtxName(name);
    return;
  }

  lifecycle.forEach(name => {
    if (exports.isFunction(comp[name])) {
      setCtxName(name);
    }
  });
}

export function callLifecycle(comp, name, ...args) {
  if (typeof comp[name] === 'function') {
    comp[name].apply(comp, args);
  }
  if (comp._pluginsEmitter) {
    comp._pluginsEmitter.$emit(name, ...args);
  }
}
