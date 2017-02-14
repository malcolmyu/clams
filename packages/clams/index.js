import createPage from './createPage';
import Component from './Component';

const inception = {};
const componentMap = {};
const plugins = {};

export function register(name, Component, path) {
  if(inception[name]) {
    Component.prototype.children = inception[name];
  }
  componentMap[name] = {
    Component,
    path
  };
}

export const listPlugins = () => Object.assign({}, plugins);
export const listComponentMap = () => Object.assign({}, componentMap);

export function use(plugin) {
  if (!plugin) return;
  if (typeof plugin.register !== 'function') {
    console.error('插件必须拥有 register 方法');
  } else {
    plugins.push(plugin);
  }
}

export { createPage, Component };

const Clams = {
  register,
  listPlugins,
  listComponentMap,
  use,
  createPage,
  Component,
};

export default Clams;