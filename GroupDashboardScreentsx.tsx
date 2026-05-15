import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  TouchableOpacity,
  ImageBackground,
  Image,
  Animated,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { tw } from 'app/utils/tw'
import { useTranslation } from 'react-i18next'
import { useDevice } from 'app/hooks/useDevice'
import { useSearchParams } from 'solito/navigation'
import { useHeaderStore } from 'app/store/useHeaderStore'
import Toast from 'react-native-toast-message'
import { Group } from '../types'
import { UserIcon, PlusIcon, MoreIcon } from '../assets'
import { TrashIcon } from 'app/assets'
import moment from 'moment'
import { generateRandomCode } from './utils'
import { GroupFeed } from './components/GroupFeed'
import { AppStatusBar, AppText, ConfirmationModal } from 'app/components'
import ArrowLeft from 'app/assets/ArrowLeft'
import { GroupChannelsModal } from '../components/GroupChannelsModal'
import { SubgroupsModal } from '../components/SubgroupsModal'
import { useThemeStore } from 'app/store/useThemeStore'
import { UserRole } from 'app/api/auth/auth.types'
import { useAuth } from 'app/store/auth.store'
import {
  useGetGroupById,
  useSendJoinRequest,
  useLeaveGroup,
  useCopyGroup,
  useDeleteGroup,
} from 'app/api/group/group.hooks'
import { useQuickLink } from 'app/api/post/post.hooks'
import { useCrossPlatformNavigation } from 'app/hooks/useCrossPlatformNavigation'
import { useBackHandler } from 'app/hooks/useBackHandler'
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'
import GroupMenu from '../components/GroupMenu'
import {
  getGroupMenuItems,
  getGroupOptionsMenuItems,
  getUserRoleMenuItems,
  GROUP_MENU_ACTIONS,
  GroupMenuActionId,
} from '../dashboard/utils/utils'
import { ChatIcon } from '../assets/ChatIcon'
import { useGroupPermissions } from 'app/api/group/group.permissions'
import { RestrictedAccessView } from '../components/RestrictedAccessView'

import { ChevronRight } from '../../assets'
import { FullScreenImageViewer } from 'app/components/FullScreenImageViewer'
import ChannelLinkScreen from '../channel-link/ChannelLinkScreen'
import { PostDetailsModal } from '../../newsfeed/components/PostDetailsModal'
import { CreateSurveyScreen } from '../create-survey/CreateSurveyScreen'
import { CreatePostScreen } from '../create-post/CreatePostScreen'
import { ManageSurveysScreen } from '../manage-surveys/ManageSurveysScreen'
import { AddSponserScreen } from '../add-sponser/AddSponserScreen'

const AnimatedImageBackground =
  Animated.createAnimatedComponent(ImageBackground)
const HEADER_MAX_HEIGHT = 256
// Removed static HEADER_MIN_HEIGHT and SCROLL_DISTANCE

interface GroupDashboardScreenProps {
  id?: string | number
  group?: Group
  onBack?: () => void
  onMembersPress?: () => void
  onGroupPress?: (group: Group) => void
  onCreateGroup?: (params: { groupId?: string; parentGroupId?: string }) => void
}

// Removed TABS constant
// Removed STICKY_SCROLL_Y_OFFSET adjustment for tab bar
const STICKY_SCROLL_Y_OFFSET = 0

