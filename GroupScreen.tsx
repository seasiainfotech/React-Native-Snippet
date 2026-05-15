import React, { useState, useMemo, useEffect } from 'react'
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
  Pressable,
  Platform,
} from 'react-native'
import { useDevice } from 'app/hooks/useDevice'
import {
  AppText,
  HStack,
  SearchBar,
  UserImage,
  LoadingIndicator,
} from 'app/components'
import { useThemeStore } from 'app/store/useThemeStore'
import { tw } from 'app/utils/tw'
import SearchIcon from 'app/assets/SearchIcon'
import { useTranslation } from 'react-i18next'
import GroupFilterIcon from 'app/assets/GroupFilterIcon'
import FloatingActionButtons from './components/FloatingActionButtons'
import { Group } from './types'
import Svg, { Path } from 'react-native-svg'
import { useGetAllGroups, useDeleteGroup } from 'app/api/group/group.hooks'
import { useAuth } from 'app/store/auth.store'
import { useHeaderStore } from 'app/store/useHeaderStore'
import { UserIcon } from './assets'
import { useSort } from 'app/hooks/useSort'
import { GroupSortBy } from 'app/api/group/group.types'
import TrashIcon from 'app/assets/TrashIcon'
import { useCrossPlatformNavigation } from 'app/hooks/useCrossPlatformNavigation'
import { UserRole } from 'app/api/auth/auth.types'
import { useUserProfileStore } from 'app/store/useUserProfileStore'
import { useDebounce } from 'app/hooks/useDebounce'

export const USE_GROUP_OVERLAY_V2 = true

