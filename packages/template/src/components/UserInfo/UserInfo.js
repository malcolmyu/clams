class UserInfo extends Component {

  static defaultProps = {
    defaultName: 'Tom',
    getCurrentName: () => {}
  };

  constructor(props) {
    super(props);

    this.state = {
      name: props.defaultName || 'Tom'
    };
    this.randomList = ['Tom', 'Jerry', 'Michel', 'Mick', 'Richard'];
  }

  onLoad() {
    console.log('UserInfo loaded!');
  }

  randomName() {
    const index = Math.floor(Math.random() * 4);
    this.setState({
      name: this.randomList[index]
    });
    this.props.getCurrentName(this.randomList[index]);
  }
}