export default {
  scope: 'page',
  register(emitter, name, Clams) {
    console.log('current component name: ', name);

    emitter.$on('onLoad', () => {
      this.navigateTo = function(name) {
        const map = Clams.listComponentMap();
        if (map[name] && map[name].path) {
          console.log('navigate to: ', map[name].path);
          wx.navigateTo({ url: map[name].path });
        }
      }
    });
  }
};