const CheckIcon = () => {
  const { colors } = useThemeStore()
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 6L9 17L4 12"
        stroke={colors.success}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const GroupItem = ({
  group,
  t,
  onPress,
  onDelete,
  colors,
  closeDropdown,
}: {
  group: Group
  t: any
  onPress?: (group: Group) => void
  onDelete?: (group: Group) => void
  colors: any
  closeDropdown?: () => void
}) => {
  const { isWeb } = useDevice()
  const openProfile = useUserProfileStore((state) => state.openModal)
  return (
    <View
      style={[
        tw`flex-row items-center border-b`,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <TouchableOpacity
        style={tw`flex-1 flex-row items-center px-4 py-3`}
        onPress={() => {
          closeDropdown?.()
          onPress?.(group)
        }}
      >
        <View style={tw`mr-3`}>
          <UserImage
            imageUrl={group.profile_photo}
            name={group.title}
            size={isWeb ? 52 : 48}
            onPress={() => {
              closeDropdown?.()
              openProfile({
                id: group.id.toString(),
                name: group.title,
                role: 'Group',
                email: '',
                phone: '',
                imageUrl: group.profile_photo,
                membersCount: group.total_members,
                channelCount: group.total_channels,
              })
            }}
          />
        </View>
        <View style={tw`flex-1`}>
          <AppText
            fontWeight="bold"
            style={tw`mb-0.5`}
            variant="gray1"
            size="base"
          >
            {group.title}
          </AppText>
          <AppText size="small" variant="gray600" fontWeight={'medium'}>
            {group.total_members} {t('home.groups.members')}
          </AppText>
        </View>
      </TouchableOpacity>
      {__DEV__ && !isWeb && (
        <TouchableOpacity style={tw`p-4`} onPress={() => onDelete?.(group)}>
          <TrashIcon color={tw.color('gray-400')} width={20} height={20} />
        </TouchableOpacity>
      )}
    </View>
  )
}

interface GroupsScreenProps {
  onCreateGroup?: () => void
  onJoinGroup?: () => void
  onGroupPress?: (group: Group) => void
}

interface ListHeaderProps {
  searchQuery: string
  setSearchQuery: (text: string) => void
  isLoading: boolean
  handleFilterPress: () => void
  setShowSortDropdown: (show: boolean) => void
}

const ListHeader = React.memo(
  ({
    searchQuery,
    setSearchQuery,
    isLoading,
    handleFilterPress,
    setShowSortDropdown,
  }: ListHeaderProps) => {
    const { colors } = useThemeStore()
    const { t } = useTranslation()
    const { isWeb } = useDevice()

    return (
      <HStack
        style={[
          tw`px-4 pt-4 pb-2`,
          isWeb ? tw`rounded-t-3xl` : { backgroundColor: colors.background },
        ]}
        justify="space-between"
        align="center"
      >
        {/* Search Bar */}
        <View style={tw`flex-1 justify-center`}>
          <SearchBar
            leftIcon={
              <SearchIcon
                width={24}
                height={24}
                color={colors.text.secondary}
              />
            }
            rightIcon={
              searchQuery.trim() && isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : undefined
            }
            placeholder={t('home.groups.searchPlaceholder')}
            horizontalMargin={0}
            containerStyle={tw`mt-0 mb-0`}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text)
              setShowSortDropdown(false)
            }}
            onFocus={() => setShowSortDropdown(false)}
          />
        </View>
        {/* Filter Icon */}
        <TouchableOpacity
          style={[
            tw`ml-3 h-12 w-12 items-center justify-center rounded-xl border`,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
          onPress={handleFilterPress}
        >
          <GroupFilterIcon color={colors.text.secondary} />
        </TouchableOpacity>
      </HStack>
    )
  },
)

export function GroupsScreen({
  onCreateGroup,
  onJoinGroup,
  onGroupPress,
}: Readonly<GroupsScreenProps>) {
  const { colors } = useThemeStore()
  const { t } = useTranslation()
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [isFabExpanded, setIsFabExpanded] = useState(false)
  const [selectedSortOption, setSelectedSortOption] = useState<
    'recent' | 'nameAZ' | 'nameZA'
  >('recent')
  const { sortBy, order, setSort, setOrder } = useSort<GroupSortBy>('recent')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [isManualRefreshing, setIsManualRefreshing] = useState(false)
  const role = useAuth((state) => state.info?.role)
  const { navigateTo } = useCrossPlatformNavigation()
  const { isWeb } = useDevice()

  // Use the groups hook with search and sort
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isRefetching,
    refetch,
  } = useGetAllGroups({ keyword: debouncedSearch, sortBy, order })

  const { mutate: deleteGroup } = useDeleteGroup()
  const { setIsHeaderLoading, closeAllMenusToken } = useHeaderStore()

  useEffect(() => {
    if (showSortDropdown) {
      setShowSortDropdown(false)
    }
  }, [closeAllMenusToken])

  useEffect(() => {
    setIsHeaderLoading(
      isRefetching && !isFetchingNextPage && !isManualRefreshing,
    )
  }, [isRefetching, isFetchingNextPage, isManualRefreshing, setIsHeaderLoading])

  // Flatten all pages into a single groups array
  const groups = useMemo(() => {
    return data?.pages.flatMap((page) => page?.data?.data ?? []) ?? []
  }, [data])

  const sortOptions = [
    { id: 'recent', label: t('home.groups.sortOptions.recent') },
    { id: 'nameAZ', label: t('home.groups.sortOptions.nameAZ') },
    { id: 'nameZA', label: t('home.groups.sortOptions.nameZA') },
  ]

  const handleFilterPress = () => {
    setShowSortDropdown(!showSortDropdown)
  }

  const handleSelectSort = (sortId: 'recent' | 'nameAZ' | 'nameZA') => {
    setSelectedSortOption(sortId)
    if (sortId === 'recent') {
      setSort('recent')
      setOrder('asc')
    } else if (sortId === 'nameAZ') {
      setSort('title')
      setOrder('asc')
    } else if (sortId === 'nameZA') {
      setSort('title')
      setOrder('desc')
    }
    setShowSortDropdown(false)
  }

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }

  const handleRefresh = async () => {
    setIsManualRefreshing(true)
    try {
      await refetch()
    } finally {
      setIsManualRefreshing(false)
    }
  }

  const handleCreateGroup = () => {
    onCreateGroup?.()
  }

  const handleJoinGroup = () => {
    onJoinGroup?.()
  }

  // No direct useRouter usage anymore

  const handleGroupPress = (group: Group) => {
    // Close sort modal before navigating
    setShowSortDropdown(false)

    if (isFabExpanded) {
      setIsFabExpanded(false)
    } else if (onGroupPress) {
      onGroupPress(group)
    } else {
      navigateTo(
        `/group-dashboard-v2?id=${group.id}&name=${group.title ?? ''}&avatar=${group.profile_photo ?? ''}`,
      )
    }
  }

  const handleDeleteGroup = (group: Group) => {
    Alert.alert(
      t('common.delete') || 'Delete',
      t('home.groups.deleteConfirmation') ||
        'Are you sure you want to delete this group?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteGroup(group.id)
          },
        },
      ],
    )
  }

  const renderFooter = () => {
    if (!isFetchingNextPage) return null

    return (
      <View style={tw`py-4 items-center`}>
        <LoadingIndicator />
      </View>
    )
  }

  const renderEmpty = () => {
    // Don't show center loading indicator when searching (we have the search bar indicator)
    if (isLoading && !searchQuery.trim()) {
      return (
        <View
          style={[
            tw`flex-1 items-center justify-center py-20`,
            { backgroundColor: colors.background },
          ]}
        >
          <LoadingIndicator />
          <AppText
            size="small"
            variant="secondary"
            fontWeight="medium"
            style={tw`mt-4`}
          >
            {t('home.groups.loading')}
          </AppText>
        </View>
      )
    }

    if (isError) {
      return (
        <View
          style={[
            tw`flex-1 items-center justify-center py-20 px-6`,
            { backgroundColor: colors.background },
          ]}
        >
          <AppText size="xl" variant="secondary" fontWeight="semibold">
            {t('home.groups.error')}
          </AppText>
          <AppText
            size="small"
            variant="gray"
            style={tw`mt-2 mb-6 text-center`}
          >
            {error?.message || t('home.groups.errorMessage')}
          </AppText>
          <TouchableOpacity onPress={() => refetch()}>
            <AppText variant="primary" fontWeight="bold" size="base">
              {t('common.retry') || 'Retry'}
            </AppText>
          </TouchableOpacity>
        </View>
      )
    }

    return (
      <View
        style={[
          tw`flex-1 items-center justify-center py-20`,
          { backgroundColor: colors.background },
        ]}
      >
        <AppText size="xl" variant="secondary" fontWeight="medium">
          {searchQuery ? t('home.groups.noResults') : t('home.groups.noGroups')}
        </AppText>
      </View>
    )
  }

  const { height } = useWindowDimensions()
  return (
    <View
      style={[
        tw`flex-1 ${isWeb ? 'rounded-3xl' : ''}`,
        { backgroundColor: colors.background },
      ]}
    >
      <View
        style={
          isWeb
            ? [
                tw`overflow-y-scroll`,
                { minHeight: height * 0.88, maxHeight: height * 0.88 },
              ]
            : tw`flex-1`
        }
      >
        <FlatList
          style={tw`flex-1`}
          data={groups}
          renderItem={({ item }) => (
            <GroupItem
              group={item}
              t={t}
              onPress={handleGroupPress}
              onDelete={handleDeleteGroup}
              colors={colors}
              closeDropdown={() => {
                if (showSortDropdown) setShowSortDropdown(false)
              }}
            />
          )}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          ListHeaderComponent={
            <ListHeader
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              isLoading={isLoading}
              handleFilterPress={handleFilterPress}
              setShowSortDropdown={setShowSortDropdown}
            />
          }
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={groups.length === 0 ? tw`flex-1` : tw`pb-4`}
          refreshControl={
            <RefreshControl
              refreshing={isManualRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={() => showSortDropdown && setShowSortDropdown(false)}
          scrollEventThrottle={16}
        />
      </View>
      {/* Floating Action Buttons */}
      {role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN || isWeb ? (
        <FloatingActionButtons
          onCreateGroup={handleCreateGroup}
          onJoinGroup={handleJoinGroup}
          isExpanded={isFabExpanded}
          onToggle={setIsFabExpanded}
          showCreateGroup={
            role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN
          }
        />
      ) : (
        <View style={tw`absolute bottom-6 right-4`}>
          <TouchableOpacity
            onPress={handleJoinGroup}
            style={[
              tw`flex-row items-center px-4 py-3 rounded-full shadow-lg`,
              { backgroundColor: colors.primary },
            ]}
          >
            <UserIcon color="white" />
            <AppText
              style={tw`text-white ml-2`}
              fontWeight="medium"
              size="base"
            >
              {t('home.groups.joinGroup')}
            </AppText>
          </TouchableOpacity>
        </View>
      )}
      {/* Sort Dropdown - Positioned absolutely to appear above everything */}
      {showSortDropdown && (
        <>
          <Pressable
            style={{
              position: Platform.OS === 'web' ? ('fixed' as any) : 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 40,
            }}
            onPress={() => setShowSortDropdown(false)}
          />
          <View style={tw`absolute top-20 right-4 z-50`}>
          <View
            style={[
              tw`rounded-2xl p-4 shadow-lg border`,
              {
                minWidth: 160,
                backgroundColor: isWeb ? colors.background : colors.gray6,
                borderColor: colors.border,
              },
            ]}
          >
            <AppText size="base" fontWeight="semibold" style={tw`mb-3`}>
              {t('home.groups.sortBy')}
            </AppText>
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={tw`flex-row items-center justify-between py-2`}
                onPress={() => handleSelectSort(option.id as any)}
              >
                <AppText
                  size="small"
                  variant={
                    selectedSortOption === option.id ? 'primary' : 'gray'
                  }
                >
                  {option.label}
                </AppText>
                {selectedSortOption === option.id && <CheckIcon />}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </>
    )}
    </View>
  )
}
