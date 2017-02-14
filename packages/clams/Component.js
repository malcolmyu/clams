import { types, callLifecycle, deepEqual } from './utils';
import createEventManager from './createEventManager';
import applyPlugins from './plugin';
import { listComponentMap } from './index';

class Component {
  constructor(props, isPage) {
    this._pluginsEmitter = createEventManager();
    this.props = Object.assign({}, this.constructor.defaultProps, props);
    // 使用插件
    applyPlugins(this, isPage);
  }

  setState(nextState) {
    // TODO: 做一个兼容小程序字符串格式的
    this.state = Object.assign({}, this.state, nextState);

    this._update();
  }

  /**
   * 初始化组件，在使用 children 构建组件对象时检测历史遗留，如果
   * 没有历史遗留，就直接进行组件的初始化构建
   *
   * @param key {String} 组件在父组件处的标记，随机生成的 $s_Counter_0 这样的
   * @param parent {Component} 父组件，主要是依赖父组件的 path
   * @param config {Object}
   * @private
   */
  _init(key, parent, config) {
    if (this._inited) return;
    this._setKeyPath(key, parent, config);

    if (!this.state) this.state = {};
    this._children = {};

    // TODO: 处理页面加载和组件生命周期
    if (key) {
      callLifecycle(this, 'onLoad');

      if (this.page._onReady) {
        callLifecycle(this, 'onReady');
      }

      if (this.page._onShow) {
        callLifecycle(this, 'onShow');
      }
    }

    this._inited = true;
    this._update();
  }

  /**
   * 在组件触发 setState 之后更新组件所在页面 data
   * 并检测是否有子组件依赖的 data 被更新，并更新子组件
   * 这里在循环组件更新时，当 key 值未变就会调用
   *
   * @private
   */
  _update() {
    const path = this.path ? `${this.path}.` : '';
    const nextData = {
      [`${path}props`]: this.props,
      [`${path}state`]: this.state
    };
    this.page.updateData(nextData);
    // 每次发生数据更新时都需要查看是否应该更新子组件
    this._updateChildren();
  }

  _updateListByStrategy(strategy, key, map, nextConfig, config, list, index) {
    const usedKeys = [];
    const nextList = [];
    const mapKeys = Object.keys(map);
    const usedIndex = [];

    nextConfig.forEach((child, i) => {
      let component;

      if (strategy === 'key') {
        // 寻找 key 一致的已存在组件进行更新
        const childKey = child.key + '';

        if (mapKeys.indexOf(childKey) > -1) {
          if (usedKeys.indexOf(childKey) === -1) {
            component = map[childKey];
            delete map[childKey];
          } else {
            console.warn(`存在重复的 key 值 ${childKey}，后一个重复 key 组件将会重新实例化，请确保 key 值唯一`);
          }
          usedKeys.push(childKey);
        }
      } else {
        let index = -1;
        // 按照 index 进行更新
        if (config && types.isArray(config)) {
          config.some((c, i) => {
            if (c.__data === child.__data) {
              usedIndex.push(i);
              index = i;
              return true;
            }
          });
        }
        component = list[index] || null;
      }

      child.keyPath = getKeyPath(index, i);

      nextList.push(this._updateChild(key, component, child))
    });

    // 这里剩下的 map 就需要销毁了
    Object.keys(map).forEach((k) => {
      callLifecycle(map[k], 'onUnload');
      map[k]._pluginsEmitter.$off();
    });

    if (strategy === 'key') {
      // 销毁没有写 key 的组件
      list.forEach((item) => {
        callLifecycle(item, 'onUnload');
        item._pluginsEmitter.$off();
      });
    } else {
      const unloadItems = list.filter((item, i) => usedIndex.indexOf(i) === -1);

      unloadItems.forEach((item) => {
        callLifecycle(item, 'onUnload');
        item._pluginsEmitter.$off();
      });
    }

    return nextList;
  }

