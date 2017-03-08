# Clams

## 简介

微信小程序模块化开发脚手架工具，目前支持的功能有：

1. 解析 scss/less，转换为 wxss；
2. 强化小程序的模板功能，支持自定义组件；
3. 支持自定义 plugin，实现基于组件生命周期的扩展；
4. 支持自定义 alias 等配置；

未来会提供的功能：

1. 一键初始化小程序项目；
2. 文件/图片压缩功能；
3. 按需打包；
4. 等等……

## 使用方式 

**安装 clams**

从 npm 源安装。

```
npm install clams -g
```

**创建 demo**

在一个文件夹中，执行 `clams init`，可以在本文件夹中初始化一个 clams 项目。也可以在当前文件夹的自路径中创建一个新项目，如 `clams init clams-demo`，就会在当前路径下创建一个 clams-demo 文件夹，并在里面初始化项目。

**编译项目**

在 clams 项目中运行命令 `clams build`，项目中会生成 dist 文件夹；打开微信 web 开发者工具，『添加项目』，项目目录选择 dist 文件夹，然后导入项目即可。在开发时，需要勾选『项目』->『开启 ES6 转 ES5』。

**开发项目**

在 clams 项目中运行命令 `clams build`，在 src 文件夹中进行项目开发，保存文件时会自动编译到 dist 路径中。

与小程序开发最大的区别如下：

- 开发方式类似 React，所有的页面都以组件的方式开发，在页面和组件中也可以直接引用其他的组件；
- `setData` 方法修改为 `setState` 方法，`data` 属性修改为 `state` 属性；
- 可以直接编写组件，并在 wxml 中直接引用，并传递 `props`，这里纯字符串的 props 认为是传递的属性方法，插值 props 认为是传递的属性值；

更多用法请参考我们的 demo 工程。

**项目实例**

```js
class Home extends Component {
    state = {
        show: false,
        name: 'Malcolm'
    };

    getName(name) {
        this.setState({
            show: true,
            name
        });
    }

    openTodo() {
        // 使用了 navigator plugin，可以自由跳转
        this.navigateTo('TodoList');
    }
}
```

```xml
<view class="container">
    <import src="/components/UserInfo/UserInfo" />
    <import src="/components/Toast/Toast" />
    <text class="title">欢迎使用 Clams!</text>
    <text class="sub-title">本页面由两个组件构成，UserInfo 和 Toast，打开源码你就会发现，它们的使用、声明都非常简单明了。</text>
    <UserInfo defaultName="{{state.name}}" getCurrentName="getName"/>
    <Toast show="{{state.show}}" content="{{state.name}}" duration="{{300}}" />
    <text class="next-page" bindtap="openTodo">进入下一页</text>
</view>
```

