import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  View as RNView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  useWindowDimensions,
  Platform,
  Linking,
  AppState,
} from 'react-native'
import { AppText, LoadingIndicator, ConfirmationModal } from 'app/components'
import { tw } from 'app/utils/tw'
import { useThemeStore } from 'app/store/useThemeStore'
import { useHeaderStore } from 'app/store/useHeaderStore'
import {
  useNotifications,
  useDeleteNotification,
  useBulkDeleteNotifications,
  useMarkAllAsRead,
} from 'app/api/notification/notification.hooks'
import { NotificationItem } from './components'
import { useTranslation } from 'react-i18next'
import { PushNotificationExample } from 'app/components/PushNotificationExample'
import { useCrossPlatformNavigation } from 'app/hooks/useCrossPlatformNavigation'
import { useBackHandler } from 'app/hooks/useBackHandler'
import { useDevice } from 'app/hooks/useDevice'
import { usePushNotification } from 'app/hooks/usePushNotification'
import * as Notifications from 'expo-notifications'
import GroupMenu from 'app/features/home/groups/components/GroupMenu'
import { TrashIcon, Cross } from 'app/assets'
import { SHOW_DEBUG_PUSH_NOTIFICATIONS } from 'app/api/config'
import Header from 'app/features/home/components/Header'
import { PostDetailsModal } from 'app/features/home/newsfeed/components/PostDetailsModal'
import { CommentsScreen } from 'app/features/home/newsfeed/comments/CommentsScreen'
import { PostDetailScreen } from 'app/features/home/newsfeed/PostDetailScreen'

import { GroupDashboardScreenV2 } from 'app/features/home/groups/group-dashboard/GroupDashboardScreenV2'

// Debug mode flag - set to true to enable push notification testing
const DEBUG_MODE = __DEV__ // Only enable in development

interface NotificationScreenProps {
  onBack?: () => void
  showHeader?: boolean
  onGroupPress?: (groupId: string | number) => void
}

