class Toast extends Component {
  static defaultProps = {
    show: false,
    content: 'hello',
    duration: null
  };

  constructor(props) {
    super(props);
    this.state = {
      show: props.show || false
    };

    this.changeVisibleState()
  }

  onUpdate(nextProps) {
    clearTimeout(this.timer);
    this.setState({ show: nextProps.show });

    this.changeVisibleState();
  }

  onUnload() {
    clearTimeout(this.timer);
  }

  changeVisibleState() {
    if (this.state.show && this.props.duration !== null) {
      this.timer = setTimeout(
        () => this.setState({ show: false }),
        +this.props.duration || 0
      )
    }
  }
}