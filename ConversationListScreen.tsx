'use client'
import React, { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import {
  AppText,
  HStack,
  SearchBar,
  UserImage,
  AppLoader,
} from 'app/components'
import { tw } from 'app/utils/tw'
import Svg, { Path } from 'react-native-svg'
import SearchIcon from 'app/assets/SearchIcon'
import { useCrossPlatformNavigation } from 'app/hooks/useCrossPlatformNavigation'
import { useDebounce } from 'app/hooks/useDebounce'
import { useDevice } from 'app/hooks/useDevice'
import { useSearchParams } from 'solito/navigation'

import { useChat, Conversation } from 'app/provider/chat'
import { useAuth } from 'app/store/auth.store'
import { useUserProfileStore } from 'app/store/useUserProfileStore'
import { UserDetails } from 'app/types'
import { useThemeStore } from 'app/store/useThemeStore'
import { useHeaderStore } from 'app/store/useHeaderStore'
import GroupMenu, {
  MenuItem,
} from 'app/features/home/groups/components/GroupMenu'
import { TrashIcon, Eye as EyeIcon } from 'app/assets'
import { MuteIcon } from './assets'
import {
  useDeleteChat,
  useLeaveGroupChat,
  useMuteChat,
  useUnmuteChat,
} from 'app/api/chat/chat.hooks'
import { LeaveIcon } from 'app/assets/LeaveIcon'
import { formatLastMessage } from 'app/utils/formatLastMessage'
import CheckCircle from 'app/assets/CheckCircle'
import { PostDetailsModal } from 'app/features/home/newsfeed/components/PostDetailsModal'
import { NewConversationScreen } from './NewConversationScreen'
import { ThreeDotIcon } from '../assets'

// Helper function to get responsive maxHeight multiplier based on screen size
const getResponsiveMaxHeight = (height: number): number => {
  if (height < 600) return 0.45 // Small screens (phones)
  if (height < 700) return 0.68 // Small screens (phones)
  if (height < 900) return 0.72 // Medium screens (tablets)
  if (height < 950) return 0.75 // Large screens (tablets)
  return 0.8 // Large screens (desktop)
}

// interface Message removed in favor of Conversation from context

const UnreadDot = ({ count }: { count?: number }) => {
  const { colors } = useThemeStore()
  if (!count || count <= 0) return null
  return (
    <View
      style={[
        tw`w-5 h-5 rounded-full items-center justify-center`,
        { backgroundColor: colors.primary },
      ]}
    >
      <AppText color="white" size="xs" fontWeight="bold">
        {count}
      </AppText>
    </View>
  )
}

const FloatingActionButton = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useThemeStore()
  return (
    <TouchableOpacity
      style={[
        tw`absolute bottom-6 right-6 rounded-full w-14 h-14 items-center justify-center shadow-lg`,
        { backgroundColor: colors.primary },
      ]}
      onPress={onPress}
    >
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <Path
          d="M12 5v14M5 12h14"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>
    </TouchableOpacity>
  )
}

