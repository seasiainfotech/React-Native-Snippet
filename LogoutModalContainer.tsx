import React, { Component } from 'react';
import { connect } from 'react-redux';
import isEqual from 'lodash/isEqual';
import Alert from '@lori/shared/components/alert';
import localizationStrings from '@lori/shared/localization';
import { Actions, getModalSelector } from '../../core/modules/app';
import { Actions as AccountActions } from '../../core/modules/account';
import { LOGOUT_MODAL } from '../../constants';
// @ts-ignore
import mixpanel from '@lori/shared/services/mixpanel/mixpanel';

interface IProps {
  modal: any;
  closeModal: (name: string) => any;
  logout: () => any;
  testID_ok?: string;
  testID_cancel?:string;

}

class LogoutModalContainer extends Component<IProps> {
  shouldComponentUpdate = ({ modal }: any) => {
    return isEqual(modal, this.props.modal) === false;
  };

  onCloseModal = () => {
    this.props.closeModal(LOGOUT_MODAL);
  };

  onOKModal = () => {
    this.props.logout();
  };

  render() {
    const {modal, testID_ok, testID_cancel} = this.props;

    const { visible } = modal;

    return (
      //@ts-ignore
      <Alert
        testID_ok={testID_ok}
        testID_cancel={testID_cancel}
        title={localizationStrings.logout.title}
        content={localizationStrings.logout.content}
        okText={localizationStrings.common.logout}
        visible={visible}
        onPressOk={this.onOKModal}
        onPressCancel={this.onCloseModal}
        closeModal={this.onCloseModal}
      />
    );
  }
}

const mapStateToProps = (state: any) => ({
  modal: getModalSelector(state, LOGOUT_MODAL)
});

const mapDispatchToProps = {
  closeModal: Actions.closeModal,
  logout: AccountActions.logout
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(LogoutModalContainer);