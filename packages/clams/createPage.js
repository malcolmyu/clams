import { types, getPath, buildListItem, lifecycleMap } from './utils';

// 构建一个所有 view 公用的通知系统
// const eventEmitter = createEventManager();

export default function createPage(ComponentClass) {
  const config = {
    data: {}
  };

  // dispatch hub
  config._d = function(event) {
    const { currentTarget, type } = event;
    const eventKey = currentTarget.dataset['bind' + type] || currentTarget.dataset['catch' + type];

    let path = currentTarget.dataset.path || '';
    let component = getPath(this.root, path, '_children');

    if (types.isFunction(component[eventKey])) {
      return component[eventKey](event);
    }
    console.error(`无法解析组件方法 ${component.id}#${eventKey}`);
  };

  config.onLoad = function(...args) {
    this.updateData = (nextData) => {
      const { data } = this;

      // 这里需要对数组进行特殊处理
      Object.keys(nextData).forEach(path => {
        const dataItem = nextData[path];
        if (types.isArray(dataItem)) {
          // 在页面的 data 中找到数据
          const list = getPath(data, path);
          // 对于组件集合的数组，需要按照 __k 来进行更新
          nextData[path] = dataItem.map(item => buildListItem(list, item));
        }
      });

      this.setData(nextData);
    };

    this.root = new ComponentClass({}, true);
    this.root.page = this;
    this.root.id = this.__route__;
    this.root._init('');

    if (types.isFunction(this.root.onLoad)) {
      this.root.onLoad.apply(this, args);
    }
    if (this.root._pluginsEmitter) {
      this.root._pluginsEmitter.$emit('onLoad');
    }
    lifecycleMap(this.root, config);
  };

  return config;
};
