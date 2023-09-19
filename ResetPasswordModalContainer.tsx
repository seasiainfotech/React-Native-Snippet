import React, { Component } from 'react';
// @ts-ignore
import ResetPasswordModal from '@components/modals/resetPassword';
import { Actions, getModalSelector } from '../../core/modules/app';
import { Actions as AccountActions } from '../../core/modules/account';
import { RESET_PASSWORD_MODAL, RESET_PASSWORD_ALERT_MODAL, LOGIN_MODAL } from '../../constants';
import { GlobalState } from '../../core/types';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import get from 'lodash/get';
// @ts-ignore
import FirebaseAnalytics, { FirebaseEventName } from '../../services/firebase/analytics';

// @ts-ignore
import mixpanel from '@lori/shared/services/mixpanel/mixpanel';

//@ts-ignore
import AsyncStorage from '@lori/shared/config/storage';

// @ts-ignore
import createApiService from '@lori/shared/services/api/createApiService';

// @ts-ignore
import { store } from '@lori/shared/core/createStore';

import ErrorHandler from '@lori/shared/errors';

import localizationStrings from '@lori/shared/localization';

interface IProps {
    modal: { visible?: boolean, data?: { userId: string, token: string } };
    isResettingPassword? : boolean;
    store: any;
    closeModal: (name: string) => any;
    openModal: (name: string) => any;
    resetPassword: (password: string, token: string, userId: string) => any;
    resetPasswordFailure: (message: string)=>void;
    resetPasswordSuccess: ()=>void;
    showToast: (data: any)=> void;

  }

class ResetPasswordModalContainer extends Component<IProps> {

    state = {
      isResettingPassword: false
    };

    api: any = {};

    constructor(props: IProps) {
      super(props)
      this.api = createApiService({store})
    }

    shouldComponentUpdate = ({ modal}: any, isResettingPassword : boolean) => {
        return isEqual(modal, this.props.modal) === false || this.props.isResettingPassword !== isResettingPassword;
    };

    onCloseModal = () => {
        this.props.closeModal(RESET_PASSWORD_MODAL);
    };

    onPressResetPassword = async (password: string) => {

      this.setState({
        isResettingPassword: true
      })

      try {

        const resetToken = get(this.props.modal, 'data.token', '');
        const userId = get(this.props.modal, 'data.userId', '');

        const response = await this.api.resetPassword(password, resetToken, userId);

        if (!response.ok && response.status !== 202) {
          this.props.closeModal(RESET_PASSWORD_MODAL);
          setTimeout(() => {
            this.props.openModal(RESET_PASSWORD_ALERT_MODAL);
          }, 500);
          ErrorHandler.throwErrorBasedOnResponse(response);
          return
        }

        this.props.resetPasswordSuccess();

        this.props.closeModal(RESET_PASSWORD_MODAL);

        setTimeout(() => {
          this.props.openModal(LOGIN_MODAL);
        }, 400);

        setTimeout(() => {
        this.props.showToast({
          text: localizationStrings.resetPassword.passwordUpdated,
          type: 'success'
        });
      }, 1000)

        mixpanel.track('set_new_password_success');
		    FirebaseAnalytics().logEvent(FirebaseEventName.RESET_PASSWORD_SUCCESS)
      } catch (e) {
        mixpanel.track('set_new_password_failed', {'Error Message': e.message, 'Error Code' : e.code});
        this.props.closeModal(RESET_PASSWORD_MODAL);
        setTimeout(() => {
          this.props.openModal(RESET_PASSWORD_ALERT_MODAL);
        }, 4000);
        // console.log("Error message:" , e.message)
        this.props.resetPasswordFailure(e.message)
      } finally {
        this.setState({
          isResettingPassword: false
        })
      }

    };

    render() {
        const { modal } = this.props;
        const { visible, data } = modal;
        const { isResettingPassword } = this.state

        if (visible) {
          FirebaseAnalytics().logEvent(FirebaseEventName.RESET_PASSWORD_VIEW)
        }

        return (
            <ResetPasswordModal
                resetParams={data}
                visible={visible}
                closeModal={this.onCloseModal}
                onPressResetPassword={this.onPressResetPassword}
                isSubmitting={isResettingPassword}
            />
        );
    }
   
}

const mapStateToProps = (state: GlobalState) => ({
  modal: getModalSelector(state, RESET_PASSWORD_MODAL),
});

const mapDispatchToProps = {
  openModal: Actions.openModal,
  closeModal: Actions.closeModal,
  showToast: Actions.showToast,
  resetPassword: AccountActions.resetPassword,
  resetPasswordFailure: AccountActions.resetPasswordFailure,
  resetPasswordSuccess: AccountActions.resetPasswordSuccess
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ResetPasswordModalContainer as any);