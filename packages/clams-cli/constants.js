export const SLOGAN = 'Clams';
export const R_IMPORT = /@import(?:\s*(['"])([^'"]+)\1\s*,\s*)*(?:\s*(['"])([^'"]+)\3\s*);?/g;
export const R_S_COMMENT = /\/\/.*(?:[\n\r]|$)/g;
export const R_M_COMMENT = /\/\s*\*(?:(?!(\*\s*\/)).|[\n\r])*(?:\*\s*\/)/g;
export const ARG_NAME = `__$$yaa`;

export const INCEPTION_INIT = `
exports.insertChildren = function (_y) {
  return 'IN_EOF';
};
exports.insertRequire = function (_y) {
  return 'RE_EOF';
};
`;
