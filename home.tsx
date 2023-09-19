import React, { PureComponent } from 'react';
import  {connect } from 'react-redux';
import NavigationHandler from '@lori/shared/navigation/handler.native';
import {MENU_MODAL} from '@lori/shared/constants';
import {Actions} from '@lori/shared/core/modules/app';
import Colors from '@lori/shared/theme/colors';
import Container from '@lori/shared/components/layout/Container.native';
import NavIcon from '@lori/shared/components/navigation/NavIcon.native';
// @ts-ignore
import LogoHeader from '@lori/shared/components/logo/LogoHeader';
import NavigationOption from '@lori/shared/containers/navigation/NavigationOption';
import ConversationView from '@lori/shared/containers/conversation';
import WidgetRouter from '@lori/shared/containers/conversation/WidgetRouter';
import {withSafeAreaViewHandler} from '../components/safeAreaView';
import ProgressBarIndicator from '@lori/shared/components/progressBarIndicator/ProgressBarIndicator';
import { Animated, StyleSheet, Keyboard } from 'react-native';
import {checkIsModalOpen} from '@lori/shared/utils/common';

interface IProps {
  safeAreaView: any;
  isVisible?: boolean;
  isModalOpen?: any;
}

interface IState {
  moveAnimation: any,
  topMargin: number,
  isKeyboardOpen: boolean,
  progressBarContainerHeight: number
}

const PROGRESS_BAR_VERTICAL_DISTANCE = -100;

class HomeContainer extends PureComponent<IProps> {
  static navigationOptions = () => ({
    headerTitle: () => <LogoHeader inverted />,
    headerLeft: ()=>(
      <NavIcon
        left
        onPress={() =>
          NavigationHandler.dispatch(Actions.openModal(MENU_MODAL))
        }
        icon='hamburger'
      />
    ),
    headerRight: ()=>(
      <NavigationOption/>
    ),
  });

  async componentDidMount() {
    this.props.safeAreaView.setBottomColor(Colors.grayXl); // @TODO Move this to be in options

    Keyboard.addListener('keyboardDidShow', this.keyboardDidShow);
    Keyboard.addListener('keyboardDidHide', this.keyboardDidHide);
  }

  componentWillUnmount() {
    Keyboard.removeListener('keyboardDidShow', this.keyboardDidShow);
    Keyboard.removeListener('keyboardDidHide', this.keyboardDidHide);
  }

  keyboardDidShow = () => {
    this.setState({
      isKeyboardOpen: true
    });
    this.hideProgressbar()
  };

  keyboardDidHide = () => {
    this.setState({
      isKeyboardOpen: false
    });
    this.showProgressbar()
  };


  componentDidUpdate(prevProps: IProps, prevState: IState) {
    if(!this.state.isKeyboardOpen){
      const runShowAnimation = (prevState.moveAnimation.__getValue().y === PROGRESS_BAR_VERTICAL_DISTANCE && this.props.isVisible)

      const rideHideAnimation = (prevState.moveAnimation.__getValue().y === 0 && !this.props.isVisible)

      if (runShowAnimation) {
        this.showProgressbar()
      } else if (rideHideAnimation) {
        this.hideProgressbar()
      }
    }
    
  }

  state = {
    moveAnimation: new Animated.ValueXY({ x: 0, y: PROGRESS_BAR_VERTICAL_DISTANCE }),
    topMargin: 0,
    isKeyboardOpen: false,
    progressBarContainerHeight: PROGRESS_BAR_VERTICAL_DISTANCE
  };

  showProgressbar = () => {
      Animated.timing(this.state.moveAnimation, {
        toValue: {x: 0, y: 0},
        duration: 300
      }).start();
  };

  hideProgressbar = () => {
    Animated.timing(this.state.moveAnimation, {
      toValue: {x: 0, y: PROGRESS_BAR_VERTICAL_DISTANCE},
      duration: 300
    }).start();
  };

  onViewLayout = ({ nativeEvent }: any) => {
      this.setState({ 
        topMargin: nativeEvent.layout.y, 
        progressBarContainerHeight: nativeEvent.layout.height
      })
  }

  setIsVisible = (isVisible: boolean) => {
    this.setState({
      isVisible
    })
  }

  render() {
    const { topMargin } = this.state;
    const isModalOpen = checkIsModalOpen(this.props.isModalOpen.modals);
    return (
      <Container testID='home_screen'>
          <Animated.View
                style={[
                  styles.transformContainer,
                  this.state.moveAnimation.getLayout(),
                ]}
                onLayout={this.onViewLayout}
              >
             {!isModalOpen && <ProgressBarIndicator setIsVisible={this.setIsVisible}/>} 
          </Animated.View>
        <ConversationView 
          testID={'conversation_view'} 
          style={{paddingTop: 8, paddingBottom:8}} 
          animatedTopMargin={topMargin}
          progressBarContainerHeight={this.state.progressBarContainerHeight}
        />
        <WidgetRouter />
      </Container>
    );
  }
}

const styles = StyleSheet.create({
  transformContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    backgroundColor: '#F6F5F8'
  }
});

const mapStateToProps = (state :any) => ({
  progressBarData: state.conversation.progressBarData,
  howItWorksData: state.conversation.howItWorksData,
  isVisible: state.conversation.showProgressBar,
  isModalOpen: state.app,
});

const HomeContainerWithSafeView = withSafeAreaViewHandler(HomeContainer);

export default connect(mapStateToProps)(HomeContainerWithSafeView);