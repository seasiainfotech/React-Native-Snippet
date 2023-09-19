import React, { Component } from 'react';
import { connect } from 'react-redux';
import get from 'lodash/get';
import ConversationItem from '../../components/conversation/ConversationItem';
import {
  Actions,
  makeGetMessageByIdSelector
} from '../../core/modules/conversation';
import { MESSAGE_STATUS, INTERNAL_MESSAGE_TYPE } from '../../constants';

interface IProps {
  messageIndex: number,
  message: any;
  didUpdate: any;
  messageId: number;
  retryPostUserInput: any;
  editState: any;
  errorMeta: string;
  openModal: (data: any) => any;
}

class ConversationItemContainer extends Component<IProps> {
  shouldComponentUpdate = ({ message }: any) => {
    return (
      this.props.message &&
      (this.props.message.status !== message.status ||
        this.props.message.isLast !== message.isLast ||
        this.props.message.editable !== message.editable)
    );
  };

  componentDidUpdate(prevProps: any) {
    const { didUpdate, messageId, message } = this.props;

    if (message && prevProps.message && didUpdate) {
      if (message.status !== prevProps.message.status) {
        didUpdate(messageId, message);
      }
    }
  }

  onPressError = () => {
    const { message, retryPostUserInput } = this.props;

    const prevInput =
      message.meta.prevInput ||
      (message.stateId && { stateId: message.stateId }) ||
      null;

    const isEditing = message.meta.isEditing || false;

    if (prevInput !== null) {
      retryPostUserInput(prevInput, isEditing);
    }
  };

  onEditState = () => {
    const { message, editState } = this.props;
    editState(message.stateId);
  };

  render() {
    const { messageIndex, errorMeta, message } = this.props;
    if (!message) return null;

    const internalType = get(
      message,
      'internalType',
      INTERNAL_MESSAGE_TYPE.SYSTEM
    );

    if (
      message.status === MESSAGE_STATUS.PENDING &&
      internalType !== INTERNAL_MESSAGE_TYPE.LOADING
    ) {
      return null;
    }

    const errorCode = get(errorMeta, 'errorCode', null);
    const cuiErrorCode = get(errorMeta, 'cuiErrorCode', null);
    const cuiErrorMessage = get(errorMeta, 'cuiErrorMessage', null);
    const hideWidget = get(errorMeta, 'hideWidget', null);

    const editable = get(message, 'editable', false);

    const isRight = internalType === INTERNAL_MESSAGE_TYPE.USER;
    const isLast =
      internalType === INTERNAL_MESSAGE_TYPE.SYSTEM && message.isLast;
    const isFirst =
      internalType === INTERNAL_MESSAGE_TYPE.SYSTEM && message.isFirst;

    return (
      <ConversationItem
        editable={editable}
        showAvatar={message.isLast}
        isRight={isRight}
        onPressError={this.onPressError}
        onPressEdit={this.onEditState}
        {...message}
        messageIndex={messageIndex}
        isLast={isLast}
        isFirst={isFirst}
        errorCode={errorCode}
        cuiErrorCode={cuiErrorCode}
        cuiErrorMessage={cuiErrorMessage}
        isWidgetVisible={!hideWidget}
      />
    );
  }
}

const makeMapStateToProps = () => {
  const getMessageByIdSelector: any = makeGetMessageByIdSelector();

  return (state: any, props: any) => {
    return {
      message: getMessageByIdSelector(state, props.messageId),
      errorMeta: state.conversation.errorMeta
    };
  };
};

const mapDispatchToProps = {
  retryPostUserInput: Actions.retryPostUserInput,
  editState: Actions.editState
};

export default connect(
  makeMapStateToProps,
  mapDispatchToProps
)(ConversationItemContainer);