export function GroupDashboardScreenV2({
  id: propId,
  onBack,
  onGroupPress,
  onCreateGroup,
}: Readonly<GroupDashboardScreenProps>) {
  const { t } = useTranslation()
  const { navigateTo, pushTo } = useCrossPlatformNavigation()
  const insets = useSafeAreaInsets()
  const params = useSearchParams()
  const groupIdFromUrl = params?.get('id')
  const groupId = Number(propId || groupIdFromUrl || 0)
  const { data: fetchedGroup, isLoading, error } = useGetGroupById(groupId)
  const group = fetchedGroup

  const permissions = useGroupPermissions((group || {}) as Group)
  const { info } = useAuth()
  const { mutate: deleteGroup, isPending: isDeleting } = useDeleteGroup()

  // Check if user is superadmin
  const isSuperAdmin = info?.role === UserRole.SUPER_ADMIN

  // Handle members press navigation
  const handleMembersPress = () => {
    navigateTo(
      `/group-members?groupId=${groupId}&is_school=${group?.is_school || false}`,
    )
  }

  // Dynamic header constants based on insets
  const BASE_HEADER_HEIGHT = 60
  const HEADER_MIN_HEIGHT = BASE_HEADER_HEIGHT + insets.top
  const [headerMaxHeight, setHeaderMaxHeight] = useState(HEADER_MAX_HEIGHT)
  const SCROLL_DISTANCE = headerMaxHeight - HEADER_MIN_HEIGHT

  const onHeaderLayout = useCallback(
    (event: any) => {
      const { height } = event.nativeEvent.layout
      const calculatedHeight = Math.max(
        HEADER_MAX_HEIGHT,
        height + HEADER_MIN_HEIGHT + 20,
      )
      if (
        calculatedHeight > 0 &&
        Math.abs(calculatedHeight - headerMaxHeight) > 1
      ) {
        setHeaderMaxHeight(calculatedHeight)
      }
    },
    [headerMaxHeight, HEADER_MIN_HEIGHT],
  )

  // Removed activeTab state
  const [showChannelsModal, setShowChannelsModal] = useState(false)
  const [showMoreModal, setShowMoreModal] = useState(false)
  const [showTileModal, setShowTileModal] = useState<boolean>(false)
  const [showSurveyModal, setShowSurveyModal] = useState<boolean>(false)
  const [showManageSurveysModal, setShowManageSurveysModal] =
    useState<boolean>(false)
  const [showSponsor, setShowSponsor] = useState<boolean>(false)
  const [showPostModal, setShowPostModal] = useState<boolean>(false)
  const [showTopOptionsModal, setShowTopOptionsModal] = useState(false)
  const [showLeaveGroupModal, setShowLeaveGroupModal] = useState(false)
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false)
  const [showSubgroupsModal, setShowSubgroupsModal] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isAnnouncementModal, setIsAnnouncementModal] = useState<boolean>(false)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    right?: number
    left?: number
  }>({ top: 0, right: 30 })
  const { colors } = useThemeStore()
  const { closeAllMenusToken } = useHeaderStore()
  const { mutate: sendJoinRequest, isPending: isJoining } = useSendJoinRequest()
  const { mutate: leaveGroup, isPending: isLeaving } = useLeaveGroup()
  const { mutate: copyGroup } = useCopyGroup()
  const { mutate: toggleQuickLink } = useQuickLink()
  const scrollY = useRef(new Animated.Value(0)).current
  const flatListRef = useRef<any>(null)
  const moreIconRef = useRef<View>(null)
  const topOptionsRef = useRef<View>(null)
  const rootViewRef = useRef<View>(null)
  const { router, goBack: navGoBack } = useCrossPlatformNavigation()
  const canViewGroup = permissions.canViewDetails || group?.is_admin

  const { height } = useWindowDimensions()
  const { isWeb } = useDevice()
  const handleBack = React.useCallback(() => {
    if (onBack) {
      onBack()
    } else {
      navGoBack()
    }
  }, [onBack, navGoBack])
  const onChannelsPress = React.useCallback(() => {
    setShowChannelsModal(true)
  }, [])

  const onChatPress = React.useCallback(() => {
    if (!group?.chat_id) return
    router.push(
      `/chat-screen?userId=${group.chat_id}&userName=${encodeURIComponent(group.title || '')}&userAvatar=${encodeURIComponent(group.profile_photo || '')}&groupType=Group&isOfficialGroup=true`,
    )
  }, [router, group?.chat_id, group?.title, group?.profile_photo])

  const onMorePress = React.useCallback(() => {
    if (isWeb) {
      // Web: Measure relative to root view
      moreIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        rootViewRef.current?.measure(
          (rootX, rootY, rootWidth, rootHeight, rootPageX, rootPageY) => {
            setMenuPosition({
              top: pageY - rootPageY + height + 5,
              right: undefined,
              left: pageX - rootPageX + width - 220,
            })
            setShowMoreModal(true)
          },
        )
      })
    } else {
      // Native: Use measureInWindow
      moreIconRef.current?.measureInWindow((x, y, width, height) => {
        setMenuPosition({
          top: y + height + 5,
          right: 100,
        })
        setShowMoreModal(true)
      })
    }
  }, [isWeb])

  const closeMenu = React.useCallback(() => {
    setShowMoreModal(false)
    setShowTopOptionsModal(false)
  }, [])

  const onTopOptionsPress = React.useCallback(() => {
    if (isWeb) {
      // Web: Measure relative to root view
      topOptionsRef.current?.measure((x, y, width, height, pageX, pageY) => {
        rootViewRef.current?.measure(
          (rootX, rootY, rootWidth, rootHeight, rootPageX, rootPageY) => {
            setMenuPosition({
              top: pageY - rootPageY + height + 5,
              right: 20,
              left: pageX - rootPageX + width - 220,
            })
            setShowTopOptionsModal(true)
          },
        )
      })
    } else {
      // Native: Use measureInWindow
      topOptionsRef.current?.measureInWindow((x, y, width, height) => {
        setMenuPosition({
          top: y + height + 5,
          right: 20,
        })
        setShowTopOptionsModal(true)
      })
    }
  }, [isWeb])

  const handleMenuAction = React.useCallback(
    (actionId: GroupMenuActionId) => {
      closeMenu()
      if (!group) return

      switch (actionId) {
        case GROUP_MENU_ACTIONS.SEND_ANNOUNCEMENT:
          if (isWeb) {
            setIsAnnouncementModal(true)
            setShowPostModal(true)
            globalThis.scrollTo({ top: 0, behavior: 'smooth' })
            return
          }
          router.push(
            `/create-post?groupId=${group.id}&groupName=${encodeURIComponent(group.title)}&isAnnouncement=true`,
          )
          break
        case GROUP_MENU_ACTIONS.CREATE_SUB_GROUP:
          if (onCreateGroup) {
            onCreateGroup({ parentGroupId: String(group.id) })
            return
          }
          if (isWeb) {
            router.push(`/create-subgroup?parentGroupId=${group.id}`)
          } else {
            router.push(`/create-group?parentGroupId=${group.id}`)
          }
          break
        case GROUP_MENU_ACTIONS.CREATE_EVENT:
          router.push(`/create-event?groupId=${group.id}`)
          break
        case GROUP_MENU_ACTIONS.VIEW_RESOURCE_LIBRARY:
          router.push(`/view-resource-library?groupId=${group.id}`)
          break
        case GROUP_MENU_ACTIONS.EDIT_GROUP:
          if (onCreateGroup) {
            onCreateGroup({ groupId: String(group.id) })
            return
          }
          router.push(`/create-group?groupId=${group.id}`)
          break
        case GROUP_MENU_ACTIONS.COPY_GROUP: {
          const suffix = moment().format('DD-MMMM-HH-mm-ss')
          const newTitle = `${group.title} (${suffix})`

          const randomCode = generateRandomCode(8)
          copyGroup(
            {
              groupId: group.id,
              data: {
                title: newTitle,
                group_code: randomCode,
              },
            },
            {
              onSuccess: (res) => {
                Toast.show({
                  type: 'success',
                  text1: res.message || 'Group copied successfully',
                })
                if (res.data?.id) {
                  // navigate to back screen
                  handleBack()
                }
              },
              onError: (error) => {
                Toast.show({
                  type: 'error',
                  text1: t('common.error'),
                  text2: error.message || 'Failed to copy group',
                })
              },
            },
          )
          break
        }
        case GROUP_MENU_ACTIONS.SEARCH_GROUP:
          console.log('Action: Search Group')
          break
        case GROUP_MENU_ACTIONS.ADD_QUICK_LINK:
          toggleQuickLink(
            {
              target_id: group.id,
              type: 'GROUP',
              is_pinned: !(group?.quick_links || group?.is_pinned),
            },
            {
              onSuccess: (response) => {
                Toast.show({
                  type: 'success',
                  text1:
                    response.message ||
                    (group?.quick_links || group?.is_pinned
                      ? t(
                        'home.groups.dashboard.successMessage.unpinned',
                        'Quick link removed successfully',
                      )
                      : t(
                        'home.groups.dashboard.successMessage.pinned',
                        'Quick link added successfully',
                      )),
                })
              },
            },
          )
          break
        case GROUP_MENU_ACTIONS.CREATE_POST:
          console.log('Action: Create Post')
          break
        case GROUP_MENU_ACTIONS.CREATE_LINK_TILE:
          if (isWeb) {
            setShowTileModal(true)
            globalThis.scrollTo({ top: 0, behavior: 'smooth' })
          } else {
            router.push(
              `/create-channel-link?groupId=${group.id}&groupName=${encodeURIComponent(group.title || '')}`,
            )
          }
          break
        case GROUP_MENU_ACTIONS.LEAVE_GROUP:
          setShowLeaveGroupModal(true)
          break
        case GROUP_MENU_ACTIONS.MANAGE_SURVEY:
          if (isWeb) {
            setShowManageSurveysModal(true)
          } else {
            router.push(
              `/manage-surveys?groupId=${group.id}&groupName=${encodeURIComponent(group.title || '')}&groupLogo=${encodeURIComponent(group.profile_photo || '')}`,
            )
          }
          break
        case GROUP_MENU_ACTIONS.ADD_SURVEY:
          if (isWeb) setShowSurveyModal(true)
          else router.push(`/create-survey?groupId=${group.id}`)
          break
        case GROUP_MENU_ACTIONS.ADD_SPONSER:
          if (isWeb) {
            setShowSponsor(true)
            return
          } else router.push(`/add-sponser?groupId=${group.id}`)
          break
        case GROUP_MENU_ACTIONS.DELETE_GROUP:
          setShowDeleteConfirmation(true)
          break
        default:
          break
      }
    },
    [
      closeMenu,
      router,
      group?.id,
      group?.title,
      group?.quick_links,
      group?.is_pinned,
      group?.profile_photo,
      t,
      toggleQuickLink,
    ],
  )

  const handleConfirmLeave = React.useCallback(() => {
    if (!group?.id) return
    leaveGroup(group.id, {
      onSuccess: () => {
        setShowLeaveGroupModal(false)
        Toast.show({
          type: 'success',
          text1: t(
            'home.groups.dashboard.successMessage.leftGroup',
            'You have left the group successfully',
          ),
        })
        router.push('/groups')
      },
      onError: (error) => {
        setShowLeaveGroupModal(false)
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: error.message || t('common.errorMessage'),
        })
      },
    })
  }, [group?.id, leaveGroup, router, t])

  const handleConfirmDelete = React.useCallback(() => {
    if (!group?.id) return
    deleteGroup(group.id, {
      onSuccess: (res) => {
        setShowDeleteConfirmation(false)
        Toast.show({
          type: 'success',
          text1: t(
            'home.groups.dashboard.successMessage.deletedGroup',
            'Group deleted successfully',
          ),
        })
        handleBack()
        router.push('/groups')
      },
      onError: (error) => {
        setShowDeleteConfirmation(false)
        Toast.show({
          type: 'error',
          text1: t('common.error'),
          text2: error.message || t('common.errorMessage'),
        })
      },
    })
  }, [group?.id, deleteGroup, router, t])

  const handleJoinRequest = React.useCallback(() => {
    if (!group) return
    const isInvited = group.status?.toLowerCase() === 'invited'
    const status = isInvited ? 'ACCEPTED' : 'REQUESTED'

    sendJoinRequest(
      { groupId: group.id, status },
      {
        onSuccess: (response) => {
          Toast.show({
            type: 'success',
            text1: response.message || 'Join request sent successfully',
          })
        },
      },
    )
  }, [sendJoinRequest, group?.id, group?.status, t])

  // Removed useEffect for activeTab switching scroll maintenance

  const [statusBarVariant, setStatusBarVariant] = useState<'light' | 'dark'>(
    'light',
  )

  const handleHardwareBackPress = useCallback(() => {
    if (showMoreModal) {
      setShowMoreModal(false)
      return true
    }
    if (showTopOptionsModal) {
      setShowTopOptionsModal(false)
      return true
    }
    if (showLeaveGroupModal) {
      setShowLeaveGroupModal(false)
      return true
    }
    if (showDeleteConfirmation) {
      setShowDeleteConfirmation(false)
      return true
    }

    // If native Modals are open, let them handle the back press
    if (showChannelsModal || selectedImage) {
      return false
    }

    if (onBack) {
      onBack()
      return true
    }
    handleBack()
    return true
  }, [
    showMoreModal,
    showTopOptionsModal,
    showChannelsModal,
    selectedImage,
    onBack,
    handleBack,
    showLeaveGroupModal,
    showDeleteConfirmation,
  ])

  useBackHandler(handleHardwareBackPress)

  React.useEffect(() => {
    const listenerId = scrollY.addListener(({ value }) => {
      const threshold = SCROLL_DISTANCE - 20
      const newVariant = value > threshold ? 'dark' : 'light'
      setStatusBarVariant((prev) => (prev === newVariant ? prev : newVariant))
    })
    return () => {
      scrollY.removeListener(listenerId)
    }
  }, [scrollY, SCROLL_DISTANCE])

  React.useEffect(() => {
    if (closeAllMenusToken > 0) {
      closeMenu()
    }
  }, [closeAllMenusToken, closeMenu])

  // Memoize animation interpolations
  const animations = React.useMemo(
    () => ({
      headerTranslateY: scrollY.interpolate({
        inputRange: [0, SCROLL_DISTANCE],
        outputRange: [0, -SCROLL_DISTANCE],
        extrapolate: 'clamp',
      }),
      headerContentOpacity: scrollY.interpolate({
        inputRange: [0, SCROLL_DISTANCE / 2],
        outputRange: [1, 0],
        extrapolate: 'clamp',
      }),
      headerBackgroundOpacity: scrollY.interpolate({
        inputRange: [0, SCROLL_DISTANCE / 2, SCROLL_DISTANCE],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
      }),
      headerForegroundOpacity: scrollY.interpolate({
        inputRange: [0, SCROLL_DISTANCE / 2, SCROLL_DISTANCE],
        outputRange: [1, 1, 0],
        extrapolate: 'clamp',
      }),
      // Removed stickyTabOpacity
    }),
    [scrollY, SCROLL_DISTANCE],
  )

  // Memoize callbacks
  const handleScroll = React.useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: () => {
          if (isWeb && (showMoreModal || showTopOptionsModal)) {
            // Optimistic close on scroll for Web
            closeMenu()
          }
        },
      }),
    [scrollY, isWeb, showMoreModal, showTopOptionsModal, closeMenu],
  )

  // modal functions (e.g surveys ,tiles)
  const closePostModal = () => setShowPostModal(false)
  const closeTileModal = () => setShowTileModal(false)
  const closeSurveyModal = () => setShowSurveyModal(false)
  // Removed renderTabBar

  const renderFeedHeader = React.useCallback(
    () => (
      <View
        style={
          isWeb
            ? { zIndex: showMoreModal ? 100 : 0 }
            : { backgroundColor: colors.background }
        }
      >
        {/* Action Row */}
        <View
          style={[
            tw`flex-row items-center justify-between px-4 py-4`,
            !isWeb && tw`border-b`,
            { borderColor: colors.border },
          ]}
        >
          <View style={tw`flex-row items-center gap-3`}>
            <TouchableOpacity
              style={[
                tw`flex-row items-center px-4 py-2 rounded-full gap-2`,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleMembersPress}
              testID="members-button"
            >
              <UserIcon color="white" />
              <AppText variant="white" fontWeight="semibold">
                {group?.total_members} {group?.is_admin ? '' : 'Members'}
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onChannelsPress}
              style={[
                tw`flex-row items-center justify-center px-4 py-2 rounded-full gap-2 flex-1`,
                { backgroundColor: colors.primary },
              ]}
            >
              <View
                style={tw`h-5 w-5 bg-white rounded-full items-center justify-center pl-.5`}
              >
                <ChevronRight size={10} color={colors.primary} />
              </View>
              <AppText variant="white" fontWeight="semibold">
                {group?.total_channels || 0}{' '}
                {t('home.groups.dashboard.channels')}
              </AppText>
            </TouchableOpacity>
            {group?.is_admin && (
              <TouchableOpacity
                ref={moreIconRef}
                style={[
                  tw`w-10 h-10 rounded-full items-center justify-center`,
                  { backgroundColor: colors.primary },
                ]}
                onPress={onMorePress}
              >
                <PlusIcon />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                tw`w-10 h-10 rounded-full items-center justify-center`,
                { backgroundColor: colors.primary },
                (!group?.chat_id || !group?.is_chat_enabled) && tw`opacity-50`,
              ]}
              onPress={onChatPress}
              disabled={!group?.chat_id || !group?.is_chat_enabled}
            >
              <ChatIcon />
            </TouchableOpacity>
          </View>
        </View>

        {/* Removed Tab Bar Call */}
      </View>
    ),
    [
      t,
      handleMembersPress,
      onChannelsPress,
      onMorePress,
      onChatPress,
      group,
      colors,
      isWeb,
      showMoreModal,
    ],
  )

  const commonProps = React.useMemo(
    () => ({
      ref: flatListRef,
      onScroll: handleScroll,
      onScrollBeginDrag: () => {
        if (isWeb) closeMenu()
      },
      contentContainerStyle: {
        paddingTop: headerMaxHeight,
        paddingBottom: insets.bottom,
      }, // Removed -20 adjustment as sticky tab bar is gone
      ListHeaderComponent: renderFeedHeader(),
    }),
    [handleScroll, renderFeedHeader, isWeb, closeMenu, insets.bottom],
  )

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <View
          style={[
            tw`flex-1 items-center justify-center`,
            {
              paddingTop: headerMaxHeight,
              backgroundColor: colors.background,
            },
          ]}
        >
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )
    }

    if (error) {
      const errorMessage = error.message.includes('400')
        ? 'The group has been deleted.'
        : error.message

      return (
        <View
          style={[
            tw`flex-1 items-center justify-center px-6`,
            {
              paddingTop: headerMaxHeight,
              backgroundColor: colors.background,
            },
          ]}
        >
          <AppText
            variant="gray1"
            size="large"
            style={tw`text-center mb-4`}
            fontWeight="medium"
          >
            {errorMessage}
          </AppText>
          <TouchableOpacity
            onPress={handleBack}
            style={[
              tw`px-6 py-3 rounded-full`,
              { backgroundColor: colors.primary },
            ]}
          >
            <AppText variant="white" fontWeight="semibold">
              {t('common.goBack', 'Go Back')}
            </AppText>
          </TouchableOpacity>
        </View>
      )
    }

    if (canViewGroup && group) {
      return (
        <GroupFeed
          group={group}
          groupId={String(group.id)}
          onGroupPress={onGroupPress}
          {...commonProps}
        />
      )
    }

    return (
      <Animated.ScrollView
        {...commonProps}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: headerMaxHeight,
          paddingBottom: insets.bottom,
          flexGrow: 1,
        }}
        style={tw`flex-1`}
      >
        <View
          style={[
            tw`flex-1`,
            isWeb && tw`mt-4 p-5`,
            { backgroundColor: colors.background },
          ]}
        >
          <RestrictedAccessView
            status={group?.status}
            onRequestAccess={handleJoinRequest}
            isLoading={isJoining}
          />
        </View>
      </Animated.ScrollView>
    )
  }

  return (
    <View
      ref={rootViewRef}
      style={[
        tw`flex-1`,
        !isWeb && { backgroundColor: colors.background },
        isWeb && {
          maxHeight: height * 0.88,
          overflowY: 'scroll',
        },
      ]}
    >
      {/* Header Background - Absolute & Animated */}
      {/* Main Content (ScrollView) - Rendered FIRST so Background sits on top for interactions */}
      {renderMainContent()}

      {/* Header Background - Absolute & Animated (Now rendered AFTER to capture touches) */}
      <AppStatusBar variant={statusBarVariant} />
      <Animated.View
        pointerEvents="box-none"
        style={[
          tw`absolute top-0 left-0 right-0 z-0 justify-end`,
          {
            minHeight: headerMaxHeight,
            transform: [{ translateY: animations.headerTranslateY }],
          },
          isWeb && { borderRadius: 20, overflow: 'hidden' },
        ]}
      >
        <ImageBackground
          source={{
            uri: group?.cover_photo,
          }}
          style={[
            {
              flex: 1,
              justifyContent: 'flex-end',
            },
            !group?.cover_photo && { backgroundColor: '#374151' },
          ]}
        >
          <TouchableOpacity
            style={tw`absolute inset-0`}
            onPress={() => setSelectedImage(group?.cover_photo || null)}
            activeOpacity={1}
          />
          {/* Gradient Shadow */}
          <View
            style={tw`absolute bottom-0 left-0 right-0 h-40 pointer-events-none`}
          >
            <Svg height="100%" width="100%">
              <Defs>
                <LinearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <Stop offset="0" stopColor="transparent" stopOpacity="0" />
                  <Stop offset="1" stopColor="black" stopOpacity="0.8" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
            </Svg>
          </View>

          {/* Group Details Overlay - Fades Out */}
          <Animated.View
            onLayout={onHeaderLayout}
            style={[
              tw`px-4 pb-4`,
              { opacity: animations.headerContentOpacity },
            ]}
            pointerEvents="box-none"
          >
            <View style={tw`flex-row items-center`}>
              <View
                style={[
                  tw`${isWeb ? 'w-20 h-20 border border-white' : 'w-16 h-16'} rounded-xl items-center justify-center mr-3 shadow-lg overflow-hidden`,
                  { backgroundColor: group?.profile_photo ? 'transparent' : colors.primary },
                ]}
              >
                {group?.profile_photo ? (
                  <TouchableOpacity
                    onPress={() =>
                      setSelectedImage(group.profile_photo || null)
                    }
                  >
                    <Image
                      source={{ uri: group.profile_photo }}
                      style={tw`${isWeb ? 'w-20 h-20 border border-white' : 'w-16 h-16'}`}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : (
                  <AppText variant="white" fontWeight="bold" size="2xl">
                    {group?.title?.charAt(0)?.toUpperCase()}
                  </AppText>
                )}
              </View>
              <View style={tw`flex-1 gap-0.5`}>
                <AppText
                  variant="white"
                  fontWeight="bold"
                  size="xl"
                  numberOfLines={2}
                >
                  {group?.title}
                </AppText>
                {group?.parent_group?.title && (
                  <View style={tw`flex-row items-center flex-wrap`}>
                    <AppText variant="white" size="xs">
                      {t('home.groups.dashboard.inParentGroup')}
                    </AppText>
                    <TouchableOpacity
                      onPress={() => {
                        if (group?.parent_group?.id) {
                          if (onGroupPress) {
                            onGroupPress(group.parent_group as Group)
                          } else {
                            pushTo(
                              `/group-dashboard-v2?id=${group.parent_group.id}`,
                            )
                          }
                        }
                      }}
                    >
                      <AppText
                        variant="highlight"
                        size="small"
                        fontWeight="bold"
                        style={tw`ml-1`}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {group.parent_group.title}
                      </AppText>
                    </TouchableOpacity>
                  </View>
                )}

                <AppText
                  variant="white"
                  size="xs"
                  style={tw`mt-1`}
                >
                  {group?.description}
                </AppText>

                {group?.has_sub_groups && (
                  <TouchableOpacity
                    style={[
                      tw`flex-row items-center px-3 py-1.5 rounded-full mt-2 self-start`,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => {
                      setShowSubgroupsModal(true)
                    }}
                  >
                    <AppText variant="white" size="xs" fontWeight="bold">
                      {t('home.groups.dashboard.subgroups')}
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Animated.View>
        </ImageBackground>
      </Animated.View>

      {/* Sticky Header Shield */}
      <Animated.View
        style={[
          tw`absolute top-0 left-0 right-0 z-10 shadow-sm`,
          {
            height: HEADER_MIN_HEIGHT,
            backgroundColor: colors.background,
            opacity: animations.headerBackgroundOpacity,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
        ]}
      />

      {/* Top Bar - Fixed Sibling (Sticky) */}
      <View
        style={[
          tw`absolute top-0 w-full z-20 justify-center`,
          {
            height: HEADER_MIN_HEIGHT,
            paddingTop: insets.top,
          },
        ]}
      >
        <View
          style={tw`flex-row justify-between items-center px-4 pt-2 relative`}
        >
          {isWeb ? (
            <View style={tw`w-10 h-10`} />
          ) : (
            <TouchableOpacity
              onPress={handleBack}
              style={tw`w-10 h-10 bg-black/30 rounded-full items-center justify-center relative z-20`}
            >
              {/* White Icon (Default) */}
              <Animated.View
                style={[
                  tw`absolute inset-0 items-center justify-center`,
                  { opacity: animations.headerForegroundOpacity },
                ]}
              >
                <ArrowLeft color={colors.background} />
              </Animated.View>
              {/* Dark Icon (Sticky) */}
              <Animated.View
                style={[
                  tw`absolute inset-0 items-center justify-center`,
                  { opacity: animations.headerBackgroundOpacity },
                ]}
              >
                <ArrowLeft color="black" />
              </Animated.View>
            </TouchableOpacity>
          )}

          {/* Sticky Header Title */}
          <Animated.View
            pointerEvents="none"
            style={[
              tw`absolute left-16 right-16 top-2 bottom-0 items-center justify-center z-10`,
              { opacity: animations.headerBackgroundOpacity },
            ]}
          >
            <AppText
              fontWeight="bold"
              size="large"
              variant="gray1"
              numberOfLines={1}
              style={tw`text-center`}
            >
              {group?.title || ''}
            </AppText>
          </Animated.View>

          {/* {permissions.canPost && ( */}
          {canViewGroup && (
            <View style={tw`relative z-20`}>
              <TouchableOpacity
                ref={topOptionsRef}
                style={tw`w-10 h-10 bg-black/30 rounded-full items-center justify-center relative z-20`}
                onPress={onTopOptionsPress}
              >
                {/* White Icon (Default) */}
                <Animated.View
                  style={[
                    tw`absolute inset-0 items-center justify-center`,
                    { opacity: animations.headerForegroundOpacity },
                  ]}
                >
                  <MoreIcon color="white" />
                </Animated.View>
                {/* Dark Icon (Sticky) */}
                <Animated.View
                  style={[
                    tw`absolute inset-0 items-center justify-center`,
                    { opacity: animations.headerBackgroundOpacity },
                  ]}
                >
                  <MoreIcon color="black" />
                </Animated.View>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <GroupChannelsModal
        visible={showChannelsModal}
        onClose={() => setShowChannelsModal(false)}
        group={group || ({} as Group)}
      />
      {/* Dropdown Menu for plus icon */}
      {showMoreModal && (
        <>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowMoreModal(false)}
            style={tw`absolute inset-0 z-40 bg-transparent`}
          />
          <GroupMenu
            items={getGroupMenuItems({
              t,
              colors,
              onAction: handleMenuAction,
              hasSurvey: group?.is_survey,
              isQuickLinkAdded: group?.quick_links || group?.is_pinned,
              isSuperAdmin,
            })}
            onClose={closeMenu}
            style={{
              ...menuPosition,
              zIndex: 9999,
              position: 'absolute', // Revert to absolute
            }}
          />
        </>
      )}

      {showTopOptionsModal && (
        <>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowTopOptionsModal(false)}
            style={tw`absolute inset-0 z-40 bg-transparent`}
          />
          {canViewGroup && (
            <GroupMenu
              items={
                group?.is_admin
                  ? getGroupOptionsMenuItems({
                    t,
                    colors,
                    onAction: handleMenuAction,
                    isQuickLinkAdded: group?.quick_links || group?.is_pinned,
                    isSuperAdmin,
                  })
                  : getUserRoleMenuItems({
                    t,
                    colors,
                    onAction: handleMenuAction,
                    status: group?.status,
                    isQuickLinkAdded: group?.quick_links || group?.is_pinned,
                  })
              }
              onClose={closeMenu}
              style={{
                ...menuPosition,
                zIndex: 9999,
                position: 'absolute', // Revert to absolute
              }}
            />
          )}
        </>
      )}
      <ConfirmationModal
        visible={showLeaveGroupModal}
        onClose={() => setShowLeaveGroupModal(false)}
        onConfirm={handleConfirmLeave}
        title={t('home.groups.dashboard.leaveGroupTitle', 'Leave Group')}
        description={t(
          'home.groups.dashboard.leaveGroupMessage',
          'Are you sure you want to leave this group? You will no longer be able to access its channels and posts.',
        )}
        confirmText={t('common.confirm', 'Confirm')}
        cancelText={t('common.cancel', 'Cancel')}
        isLoading={isLeaving}
        confirmVariant="danger"
        icon={<TrashIcon color={colors.error} width={32} height={32} />}
        iconContainerStyle={{ backgroundColor: '#FEF2F2' }}
      />
      <ConfirmationModal
        visible={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={handleConfirmDelete}
        title={t('home.groups.dashboard.deleteGroupTitle', 'Delete Group')}
        description={t(
          'home.groups.dashboard.deleteGroupMessage',
          'Are you sure you want to delete this group?',
        )}
        confirmText={t('common.confirm', 'Confirm')}
        cancelText={t('common.cancel', 'Cancel')}
        isLoading={isDeleting}
        confirmVariant="danger"
        icon={<TrashIcon color={colors.error} width={32} height={32} />}
        iconContainerStyle={{ backgroundColor: '#FEF2F2' }}
      />

      <FullScreenImageViewer
        visible={!!selectedImage}
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
      {showPostModal && (
        <PostDetailsModal
          title={isAnnouncementModal ? 'Send Announcement' : 'Create Post'}
          onClose={closePostModal}
        >
          <CreatePostScreen
            setShowPostModal={setShowPostModal}
            hideHeader
            route={{
              params: {
                channelId: '',
                channelName: '',
                groupName: '',
                groupId: String(groupIdFromUrl),
                isAnnouncement: isAnnouncementModal ? 'true' : 'false',
              },
            }}
          />
        </PostDetailsModal>
      )}
      {showTileModal && (
        <PostDetailsModal title="Create Link Tile" onClose={closeTileModal}>
          <ChannelLinkScreen id={groupId} onSuccess={closeTileModal} />
        </PostDetailsModal>
      )}
      {showSurveyModal && (
        <PostDetailsModal title="Create Survey" onClose={closeSurveyModal}>
          <CreateSurveyScreen groupId={groupId} onSuccess={closeSurveyModal} />
        </PostDetailsModal>
      )}
      {showManageSurveysModal && (
        <PostDetailsModal
          title={t('home.groups.dashboard.manageSurveys.title')}
          onClose={() => setShowManageSurveysModal(false)}
        >
          <ManageSurveysScreen
            route={{
              params: {
                groupId: groupId,
              },
            }}
            showHeader={false}
          />
        </PostDetailsModal>
      )}
      {showSponsor && (
        <PostDetailsModal
          title="Add Sponsors"
          onClose={() => setShowSponsor(false)}
        >
          <AddSponserScreen
            groupId={groupId}
            onClose={() => setShowSponsor(false)}
          />
        </PostDetailsModal>
      )}
      <SubgroupsModal
        visible={showSubgroupsModal}
        onClose={() => setShowSubgroupsModal(false)}
        groupId={groupId}
        onGroupPress={onGroupPress}
      />
    </View>
  )
}