const useConversationMenuItems = ({
  isManagement,
  selectedConversation,
  isOfficialGroup,
  isWeb,
  isDeleting,
  isLeaving,
  isMuting,
  isUnmuting,
  colors,
  t,
  handleMessagePress,
  handleMute,
  handleDelete,
  handleLeaveGroup,
}: {
  isManagement?: boolean
  selectedConversation: Conversation | null
  isOfficialGroup: boolean
  isWeb: boolean
  isDeleting: boolean
  isLeaving: boolean
  isMuting: boolean
  isUnmuting: boolean
  colors: any
  t: any
  handleMessagePress: (conversation: Conversation) => void
  handleMute: () => void
  handleDelete: () => void
  handleLeaveGroup: () => void
}) => {
  const getMuteLabel = () => {
    if (selectedConversation?.is_muted) {
      return isUnmuting
        ? t('home.chat.unmutingChat') || 'Unmuting...'
        : t('home.chat.unmuteChat') || 'Unmute Chat'
    } else {
      return isMuting
        ? t('home.chat.mutingChat') || 'Muting...'
        : t('home.chat.muteChat') || 'Mute Chat'
    }
  }

  const getBaseMenuItems = () => {
    if (isManagement) {
      return [
        {
          label: t('home.chat.viewConversation') || 'View Conversation',
          icon: (
            <EyeIcon width={18} height={18} color={colors.text.secondary} />
          ),
          onPress: () => {
            if (selectedConversation) {
              handleMessagePress(selectedConversation)
            }
          },
        },
      ]
    }

    return [
      {
        label: getMuteLabel(),
        icon: <MuteIcon width={18} height={18} color={colors.text.secondary} />,
        onPress: handleMute,
        disabled: isMuting || isUnmuting,
        loading: isMuting || isUnmuting,
        closeOnPress: false,
      },
    ]
  }

  const getAdditionalMenuItems = () => {
    const items: MenuItem[] = []

    if (isManagement) return items

    const canDelete = !isOfficialGroup && (!isWeb || __DEV__)
    if (canDelete) {
      items.push({
        label: isDeleting
          ? t('home.chat.deletingChat') || 'Deleting...'
          : t('home.chat.deleteChat'),
        icon: (
          <TrashIcon width={18} height={18} color={colors.text.secondary} />
        ),
        onPress: handleDelete,
        disabled: isDeleting,
        loading: isDeleting,
        closeOnPress: false,
      })
    }

    const canLeaveGroup =
      selectedConversation?.groupType === 'Group' && !isOfficialGroup
    if (canLeaveGroup) {
      items.push({
        label: isLeaving
          ? t('home.chat.leavingGroup') || 'Leaving...'
          : t('home.chat.leaveGroup') || 'Leave Group',
        icon: <LeaveIcon width={18} height={18} color={colors.error} />,
        onPress: handleLeaveGroup,
        disabled: isLeaving,
        loading: isLeaving,
        closeOnPress: false,
      })
    }

    return items
  }

  return [...getBaseMenuItems(), ...getAdditionalMenuItems()]
}

const SearchHeader = ({
  isWeb,
  localSearchQuery,
  isLoading,
  colors,
  t,
  setLocalSearchQuery,
}: {
  isWeb: boolean
  localSearchQuery: string
  isLoading: boolean
  colors: any
  t: any
  setLocalSearchQuery: (query: string) => void
}) => {
  if (isWeb) {
    return <></>
  }

  return (
    <SearchBar
      leftIcon={
        <SearchIcon width={20} height={20} color={colors.text.secondary} />
      }
      rightIcon={
        localSearchQuery.trim() && isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : undefined
      }
      placeholder={t('home.newsfeed.searchPlaceholder')}
      value={localSearchQuery}
      onChangeText={setLocalSearchQuery}
    />
  )
}

const ConversationFloatingButton = ({
  isManagement,
  isWeb,
  setIsNewConversationModalOpen,
  navigateTo,
}: {
  isManagement?: boolean
  isWeb: boolean
  setIsNewConversationModalOpen: (open: boolean) => void
  navigateTo: (path: string) => void
}) => {
  if (isManagement) {
    return null
  }

  const handlePress = () => {
    if (isWeb) {
      setIsNewConversationModalOpen(true)
    } else {
      navigateTo('/new-conversation')
    }
  }

  return <FloatingActionButton onPress={handlePress} />
}

const NewConversationModal = ({
  isNewConversationModalOpen,
  isWeb,
  setIsNewConversationModalOpen,
}: {
  isNewConversationModalOpen: boolean
  isWeb: boolean
  setIsNewConversationModalOpen: (open: boolean) => void
}) => {
  if (!isNewConversationModalOpen || !isWeb) {
    return null
  }

  return (
    <PostDetailsModal
      onClose={() => setIsNewConversationModalOpen(false)}
      title="New Conversation"
    >
      <NewConversationScreen
        onSuccessCallback={() => setIsNewConversationModalOpen(false)}
      />
    </PostDetailsModal>
  )
}

