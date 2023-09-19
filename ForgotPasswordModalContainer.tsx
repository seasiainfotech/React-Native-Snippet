import React, { Component } from 'react';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import get from 'lodash/get';
import ForgotPasswordModal from '../../components/forgotPassword';
import { Actions as AppActions, getModalSelector } from '../../core/modules/app';
import { Actions as AccountActions } from '../../core/modules/account';
import { LOGIN_MODAL, FORGOT_PASSWORD_MODAL } from '../../constants';
import getPlatform from '@lori/shared/utils/getPlatform';
// @ts-ignore
import FirebaseAnalytics, { FirebaseEventName } from '../../services/firebase/analytics';
// @ts-ignore
import mixpanel from '@lori/shared/services/mixpanel/mixpanel';

// @ts-ignore
import AsyncStorage from '@lori/shared/config/storage';

// @ts-ignore
import createApiService from '@lori/shared/services/api/createApiService';

// @ts-ignore
import { store } from '@lori/shared/core/createStore';

import ErrorHandler from '@lori/shared/errors';

import localizationStrings from '@lori/shared/localization';

interface IProps {
  modal: any;
  isRequestingPassword?: boolean;
  loginModal?: any;
  store?: any;
  closeModal: (name: string) => any;
  openModal: (name: string) => any;
  requestResetPassword?: (email: string) => any;
  requestResetPasswordFailure: (message: string)=>any;
  requestResetPasswordSuccess: ()=>any;
  showToast: (data: any)=> void;

}

class ForgotPasswordModalContainer extends Component<IProps> {

  state = {
    isModalOpen: this.getValue() ? this.getValue() : false,
    isRequestingPassword: false
  };

  api: any = {};

   constructor(props: IProps) {
     super(props)
     this.api = createApiService({store})
   }

  async getValue(){
    const value = await AsyncStorage.getItem('ForgotPassword_Modal_Open');
    return JSON.parse(value? value: false)
  }

  shouldComponentUpdate = ({ modal, isRequestingPassword }: any) => {
    return isEqual(modal, this.props.modal) === false || this.props.isRequestingPassword !== isRequestingPassword;
  };

  onCloseModal = () => {
    AsyncStorage.removeItem('isForgotPasswordModalVisible');
    // Avoid closing the modal when requesting the reset password
    if (!this.state.isRequestingPassword) {
      this.props.closeModal(FORGOT_PASSWORD_MODAL);
    }
  };

  onModalHide = () => {
    const { openModal, loginModal, modal } = this.props;

    const preventLoginModal = get(modal, 'data.preventLoginModal', false);

    // If login modal is closed, then open again
    // (this hack is for mobile because can't be two or more modal opened at the same time)
    if (!loginModal.visible && preventLoginModal === false) {
      openModal(LOGIN_MODAL);
    }
  };

  onSubmit = async (email: string) => {
    this.setState({
      isRequestingPassword: true
    })

    mixpanel.track('forgot_password_attempt');
    
    try {
      const response = await this.api.requestResetPassword(email);

      const success = get(response.data, 'success', null);

      const appInfo = get(response.data, 'appInfo', null);

       const appRequiresForceUpdateInfo = get(appInfo, 'requiresForceUpdate', false);

       if (appRequiresForceUpdateInfo){
         throw new Error("Please update your app to the latest version")
         return;
       }

       if (!response.ok && !success)  {
        ErrorHandler.throwErrorBasedOnResponse(response);
      }

      this.props.requestResetPasswordSuccess();

      this.props.closeModal(FORGOT_PASSWORD_MODAL)

      setTimeout(() => {
        this.props.showToast({
          text: localizationStrings.forgotPassword.success,
          type: 'success'
        });
      }, 1000)

      mixpanel.track('forgot_password_success');

      FirebaseAnalytics().logEvent(FirebaseEventName.FORGOT_PASSWORD_SUCCESS)

    }catch (e) {
      mixpanel.track('set_new_password_failed', {'Error Message': e.message, 'Error Code' : e.code});

      // console.log("Error message:" , e.message)
      this.props.requestResetPasswordFailure(e.message)
    } finally {
      this.setState({
        isRequestingPassword: false
      })
    }
  }

  render() {
    const { modal } = this.props;

    const { isRequestingPassword } = this.state
    
    const { visible, data } = modal;
    if (getPlatform() === 'web') {
      if( localStorage.getItem('ForgotPassword_Modal_Open') ){
        this.props.openModal(FORGOT_PASSWORD_MODAL);
        AsyncStorage.removeItem('ForgotPassword_Modal_Open');
        this.setState({isModalOpen: false});
      }
    }

    if (visible) {
      AsyncStorage.setItem('isForgotPasswordModalVisible', JSON.stringify(true));
      FirebaseAnalytics().logEvent(FirebaseEventName.FORGOT_PASSWORD_VIEW)
    }
    return (
      <ForgotPasswordModal
        visible={visible}
        closeModal={this.onCloseModal}
        onSubmit={this.onSubmit}
        onModalHide={this.onModalHide}
        isSubmitting={isRequestingPassword}
        {...data}
      />
    );
  }
}

const mapStateToProps = (state: any) => ({
  modal: getModalSelector(state, FORGOT_PASSWORD_MODAL),
  loginModal: getModalSelector(state, LOGIN_MODAL)
});

const mapDispatchToProps = {
  closeModal: AppActions.closeModal,
  openModal: AppActions.openModal,
  showToast: AppActions.showToast,
  requestResetPassword: AccountActions.requestResetPassword,
  requestResetPasswordFailure: AccountActions.requestResetPasswordFailure,
  requestResetPasswordSuccess: AccountActions.requestResetPasswordSuccess,

};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ForgotPasswordModalContainer);