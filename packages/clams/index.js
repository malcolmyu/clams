import createPage from './createPage';
import Component from './Component';
import {
  use,
  register,
  inceptionRegister,
  listComponentMap,
  listPlugins
} from './clams';

export { createPage, Component };

const Clams = {
  use,
  register,
  inceptionRegister,
  createPage,
  Component,
  listComponentMap,
  listPlugins
};

export default Clams;

module.exports = Clams;