export function ConversationListScreen({
  searchWeb,
  setOpen,
  onPress,
  isManagement,
}: Readonly<{
  searchWeb?: string
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>
  onPress?: (conversation: Conversation) => void
  isManagement?: boolean
}>) {
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(localSearchQuery, 300)
  const searchParams = useSearchParams()
  const activeChatId =
    searchParams?.get('chatId') || searchParams?.get('userId')
  const [showMenu, setShowMenu] = useState(false)
  const [isNewConversationModalOpen, setIsNewConversationModalOpen] =
    useState(false)
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null)
  const [menuPosition, setMenuPosition] = useState<{
    top: number
    right?: number
    left?: number
  }>({ top: 0, right: 20 })
  const {
    conversations,
    removeConversation,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    loadMoreConversations,
    hasMoreConversations,
    refetchConversations,
    setSearchQuery,
  } = useChat()
  const { navigateTo } = useCrossPlatformNavigation()
  const { colors } = useThemeStore()
  const { t } = useTranslation()
  const { info } = useAuth()
  const { mutate: deleteChat, isPending: isDeleting } = useDeleteChat()
  const { mutate: leaveGroup, isPending: isLeaving } = useLeaveGroupChat()
  const { mutate: muteChat, isPending: isMuting } = useMuteChat()
  const { mutate: unmuteChat, isPending: isUnmuting } = useUnmuteChat()
  const [refreshing, setRefreshing] = useState(false)
  const { setIsHeaderLoading } = useHeaderStore()
  const { isWeb } = useDevice()
  const { setMembersCountPressCallback, closeModal } = useUserProfileStore()

  // Handle members count click from UserProfileModal
  const handleMembersCountPress = (user: UserDetails) => {
    console.log(
      'Members count clicked for user:',
      user.name,
      'Count:',
      user.membersCount,
    )
    // Close the modal first
    closeModal()
    // Navigate to ChatSettingScreen
    navigateTo(
      `/chat-setting-screen?userName=${encodeURIComponent(user.name)}&userAvatar=${encodeURIComponent(user.imageUrl || '')}&chatId=${encodeURIComponent(user.id)}&isOfficialGroup=${user.role === 'Group'}`,
    )
  }

  React.useEffect(() => {
    setMembersCountPressCallback(handleMembersCountPress)

    // Cleanup function to unset callback when component unmounts
    return () => {
      setMembersCountPressCallback(() => { })
    }
  }, [setMembersCountPressCallback])

  // Check if conversation is an official group
  const isOfficialGroup =
    selectedConversation?.group_id !== undefined &&
    selectedConversation?.group_id !== null

  React.useEffect(() => {
    setIsHeaderLoading(isRefetching && !hasMoreConversations && !refreshing)
  }, [isRefetching, hasMoreConversations, refreshing, setIsHeaderLoading])

  // Use API search instead of client-side filtering
  React.useEffect(() => {
    const effectiveSearchQuery =
      debouncedSearchQuery.trim() === ''
        ? searchWeb?.trim()
        : debouncedSearchQuery
    setSearchQuery(effectiveSearchQuery || '')
  }, [debouncedSearchQuery, searchWeb, setSearchQuery])

  const handleMessagePress = (conversation: Conversation) => {
    if (onPress) {
      onPress(conversation)
      return
    }
    setOpen?.(true)
    // Check if conversation is an official group
    const isConversationOfficialGroup =
      conversation.group_id !== undefined && conversation.group_id !== null
    navigateTo(
      `/chat-screen?userName=${encodeURIComponent(conversation.name)}&userAvatar=${encodeURIComponent(conversation.avatar)}&chatId=${encodeURIComponent(conversation.id)}&groupType=${encodeURIComponent(conversation.groupType || '')}&isOfficialGroup=${isConversationOfficialGroup}`,
    )
  }

  const handleMenuPress = (
    conversation: Conversation,
    pageY: number,
    pageX?: number,
    width?: number,
  ) => {
    setSelectedConversation(conversation)
    if (isWeb && pageX !== undefined && width !== undefined) {
      // Align the right edge of the 160px wide menu with the right edge of the icon
      setMenuPosition({
        top: pageY + 20,
        left: pageX + width - 160,
        right: undefined,
      })
    } else {
      setMenuPosition({
        top: pageY + 20,
        right: 20,
        left: undefined,
      })
    }
    setShowMenu(true)
  }

  const handleMute = () => {
    if (!selectedConversation) return

    const closeMenu = () => setShowMenu(false)
    const mutationOptions = {
      onSuccess: closeMenu,
      onError: closeMenu,
    }

    if (selectedConversation.is_muted) {
      unmuteChat(selectedConversation.id, mutationOptions)
    } else {
      muteChat(selectedConversation.id, mutationOptions)
    }
  }

  const handleDelete = () => {
    if (!selectedConversation) return

    deleteChat(selectedConversation.id, {
      onSuccess: () => {
        // Remove from local state via context
        removeConversation(selectedConversation.id)
        setShowMenu(false)
      },
      onError: (error) => {
        console.error('Failed to delete conversation:', error)
        setShowMenu(false)
      },
    })
  }

  const handleLeaveGroup = () => {
    if (!selectedConversation) return

    leaveGroup(selectedConversation.id, {
      onSuccess: () => {
        removeConversation(selectedConversation.id)
        setShowMenu(false)
      },
      onError: (error) => {
        console.error('Failed to leave group:', error)
        setShowMenu(false)
      },
    })
  }

  const handleLoadMore = () => {
    if (hasMoreConversations && !isLoading) {
      loadMoreConversations()
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetchConversations()
    } finally {
      setRefreshing(false)
    }
  }

  const menuItems = useConversationMenuItems({
    isManagement,
    selectedConversation,
    isOfficialGroup,
    isWeb,
    isDeleting,
    isLeaving,
    isMuting,
    isUnmuting,
    colors,
    t,
    handleMessagePress,
    handleMute,
    handleDelete,
    handleLeaveGroup,
  })

  const { height } = useWindowDimensions()

  return (
    <View style={[tw`flex-1`, { backgroundColor: colors.background }]}>
      <View
        style={
          isWeb
            ? [
              tw`overflow-y-scroll`,
              { maxHeight: height * getResponsiveMaxHeight(height) },
            ]
            : tw`flex-1`
        }
      >
        <FlatList
          data={conversations}
          renderItem={({ item }) => (
            <ConversationItem
              conversation={item}
              onPress={handleMessagePress}
              onMorePress={handleMenuPress}
              isActive={isWeb && item.id === activeChatId}
              currentUserId={String(info?.id)}
              t={t}
              navigateTo={navigateTo}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              isLoading={isLoading}
              hasData={conversations.length > 0}
              searchQuery={debouncedSearchQuery}
              t={t}
              colors={colors}
            />
          }
          keyExtractor={(item) => item.id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScrollBeginDrag={() => setShowMenu(false)}
          ListFooterComponent={
            <FooterState
              isLoading={isLoading}
              isFetchingNextPage={isFetchingNextPage}
              hasData={conversations.length > 0}
            />
          }
          ListHeaderComponent={
            <SearchHeader
              isWeb={isWeb}
              localSearchQuery={localSearchQuery}
              isLoading={isLoading}
              colors={colors}
              t={t}
              setLocalSearchQuery={setLocalSearchQuery}
            />
          }
          contentContainerStyle={tw`pb-4 flex-grow`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </View>
      <ConversationFloatingButton
        isManagement={isManagement}
        isWeb={isWeb}
        setIsNewConversationModalOpen={setIsNewConversationModalOpen}
        navigateTo={navigateTo}
      />

      <NewConversationModal
        isNewConversationModalOpen={isNewConversationModalOpen}
        isWeb={isWeb}
        setIsNewConversationModalOpen={setIsNewConversationModalOpen}
      />

      {showMenu && (
        <Modal
          transparent
          visible={showMenu}
          onRequestClose={() => setShowMenu(false)}
          animationType="fade"
        >
          <Pressable
            style={tw`flex-1 bg-black/5`}
            onPress={() => setShowMenu(false)}
          >
            <GroupMenu
              items={menuItems}
              onClose={() => setShowMenu(false)}
              style={{
                position: 'absolute',
                top: menuPosition.top,
                ...(menuPosition.right === undefined
                  ? {}
                  : { right: menuPosition.right }),
                ...(menuPosition.left === undefined
                  ? {}
                  : { left: menuPosition.left }),
                width: 160,
              }}
            />
          </Pressable>
        </Modal>
      )}
    </View>
  )
}

const ConversationItem = ({
  conversation,
  onPress,
  onMorePress,
  isActive,
  currentUserId,
  t,
  navigateTo,
}: {
  conversation: Conversation
  onPress: (message: Conversation) => void
  onMorePress: (
    conversation: Conversation,
    pageY: number,
    pageX?: number,
    width?: number,
  ) => void
  isActive?: boolean
  currentUserId?: string
  t: any
  navigateTo: (path: string) => void
}) => {
  const { colors } = useThemeStore()
  const moreIconRef = useRef<View>(null)
  const { isWeb } = useDevice()

  // Check if message is from an official group
  const isMessageOfficialGroup =
    conversation.group_id !== undefined && conversation.group_id !== null

  // Check if current user has a pending chat request
  const hasPendingRequest = conversation.participants?.some(
    (participant) =>
      String(participant.user_id) === currentUserId &&
      participant.invite_status === 'PENDING',
  )

  // Check if current user sent invitations to all other users and they are all pending
  const hasInvitationSent =
    conversation.participants?.every(
      (participant) =>
        String(participant.user_id) === currentUserId ||
        participant.invite_status === 'PENDING',
    ) && conversation.participants?.length > 1

  const handleMorePress = () => {
    if (isWeb) {
      moreIconRef.current?.measureInWindow((x, y, width, height) => {
        onMorePress(conversation, y, x, width)
      })
    } else {
      moreIconRef.current?.measure((x, y, width, height, pageX, pageY) => {
        onMorePress(conversation, pageY)
      })
    }
  }

  return (
    <TouchableOpacity
      style={[
        tw`flex-row items-center px-4 py-3 border-b`,
        {
          backgroundColor: isActive ? '#E9F4EE' : colors.background,
          borderColor: colors.border,
        },
      ]}
      onPress={() => onPress(conversation)}
    >
      {/* Avatar */}
      <View style={tw`mr-3`}>
        <UserImage
          imageUrl={conversation.avatar}
          name={conversation.name}
          size={48}
          userData={{
            id: conversation.id,
            userId:
              conversation.participants
                ?.find((p) => String(p.user_id) !== currentUserId)
                ?.user_id?.toString() || '',
            name: conversation.name,
            role: conversation.groupType == 'Group' ? 'Group' : 'Direct', // Message doesn't have role
            email: '', // Message doesn't have email
            phone: '', // Message doesn't have phone
            imageUrl: conversation.avatar,
            membersCount: conversation.participants?.length,
          }}
        />
      </View>

      {/* Message Content */}
      <View style={tw`flex-1 pr-2`}>
        <HStack spacing={6} align="center" style={tw`mb-1 pr-1`}>
          <AppText
            fontWeight="bold"
            size="base"
            numberOfLines={1}
            style={tw`shrink`}
          >
            {conversation.name}
          </AppText>
          {isMessageOfficialGroup && (
            <CheckCircle size={16} style={tw`shrink-0`} />
          )}
          {/* group type */}
          {conversation.groupType && (
            <View
              style={[
                tw`px-2 py-0.5 rounded-full shrink-0`,
                { backgroundColor: `${colors.primary}1A` },
              ]}
            >
              <AppText size="xs" color={colors.primary} fontWeight="bold">
                {conversation.groupType}
              </AppText>
            </View>
          )}
          {conversation.is_deleted && (
            <View
              style={[
                tw`px-2 py-0.5 rounded-full shrink-0`,
                { backgroundColor: `${colors.error}1A` },
              ]}
            >
              <AppText size="xs" color={colors.error} fontWeight="bold">
                {t('home.chat.deleted')}
              </AppText>
            </View>
          )}
        </HStack>
        <HStack align="center" spacing={8}>
          <AppText
            size="small"
            variant="secondary"
            fontWeight={'medium'}
            numberOfLines={1}
            style={tw`flex-1`}
          >
            {(() => {
              if (hasPendingRequest) {
                return t('home.chat.pendingChatRequest')
              }
              if (hasInvitationSent) {
                return t('home.chat.invitationSent')
              }
              return formatLastMessage(conversation.lastMessage)
            })()}
          </AppText>
        </HStack>
      </View>

      {/* Right Side: Time above Three Dots */}
      <View style={tw`items-end justify-center`}>
        <AppText
          size="xs"
          variant="secondary"
          fontWeight={'medium'}
          style={tw`mb-2`}
        >
          {conversation.time}
        </AppText>
        <HStack spacing={8} align="center">
          {/* unread bubble */}
          {conversation.unread && (
            <View style={tw`shrink-0`}>
              <UnreadDot count={conversation.unreadCount} />
            </View>
          )}
          {/* mute indicator */}
          {conversation.is_muted && (
            <View style={tw`shrink-0`}>
              <MuteIcon width={16} height={16} color={colors.text.secondary} />
            </View>
          )}
          <TouchableOpacity
            ref={moreIconRef}
            onPress={handleMorePress}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            style={tw`p-1`}
          >
            <ThreeDotIcon color={colors.text.gray2} width={17} height={17} />
          </TouchableOpacity>
        </HStack>
      </View>
    </TouchableOpacity>
  )
}

const EmptyState = ({ isLoading, hasData, searchQuery, t, colors }: any) => {
  if (isLoading && !hasData) {
    return (
      <View style={tw`flex-1 items-center justify-center py-20`}>
        <AppLoader color={colors.primary} size="large" />
        <AppText variant="secondary" style={tw`mt-4`}>
          Loading conversations...
        </AppText>
      </View>
    )
  }

  if (searchQuery) {
    return (
      <View style={tw`flex-1 items-center justify-center py-20`}>
        <AppText variant="secondary">{t('home.groups.noResults')}</AppText>
      </View>
    )
  }

  return (
    <View style={tw`flex-1 items-center justify-center py-20`}>
      <View style={tw`items-center`}>
        <View style={tw`mb-4 opacity-20`}>
          <Svg width="80" height="80" viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"
              stroke={colors.text.secondary}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <AppText size="large" fontWeight="bold" style={tw`mb-2 text-center`}>
          No conversations found
        </AppText>
        <AppText variant="secondary" style={tw`text-center px-12`}>
          It looks like you haven't started any conversations yet. Tap the
          button below to start chatting!
        </AppText>
      </View>
    </View>
  )
}

const FooterState = ({ isLoading, isFetchingNextPage, hasData }: any) => {
  const { colors } = useThemeStore()

  if (isFetchingNextPage && hasData) {
    return (
      <View style={tw`py-6 items-center`}>
        <AppLoader color={colors.primary} size="small" />
      </View>
    )
  }
  return <View style={tw`h-10`} />
}
