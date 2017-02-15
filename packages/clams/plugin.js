import { listComponentMap, listPlugins } from './clams';

export default function(instance, isPage) {
  const map = listComponentMap();
  const plugins = listPlugins();
  const scope = isPage ? 'page' : 'component';

  // 确定当前组件名字
  const keys = Object.keys(map);
  let name;
  keys.some((key) => {
    if (map[key].Component === instance.constructor) {
      name = key;
      return true;
    }
  });

  if (!name) {
    console.error(`当前组件 ${instance.constructor.name} 尚未注册！`);
    return;
  }

  if (plugins && plugins.length) {
    plugins.forEach((p) => {
      // 确定组件 scope，如果不写就是都行
      p.scope = p.scope || 'all';
      if (p.scope !== 'all' && scope !== p.scope) {
        return;
      }

      if (typeof p.register === 'function') {
        p.register.call(
          instance,
          {
            emitter: instance._pluginsEmitter,
            name,
            plugins
          }
        );
      }
    });
  }
};