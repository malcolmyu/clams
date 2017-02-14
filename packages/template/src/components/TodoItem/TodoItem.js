const STATUS = {
  checked: {
    type: 'success',
    color: '#00bd00'
  },
  unchecked: {
    type: 'circle',
    color: 'grey'
  }
};

class TodoItem extends Component {
  constructor(props) {
    super(props);
    this.state = {
      checked: false,
      type: 'circle',
      color: 'grey',
      value: props.defaultValue
    };
  }

  toggleCheckbox() {
    const next = !this.state.checked;
    const status = `${next ? '' : 'un'}checked`;
    this.setState({
      checked: next,
      type: STATUS[status].type,
      color: STATUS[status].color
    });
  }

  onRemove() {
    if (typeof this.props.onRemove === 'function') {
      this.props.onRemove(this.props.idx);
    }
  }

  shouldUpdate(nextProps) {
    const keys = Object.keys(nextProps);

    return keys.some(key => nextProps[key] !== this.props[key]);
  }

  onInput(e) {
    this.setState({ value: e.detail.value });

    if (typeof this.props.onInput === 'function') {
      this.props.onInput(this.props.idx, e.detail.value);
    }
  }

  onUpdate() {
    console.log(this.path + ' updated');
  }

  onUnload() {
    console.log('removed')
  }
}