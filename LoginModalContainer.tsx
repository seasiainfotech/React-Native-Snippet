import React, { Component } from 'react';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
// @ts-ignore
import LoginModal from '@components/modals/login';
// @ts-ignore
import FirebaseAnalytics, { FirebaseEventName } from '../../services/firebase/analytics'
import { Actions, getModalSelector } from '../../core/modules/app';
import { Actions as AccountActions } from '../../core/modules/account';
import { Actions as ConversationActions } from '../../core/modules/conversation';
import { LOGIN_MODAL, FORGOT_PASSWORD_MODAL } from '../../constants';
import getPlatform from '@lori/shared/utils/getPlatform';

// @ts-ignore
import AsyncStorage from '@lori/shared/config/storage';
// @ts-ignore
import createApiService from '@lori/shared/services/api/createApiService';

// @ts-ignore
import { store } from '@lori/shared/core/createStore';

// @ts-ignore
import mixpanel from '@lori/shared/services/mixpanel/mixpanel';

// @ts-ignore
import ErrorHandler, { InvalidLoginError, AccountLockedError } from '@lori/shared/errors';
import get from 'lodash/get';
import uuidv4 from 'uuid/v4';


// // @ts-ignore
// import { getItem } from '@lori/shared/utils/getLocalStorage'

interface IProps {
  modal: any;
  isLoggingIn: boolean;
  closeModal: (name: string) => any;
  openModal: (name: string) => any;
  login: (email: string, password: string) => any;
  initSession: (newStateId: string, nextState: string) => void;
  loginFailure: (message: string) => void;
  loginSuccess: () => void;
  store: any;
}

class LoginModalContainer extends Component<IProps> {

  state = {
    isModalOpen: this.getValue() ? this.getValue() : false,
    isLoggingIn: false
  };

  api: any = {};

  constructor(props: IProps) {
    super(props);

    this.api = createApiService({ store });

  }

  async getValue() {
    const value = await AsyncStorage.getItem('Login_Modal_Open');
    return JSON.parse(value ? value : false)
  }


  shouldComponentUpdate = ({ modal }: any, isLoggingIn: boolean) => {
    return isEqual(modal, this.props.modal) === false || this.props.isLoggingIn !== isLoggingIn;
  };

  onCloseModal = () => {
    AsyncStorage.removeItem('isLoginModalVisible');
    this.props.closeModal(LOGIN_MODAL);
  };

  onPressForgotPassword = () => {
    this.props.openModal(FORGOT_PASSWORD_MODAL);
  };


  loginRequest = async (email: string, password: string) => {
    try {
      const response = await this.api.login(email, password);

      const appInfo = get(response.data, 'appInfo', null);

      const appRequiresForceUpdateInfo = get(appInfo, 'requiresForceUpdate', false);

      if (appRequiresForceUpdateInfo) {
        throw new Error('Please update your app to the latest version');
        return;
      }

      if (!response.ok && !appRequiresForceUpdateInfo) {
        ErrorHandler.throwErrorBasedOnResponse(response);
      }

      const success = get(response.data, 'success', null);
      const nextState = get(response.data, 'nextState', null);
      const lockout = get(response.data, 'lockout', null);

      if (!success) {
        if (lockout) {
          // @ts-ignore
          throw new AccountLockedError({ meta: { email } });
        } else {
          // TODO: make sure the constructor class below has proper type definition
          // @ts-ignore
          throw new InvalidLoginError({ meta: { email } });
        }
      }

      // Put the login response in the store
      this.props.loginSuccess();

      mixpanel.track('login_success');
      // Log login event
      FirebaseAnalytics().logEvent(FirebaseEventName.LOGIN_SUCCESS);

      // Close the modal after success
      this.props.closeModal(LOGIN_MODAL);

      // Init a new session with the new State
      const newStateId = uuidv4();

      this.props.initSession(newStateId, nextState);
    } catch (e) {
      mixpanel.track('login_failed', { 'Error Message': e.message, 'Error Code': e.code });

      this.props.loginFailure(e.message)
    } finally {
      this.setState({
        isLoggingIn: false
      });
    }

  };

  onPressLogin = (email: string, password: string) => {
    this.setState({
      isLoggingIn: true
    });

    return this.loginRequest(email, password);

  };

  render() {
    const { modal } = this.props;

    const { isLoggingIn } = this.state;

    const { visible, data } = modal;

    if (getPlatform() === 'web') {
      if (localStorage.getItem('Login_Modal_Open')) {
        this.props.openModal(LOGIN_MODAL);
        AsyncStorage.removeItem('Login_Modal_Open');
        this.setState({ isModalOpen: false });
      }
    }

    if (visible) {
      AsyncStorage.setItem('isLoginModalVisible', JSON.stringify(true));
      FirebaseAnalytics().logEvent(FirebaseEventName.LOGIN_VIEW)
    }

    return (
      <LoginModal
        visible={visible}
        closeModal={this.onCloseModal}
        onPressForgotPassword={this.onPressForgotPassword}
        onPressLogin={this.onPressLogin}
        isSubmitting={isLoggingIn}
        {...data}
      />
    );
  }
}

// TODO: Create interface of state.
const mapStateToProps = (state: any) => ({
  modal: getModalSelector(state, LOGIN_MODAL),
  // isLoggingIn: state.account.isLoggingIn
});

const mapDispatchToProps = {
  openModal: Actions.openModal,
  closeModal: Actions.closeModal,
  login: AccountActions.login,
  loginSuccess: AccountActions.loginSuccess,
  loginFailure: AccountActions.loginFailure,
  initSession: ConversationActions.initSession
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LoginModalContainer as any);