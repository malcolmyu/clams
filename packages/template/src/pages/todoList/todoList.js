const createKey = () => Math.random().toString(36).substr(2, 8);

class TodoList extends Component {
  state = {
    list: [
      {
        name: 'hello',
        list: [
          {
            key: createKey(),
            text: 'hello world'
          },
          {
            key: createKey(),
            text: 'hello world'
          }
        ]
      }
    ]
  };

  onInput(id, value) {
    const { list } = this.state;
    list.some(item => {
      if (item.key === id) {
        item.text = value;
        return true;
      }
    });
    this.setState({ list });
  }

  onRemove(id) {
    const { list } = this.state;
    list.forEach((item) => {
      item.list = item.list.filter(it => it.key !== id);
    });
    this.setState({ list });
  }

  addNewItem(e) {
    const { dataset } = e.currentTarget;
    const { idx } = dataset;
    const { list } = this.state;

    list[idx].list.push({
      key: createKey(),
      text: ''
    });

    this.setState({ list });
  }

  addNewGroup() {
    const { list } = this.state;
    list.push({
      name: 'hello',
      list: [
        {
          key: createKey(),
          text: 'new item'
        }
      ]
    });
    this.setState({ list });
  }
}