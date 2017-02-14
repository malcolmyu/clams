import Clams, { Component } from 'clams';

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

export default Home;