  _updateListItem(key, nextConfig, config, children, index = '') {
    if (types.isArray(nextConfig[0])) {
      const retList = [];
      const retData = [];

      nextConfig.forEach((c, i) => {
        const cf = config ? config[i] : null;
        const child = children && children[i] ? children[i] : null;
        const nextIndex = getKeyPath(index, i);
        const { nextList, nextData } = this._updateListItem(key, c, cf, child, nextIndex);
        retList.push(nextList);
        retData.push(nextData);
      });

      return { nextList: retList, nextData: retData };
    }

    const map = {};
    const unKeyedItems = [];

    // 记录上个状态的 children 里的 listKey
    const list = children || null;
    if (list && types.isArray(list)) {
      list.forEach(item => {
        const listKey = item._listKey;
        if (listKey != null) {
          map[listKey] = item;
        } else {
          unKeyedItems.push(item);
        }
      });
    }

    // 组件的利用原理：
    // 1. 用户写了 key，那是坠吼的，直接用上个 key 相同的组件进行更新；
    // 2. 用户没写 key，那没办法，总不能全部删了更新吧，可以采用 index 来进行更新；
    const nextList = !list || Object.keys(map).length ?
      this._updateListByStrategy('key', key, map, nextConfig, config, unKeyedItems, index) :
      this._updateListByStrategy('index', key, map, nextConfig, config, list, index);

    // 最终还是要把它更新到页面的 data 上去
    const nextData = [];
    nextList.forEach((component, i) => {
      nextData.push({
        props: component.props,
        state: component.state,
        __k: component._listKey,
        __p: getKeyPath(index, i)
      });
    });

    return { nextList, nextData };
  }

  _updateChildren() {
    // 在 setState 之后，可能会导致子组件的变化，用 children 来存储已生成的子组件
    // 用生成函数再生成一次新的子组件 configs，比对两者之后进行更新
    const children = this._children || {};
    const nextConfigs = this.children && this.children();
    const configs = this._configs;

    if (!nextConfigs) return;

    if (deepEqual(nextConfigs, configs)) return;

    Object.keys(nextConfigs).forEach(key => {
      let nextConfig = nextConfigs[key];
      if (types.isArray(nextConfig)) {
        const config = configs ? configs[key] : null;
        const { nextData, nextList } = this._updateListItem(key, nextConfig, config, children[key]);
        const path = this.path ? `${this.path}.${key}` : key;
        this.page.updateData({ [path]: nextData });
        children[key] = nextList;
      } else {
        const component = children[key];
        children[key] = this._updateChild(key, component, nextConfig);

        if (component) {
          const { path, props, state } = component;
          const nextData = {
            [`${path}.props`]: props,
            [`${path}.state`]: state
          };
          this.page.updateData(nextData)
        }
      }
    });

    this._configs = nextConfigs;
    this._children = children;
  }

  /**
   * 在 updateChildren 时更新单个子组件的逻辑，这里又分为循环与落单两种情况
   *
   * 1. 在第一次更新的时候需要初始化实例
   * 2. 对于已存在的实例，需要更新 props 与 keyPath
   * 3. 对于循环中的组件，需要用 listIndex 来确定组件表示，优化更新
   *
   * @param key
   * @param component
   * @param config
   * @returns {*}
   * @private
   */
  _updateChild(key, component, config) {
    if (component) {
      component._setKeyPath(key, this, config);
      // 更新已存在实例的 props
      // TODO: 可以进行一个浅比对，或者干脆把权柄抛给用户
      const { shouldUpdate } = component;
      let componentShouldUpdate = true;

      if (types.isFunction(shouldUpdate)) {
        componentShouldUpdate = shouldUpdate.call(component, config.props);
      }

      if (componentShouldUpdate) {
        const nextProps = Object.assign({}, component.props, config.props);

        if (component.onUpdate) {
          component.onUpdate(nextProps);
        }
        component.props = nextProps;
        component._update();
      }
    } else {
      const compName = config.component;
      const componentList = listComponentMap();
      const Comp = componentList[compName].Component;

      component = new Comp(config.props);
      component._config = config;
      component._init(key, this, config);
    }
    return component;
  }

  _setKeyPath(key, parent, config) {
    this.key = key;
    const keyPath = config && config.keyPath ? (key + config.keyPath) : key;
    this._listKey = config ? config.key : null;

    if (parent) {
      this.page = parent.page;
      this.id = `${parent.id}:${keyPath}`;
    }

    if (key && parent && parent.path) {
      this.path = `${parent.path}.${keyPath}`;
    } else {
      this.path = keyPath;
    }
  }
}

function getKeyPath(index, i) {
  return index ? `${index}[${i}]` : `[${i}]`;
}

export default Component;
