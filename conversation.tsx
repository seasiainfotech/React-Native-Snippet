import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getMessageIdsSelector } from '../../core/modules/conversation';
import ConversationItemContainer from './ConversationItemContainer';
import { View } from '@lori/shared/components/primitives';
import { ListView } from '@lori/shared/components/listView';
import { Actions } from '@lori/shared/core/modules/app';
import getPlatform from '@lori/shared/utils/getPlatform';

interface IProps {
  messageIds: any;
  style?: any;
  testID?: string;
  isLoading?: boolean;
  animatedTopMargin?: number;
  progressBarContainerHeight?: number;
}

class ConversationContainer extends Component<IProps> {

  _list: any;
  componentDidMount() {
    this.scrollToEnd({ behavior: 'instant' });
  }

  componentDidUpdate() {
    this.scrollToEnd();
  }

  scrollToEnd = (opts?: any) => {
    if (this._list) {
      this._list.scrollToEnd(opts);
    }
  };

  rowRenderer = ({ item }: any) => {
    return (
      <View style={{ flex: 1 }} key={`message-${item.messageId}`}>
        <ConversationItemContainer
          messageIndex={item.index}
          messageId={item.messageId}
          didUpdate={this.scrollToEnd}
          {...this.props}
          accessible={false}
        />
      </View>
    );
  };

  keyExtractor = (item: any) => item.messageId.toString();

  render() {
    const { 
      messageIds, 
      style, 
      testID, 
      animatedTopMargin = 0, 
      progressBarContainerHeight = 125
    } = this.props;

    let listViewContentContainerStyle: any = styles.container

    let listPaddingBottom = 0

    if (getPlatform() !== 'web') {
      const topMarginBarHidden = progressBarContainerHeight + animatedTopMargin

      listPaddingBottom = ((animatedTopMargin > -progressBarContainerHeight) ? progressBarContainerHeight : topMarginBarHidden)

      listViewContentContainerStyle = [styles.container, { paddingBottom: listPaddingBottom + 10}]
      // console.log("animated top margin: ", animatedTopMargin)
      // console.log("Progress bar container height: ", progressBarContainerHeight)
    } 

    return (
      <ListView
        ref={(ref: any) => {
          this._list = ref;
        }}
        style={style}
        contentContainerStyle={listViewContentContainerStyle}
        data={messageIds}
        keyExtractor={this.keyExtractor}
        renderItem={this.rowRenderer}
        initialNumToRender={8}
        removeClippedSubviews={true}
        maxToRenderPerBatch={25}
        windowSize={7}
        testID={testID}
      />
    );
  }
}

const styles = {
  container: {
    paddingTop: 8,
    paddingBottom: 8
  }
};

const mapStateToProps = (state: any) => ({
  messageIds: getMessageIdsSelector(state),
});

const mapDispatchToProps = {
  openModal: Actions.openModal,
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ConversationContainer);