export function NotificationScreen({
  onBack,
  showHeader = true,
  onGroupPress,
}: Readonly<NotificationScreenProps>) {
  const { colors } = useThemeStore()
  const { t } = useTranslation()
  const { navigation, navigateTo } = useCrossPlatformNavigation()
  const { isWeb } = useDevice()
  const rootViewRef = React.useRef<RNView>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showPushDemo, setShowPushDemo] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    left?: number
    right?: number
  }>({ top: 0, right: 10 })
  const [selectedNotificationId, setSelectedNotificationId] = useState<
    string | number | null
  >(null)
  const [modalState, setModalState] = useState<{
    visible: boolean
    type: 'comments' | 'post-detail' | null
    postId: string | null
    notificationType?: string
  }>({ visible: false, type: null, postId: null })
  const [isDeleteAllModalVisible, setIsDeleteAllModalVisible] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<
    string | number | null
  >(null)

  // Push notification permissions check
  const [hasPermission, setHasPermission] = useState<boolean>(true) // default to true to not flash
  const { requestPermissions } = usePushNotification()

  useEffect(() => {
    const checkPermission = async () => {
      if (Platform.OS === 'web') return
      try {
        const { status } = await Notifications.getPermissionsAsync()
        setHasPermission(status === 'granted')
      } catch (e) {
        console.error('Error checking notification permission', e)
      }
    }
    checkPermission()
  }, [])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && Platform.OS !== 'web') {
        try {
          const { status } = await Notifications.getPermissionsAsync()
          setHasPermission(status === 'granted')
          if (status === 'granted') {
            await requestPermissions()
          }
        } catch (e) {
          console.error('Error refreshing notification permission on app active', e)
        }
      }
    })
    return () => subscription.remove()
  }, [requestPermissions])

  const handleEnableNotifications = async () => {
    if (Platform.OS === 'web') return
    const { status, canAskAgain } = await Notifications.getPermissionsAsync()

    if (canAskAgain && status !== 'granted') {
      const success = await requestPermissions()
      setHasPermission(success)
    } else if (!canAskAgain && status !== 'granted') {
      if (Platform.OS === 'ios') {
        Linking.openURL('app-settings:')
      } else {
        Linking.openSettings()
      }
    }
  }

  const handleNavigationRequest = useCallback(
    (path: string, notificationType?: string) => {

      if (isWeb) {
        if (path.startsWith('/comments?postId=')) {
          const postId = path.split('postId=')[1]
          setModalState({
            visible: true,
            type: 'comments',
            postId: postId || null,
            notificationType,
          })
          return
        }
        if (path.startsWith('/post-detail?postId=')) {
          const postId = path.split('postId=')[1]
          setModalState({
            visible: true,
            type: 'post-detail',
            postId: postId || null,
            notificationType,
          })
          return
        }
      }

      if (
        path.startsWith('group-dashboard-v2?id=') ||
        path.startsWith('/group-dashboard-v2?id=')
      ) {
        const groupId = path.split('id=')[1]
        if (groupId) {
          if (isWeb) {
            const webPath = path.startsWith('/') ? path : `/${path}`
            navigateTo(webPath)
            return
          }

          if (onGroupPress) {
            onGroupPress(groupId)
          } else {
            setSelectedGroupId(groupId)
          }
          return
        }
      }

      navigateTo(path)
    },
    [isWeb, navigateTo, onGroupPress, selectedGroupId],
  )

  const handleBack = useCallback(() => {
    if (showPushDemo) {
      setShowPushDemo(false)
      return true
    }
    if (selectedGroupId) {
      setSelectedGroupId(null)
      return true
    }
    if (onBack) {
      onBack()
      return true
    }
    if (navigation.canGoBack()) {
      navigation.goBack()
      return true
    }
    return false
  }, [showPushDemo, onBack, navigation])

  useBackHandler(handleBack)

  // Fetch notifications using the hook
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
  } = useNotifications({ limit: 10 })

  // Header loading state
  const { setIsHeaderLoading } = useHeaderStore()

  useEffect(() => {
    setIsHeaderLoading(isRefetching && !isFetchingNextPage && !refreshing)
  }, [isRefetching, isFetchingNextPage, refreshing, setIsHeaderLoading])

  // Clear all notifications mutation
  const { mutate: deleteNotification } = useDeleteNotification()
  const { mutate: bulkDeleteNotifications, isPending: isClearingAll } =
    useBulkDeleteNotifications()
  const { mutate: markAllAsRead, isPending: isMarkingAllRead } =
    useMarkAllAsRead()

  const { width: screenWidth } = useWindowDimensions()

  const handleMenuPress = useCallback(
    (id: string | number, ref: React.RefObject<RNView | null>) => {
      if (isWeb) {
        // Web: GroupMenu uses position:'fixed' (viewport-relative).
        // pageX/pageY from measure() are already viewport-relative on web.
        if (ref.current) {
          ref.current.measure((x, y, width, height, pageX, pageY) => {
            const rightPos = screenWidth - (pageX + width) - 10
            setMenuPosition({
              top: pageY + height + 5,
              right: Math.max(10, rightPos),
            })
            setSelectedNotificationId(id)
            setShowMenu(true)
          })
        }
        return
      }
      // Mobile: original code unchanged
      if (ref.current && rootViewRef.current) {
        ref.current.measure((x, y, width, height, pageX, pageY) => {
          rootViewRef.current?.measure((rx, ry, rw, rh, rpageX, rpageY) => {
            // Calculate position relative to container
            const relativeTop = pageY - rpageY
            const relativeLeft = pageX - rpageX

            // Calculate right offset: screenWidth - (relativeLeft + width)
            const rightPos = screenWidth - (relativeLeft + width) - 10

            setMenuPosition({
              top: relativeTop + height + 5,
              right: Math.max(10, rightPos),
            })
            setSelectedNotificationId(id)
            setShowMenu(true)
          })
        })
      }
    },
    [screenWidth, isWeb],
  )

  const handleDelete = useCallback(() => {
    if (selectedNotificationId) {
      deleteNotification({ notificationId: selectedNotificationId.toString() })
      setShowMenu(false)
      setSelectedNotificationId(null)
    }
  }, [selectedNotificationId, deleteNotification])

  // Flatten notifications from all pages and deduplicate by ID (pagination overlap)
  const notifications = Array.from(
    new Map(
      (data?.pages.flatMap((page) => page.notifications) || []).map((n) => [
        n.id,
        n,
      ]),
    ).values(),
  )

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  // Handle load more
  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  // Render footer loading indicator
  const renderFooter = () => {
    if (!isFetchingNextPage) return null
    return (
      <View style={tw`py-4 items-center`}>
        <LoadingIndicator />
      </View>
    )
  }

  const renderClearAll = () => (
    <TouchableOpacity
      onPress={() => markAllAsRead()}
      disabled={isMarkingAllRead}
      style={tw`flex-row items-center gap-1`}
    >
      <Cross
        size={12}
        color={isMarkingAllRead ? colors.text.gray : colors.text.highlight}
      />
      <AppText
        size="xs"
        style={{
          color: isMarkingAllRead ? colors.text.gray : colors.text.primary,
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {isMarkingAllRead
          ? t('notifications.clearing')
          : t('notifications.clearAll')}
      </AppText>
    </TouchableOpacity>
  )

  const renderDeleteAll = () => (
    <TouchableOpacity
      onPress={() => setIsDeleteAllModalVisible(true)}
      disabled={isClearingAll}
      style={tw`flex-row items-center gap-1`}
    >
      <Cross
        size={12}
        color={isClearingAll ? colors.text.gray : colors.text.highlight}
      />
      <AppText
        size="xs"
        style={{
          color: isClearingAll ? colors.text.gray : colors.text.primary,
          fontSize: 11,
          lineHeight: 14,
        }}
      >
        {isClearingAll
          ? t('notifications.deleting')
          : t('notifications.deleteAll')}
      </AppText>
    </TouchableOpacity>
  )

  const renderNotificationActions = () => (
    <View style={tw`flex-row items-center gap-3 mt-1`}>
      {renderDeleteAll()}
      {renderClearAll()}
    </View>
  )

  // If in debug mode and push demo is shown, render the demo component
  if (DEBUG_MODE && showPushDemo) {
    return (
      <View style={[tw`flex-1`, { backgroundColor: colors.background }]}>
        {/* Header with back button */}
        <View
          style={[
            tw`flex-row items-center justify-between p-4 border-b`,
            { borderColor: colors.border },
          ]}
        >
          <TouchableOpacity onPress={handleBack}>
            <AppText
              style={[{ color: colors.primary }, tw`text-base font-medium`]}
            >
              ← Back to Notifications
            </AppText>
          </TouchableOpacity>
          <AppText
            style={[tw`text-base font-medium`, { color: colors.text.primary }]}
          >
            Push Notification Demo
          </AppText>
          <View style={tw`w-20`} />
        </View>

        {/* Push notification demo component */}
        <PushNotificationExample />
      </View>
    )
  }

  // Render main content based on state
  const renderHeader = () => {
    if (hasPermission || isWeb) return null
    return (
      <TouchableOpacity
        onPress={handleEnableNotifications}
        style={[
          tw`px-4 py-3 flex-row items-center justify-between border-b`,
          { backgroundColor: colors.primary + '1A', borderColor: colors.border },
        ]}
      >
        <View style={tw`flex-1 mr-2`}>
          <AppText size="small" fontWeight="medium" style={{ color: colors.primary }}>
            {t('notifications.enablePushTitle', 'Enable Push Notifications')}
          </AppText>
          <AppText size="xs" style={{ color: colors.text.secondary, marginTop: 2 }}>
            {t('notifications.enablePushDesc', "Stay updated with important activity")}
          </AppText>
        </View>
        <View style={[tw`px-3 py-1.5 rounded-full`, { backgroundColor: colors.primary }]}>
          <AppText size="xs" fontWeight="semibold" style={{ color: colors.background }}>
            {t('common.enable', 'Enable')}
          </AppText>
        </View>
      </TouchableOpacity>
    )
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={tw`flex-1 items-center justify-center`}>
          <LoadingIndicator />
        </View>
      )
    }

    if (isError) {
      return (
        <View style={tw`flex-1 items-center justify-center px-4`}>
          <AppText variant="gray" size="base" style={tw`text-center mb-4`}>
            {t('notifications.errorLoading')}
          </AppText>
          <AppText variant="gray" size="small" style={tw`text-center mb-4`}>
            {error?.message || t('common.error')}
          </AppText>
          <TouchableOpacity
            onPress={() => refetch()}
            style={[tw`px-6 py-3 rounded`, { backgroundColor: colors.primary }]}
          >
            <AppText style={{ color: colors.background }} fontWeight="semibold">
              {t('notifications.tryAgain')}
            </AppText>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <FlatList
        data={notifications}
        style={tw`flex-1`}
        renderItem={({ item }) => (
          <NotificationItem
            notification={item}
            onMenuPress={handleMenuPress}
            onNavigationRequest={handleNavigationRequest}
          />
        )}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          tw`pb-4 flex-grow`,
          !isWeb && { paddingBottom: 20 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={tw`flex-1 items-center justify-center`}>
            <AppText variant="gray" size="large">
              {t('notifications.noNotifications')}
            </AppText>
          </View>
        }
      />
    )
  }

  return (
    <View
      ref={rootViewRef}
      style={[
        tw`flex-1`,
        { backgroundColor: colors.background },
        isWeb && ({ maxHeight: '88vh', overflowY: 'auto' } as any),
      ]}
    >
      {/* Debug mode toggle - only visible in development */}
      {DEBUG_MODE && SHOW_DEBUG_PUSH_NOTIFICATIONS && (
        <View
          style={[
            tw`p-4 border-b`,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
        >
          <TouchableOpacity
            onPress={() => setShowPushDemo(true)}
            style={[
              tw`px-4 py-2 rounded items-center`,
              { backgroundColor: colors.primary },
            ]}
          >
            <AppText style={{ color: colors.background }} fontWeight="medium">
              🧪 Test Push Notifications
            </AppText>
          </TouchableOpacity>
        </View>
      )}
      {isWeb && notifications.length > 0 && (
        <View
          style={[
            tw`flex-row justify-end px-4 py-2 border-b`,
            { borderColor: colors.border },
          ]}
        >
          <TouchableOpacity
            onPress={() => markAllAsRead()}
            disabled={isMarkingAllRead}
            style={[tw`opacity-${isMarkingAllRead ? '50' : '100'}`, tw`mr-4`]}
          >
            <AppText
              style={{ color: colors.primary }}
              size="small"
              fontWeight="semibold"
            >
              {t('notifications.clearAll', 'Clear All')}
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => bulkDeleteNotifications()}
            disabled={isClearingAll}
            style={tw`opacity-${isClearingAll ? '50' : '100'}`}
          >
            <AppText
              style={{ color: colors.error }}
              size="small"
              fontWeight="semibold"
            >
              {t('notifications.deleteAll', 'Delete All')}
            </AppText>
          </TouchableOpacity>
        </View>
      )}
      {showHeader && !isWeb && (
        <Header
          title={t('home.sidebar.menuItems.notifications')}
          showBackButton={true}
          showSidebarIcon={true}
          onBackPress={handleBack}
          rightIcon={true}
          rightComponent={
            notifications.length > 0 ? renderNotificationActions() : null
          }
        />
      )}

      {renderContent()}

      {showMenu && (
        <>
          <Pressable
            style={tw`absolute inset-0 z-40 bg-transparent`}
            onPress={() => setShowMenu(false)}
          />
          <GroupMenu
            items={[
              {
                label: t('notifications.delete'),
                icon: <TrashIcon color={colors.error} />,
                onPress: handleDelete,
                isDanger: true,
              },
            ]}
            onClose={() => setShowMenu(false)}
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              right: menuPosition.right,
              width: 180,
            }}
          />
        </>
      )}

      {isWeb && modalState.visible && modalState.postId && (
        <PostDetailsModal
          title={
            modalState.type === 'comments'
              ? t('home.comments.title')
              : modalState.notificationType === 'ANNOUNCEMENT'
                ? t('home.announcement.title', 'Announcement Details')
                : t('home.postDetail.title')
          }
          onClose={() =>
            setModalState({ visible: false, type: null, postId: null })
          }
        >
          {modalState.type === 'comments' ? (
            <CommentsScreen postId={modalState.postId} showHeader={false} />
          ) : (
            <PostDetailScreen postId={modalState.postId} showHeader={false} />
          )}
        </PostDetailsModal>
      )}
      <ConfirmationModal
        visible={isDeleteAllModalVisible}
        onClose={() => setIsDeleteAllModalVisible(false)}
        onConfirm={() => {
          setIsDeleteAllModalVisible(false)
          bulkDeleteNotifications()
        }}
        title={t(
          'notifications.deleteAllConfirmTitle',
          'Delete All Notifications',
        )}
        description={t(
          'notifications.deleteAllConfirmMessage',
          'Are you sure you want to delete all notifications? This action cannot be undone.',
        )}
        confirmText={t('notifications.deleteAll', 'Delete All')}
        confirmVariant="danger"
      />

      {selectedGroupId && (
        <View
          style={[
            tw`absolute inset-0 z-50`,
            { backgroundColor: colors.background },
            isWeb && { maxHeight: '88vh', overflowY: 'auto' },
          ]}
        >
          <GroupDashboardScreenV2
            id={selectedGroupId}
            onBack={() => setSelectedGroupId(null)}
          />
        </View>
      )}
    </View>
  )
}

export default NotificationScreen
