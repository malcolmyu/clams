import Clams from 'clams';
import navigator from './plugins/navigator';

Clams.use(navigator);

App({
  onLaunch: function() {
    console.log('appLaunch');

    // 配置各种页面引入的组件
    require()
  }
});