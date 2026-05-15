import React, { useRef, useState, useEffect, SetStateAction } from 'react'
import {
  View,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  TextInput,
  Platform,
  Animated,
} from 'react-native'
import {
  AppText,
  AppStatusBar,
  AppButton,
  Spacer,
  AppDivider,
  AppRichText,
  ImageSelectionModal,
  AppTextInput,
  InfoModal,
  Tooltip,
} from 'app/components'
import { tw } from 'app/utils/tw'
import { useTranslation } from 'react-i18next'
import { useSafeArea } from 'app/provider/safe-area/use-safe-area'
import { useThemeStore } from 'app/store/useThemeStore'
import { stripHtml } from 'app/utils/string.utils'
import Header from 'app/features/home/components/Header'
import { DocumentAttachment } from './components/DocumentAttachment'
import { LinkAttachment } from './components/LinkAttachment'
import { YoutubeAttachment } from './components/YoutubeAttachment'
import { MediaAttachment } from './components/MediaAttachment'
import { PostSettings } from './components/PostSettings'
import { PollSection } from './components/PollSection'
import { useChannelDetail } from 'app/api/channel/channel.hooks'

import {
  CameraCreatePostIcon,
  LinkCreatePostIcon,
  YoutubeCreatePostIcon,
  FileCreatePostIcon,
  TextCreatePostIcon,
  PollCreatePostIcon,
  BlogIconCreatePost,
  SettingCreatePostIcon,
} from './assets'

interface CreatePostScreenProps {
  setShowPostModal?: React.Dispatch<SetStateAction<boolean>>
  route: {
    params: {
      channelId?: string
      channelName?: string
      groupName: string
      groupId: string
      id?: string
      mode?: 'create' | 'edit'
      description?: string
      isAnnouncement?: string
    }
  }
  hideHeader?: boolean
}

import { useCreatePostLogic } from './hooks/useCreatePostLogic'
import { useDevice } from 'app/hooks/useDevice'
import { EventsIcon } from './assets/EventsIcon'
import { useCrossPlatformNavigation } from 'app/hooks/useCrossPlatformNavigation'
import { VIDEO_MAX_SIZE_MB, POST_MAX_LENGTH } from './constants'
import { ChevronRight } from 'app/assets'
import {
  NormalCreatePostHeader,
  BlogCreatePostHeader,
} from './components/CreatePostHeader'
import { GroupMember } from '../types'

export function CreatePostScreen({
  setShowPostModal,
  route,
  hideHeader,
}: Readonly<CreatePostScreenProps>) {
  const { isWeb } = useDevice()
  const { t } = useTranslation()
  const { router } = useCrossPlatformNavigation()
  const { groupId, channelId, id, mode, description, isAnnouncement } =
    route.params
  const { colors } = useThemeStore()
  const { bottom } = useSafeArea()

  const sanitizeId = (id: string | undefined) =>
    !id || id === 'null' ? '' : id
  const { data: channelDetail } = useChannelDetail(
    groupId,
    sanitizeId(channelId),
  )
  const hiddenInputRef = useRef<TextInput>(null)
  const scrollViewRef = useRef<ScrollView>(null)

  // State for blog header image
  const [blogHeaderImage, setBlogHeaderImage] = useState<string | null>(
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80',
  )

  // State for selected member
  const [selectedMember, setSelectedMember] = useState<GroupMember | null>(null)

  // Handle member selection
  const handleMemberSelect = (member: GroupMember) => {
    setSelectedMember(member)
    // Note: blogHeaderImage remains as selectedImage from CreatePostHeader
    // (default background or user-selected image, not member's profile photo)
  }

  const {
    postData,
    postType,
    postTitle,
    setPostTitle,
    content,
    setContent,
    activeTab,
    setActiveTab,
    selectedImages,
    setSelectedImages,
    showImageModal,
    setShowImageModal,
    activeAttachment,
    setActiveAttachment,
    linkUrl,
    setLinkUrl,
    youtubeUrl,
    setYoutubeUrl,
    selectedFile,
    setSelectedFile,
    settings,
    updateSetting,
    handlePostTypeChange,
    isPostButtonEnabled,
    handlePost,
    isPending,
    isUploading,
    handlePickDocument,
    handlePickVideo,
    videoSizeError,
    setVideoSizeError,
    pollQuestion,
    handlePollQuestionChange,
    pollOptions,
    handlePollOptionChange,
    handleAddPollOption,
    handleRemovePollOption,
    closesAt,
    setClosesAt,
    isEditMode,
    goBack,
  } = useCreatePostLogic({
    groupId,
    channelId,
    id,
    mode,
    description,
    isAnnouncement: isAnnouncement === 'true',
    blogHeaderImage,
    selectedMember,
    can_post_anonymously: channelDetail?.can_post_anonymously,
  })

  useEffect(() => {
    if (isEditMode && postData?.post_type === 'BLOG') {
      const blogImage =
        postData.attachments?.find((a: any) => a.type === 'IMAGE')?.url ||
        postData.media_url ||
        'https://images.unsplash.com/photo-1717360564258-f6a9e4bc308c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w4NTQyNTF8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NzQ0MTU5MTB8&ixlib=rb-4.1.0&q=80&w=1080'
      setBlogHeaderImage(blogImage)
    }
  }, [isEditMode, postData])

  const { keyboardHeight, fabAnimation, dismissKeyboard } = useKeyboardFab(
    hiddenInputRef,
    content,
    setContent,
  )

  // Determine if this is an announcement (both create and edit modes) for UI
  const isAnnouncementMode =
    isAnnouncement === 'true' ||
    (isEditMode &&
      (postData?.is_announcement ||
        postData?.post_type?.toLowerCase() === 'announcement'))

  // Title state for the new title input field
  // Note: We now use postTitle from the hook instead of local state

  // Define post type configuration based on new enum
  const postTypeConfig = {
    TEXT: { icon: <TextCreatePostIcon />, tab: 'TEXT' },
    IMAGE: { icon: <CameraCreatePostIcon />, tab: 'IMAGE' },
    LINK: { icon: <LinkCreatePostIcon />, tab: 'LINK' },
    VIDEO: { icon: <YoutubeCreatePostIcon />, tab: 'VIDEO' },
    DOCUMENT: { icon: <FileCreatePostIcon />, tab: 'DOCUMENT' },
    POLL: { icon: <PollCreatePostIcon />, tab: 'POLL' },
    EVENT: { icon: <EventsIcon />, tab: 'EVENT' },
    BLOG: { icon: <BlogIconCreatePost />, tab: 'BLOG' },
    SETTINGS: { icon: <SettingCreatePostIcon />, tab: 'settings' },
  }

  // Determine allowed types based on announcement mode
  const allowedTypes = isAnnouncementMode
    ? ['TEXT', 'IMAGE', 'LINK', 'VIDEO', 'DOCUMENT']
    : channelDetail?.default_allowed_post_types?.split(',') || []

  // Handle scroll to right
  const handleScrollRight = () => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ x: 200, animated: true })
    }
  }

  const isPollPost = postType === 'POLL'

  const bottomItems = getBottomItems({
    isAnnouncementMode,
    isAnnouncement,
    allowedTypes,
    postType,
    postTypeConfig,
    isEditMode,
  })

  const renderMainPostContent = () => {
    if (postType === 'POLL') {
      return (
        <PollSection
          question={pollQuestion}
          onQuestionChange={handlePollQuestionChange}
          options={pollOptions}
          onOptionChange={handlePollOptionChange}
          onAddOption={handleAddPollOption}
          onRemoveOption={handleRemovePollOption}
          closesAt={closesAt}
          onClosesAtChange={setClosesAt}
        />
      )
    }

    if (isAnnouncementMode) {
      return <View style={tw`flex-1`} />
    }

    return (
      <AppRichText
        editorId={`${id}-${!!postData}`}
        value={content}
        onChange={
          Platform.OS === 'web'
            ? (text: string) => setContent(text)
            : setContent
        }
        placeholder={t('home.groups.createPost.contentPlaceholder')}
        style={tw`flex-1 `}
        //@`ts-ignore
        // maxLength={postType === 'BLOG' ? BLOG_MAX_LENGTH : POST_MAX_LENGTH}
      />
    )
  }

  return (
    <View
      style={[
        tw`flex-1 pb-[${bottom}px]`,
        { backgroundColor: colors.background },
      ]}
    >
      <AppStatusBar />
      <ScreenHeader
        hideHeader={hideHeader}
        activeTab={activeTab}
        isAnnouncementMode={isAnnouncementMode}
        isEditMode={isEditMode}
        dismissKeyboard={dismissKeyboard}
        setActiveTab={setActiveTab}
        setShowPostModal={setShowPostModal}
        goBack={goBack}
        t={t}
      />

      {/* Hidden input to steal focus from AppRichText */}
      <TextInput
        ref={hiddenInputRef}
        style={{ width: 0, height: 0, opacity: 0 }}
        value=""
        onChangeText={() => {}}
        onSubmitEditing={() => {}}
      />

      {activeTab === 'post' ? (
        <TouchableWithoutFeedback>
          <ScrollView
            style={tw`flex-1 px-4`}
            contentContainerStyle={{ paddingBottom: keyboardHeight + 100 }}
            keyboardShouldPersistTaps="handled"
          >
            <PostTypeHeader
              postType={postType}
              blogHeaderImage={blogHeaderImage}
              setBlogHeaderImage={setBlogHeaderImage}
              handleMemberSelect={handleMemberSelect}
              groupId={groupId}
              channelDetail={channelDetail}
              colors={colors}
              settings={settings}
            />
            <AppDivider />
            <Spacer size={2} />

            <MainTitleInput
              postType={postType}
              postTitle={postTitle}
              setPostTitle={setPostTitle}
              isAnnouncementMode={isAnnouncementMode}
              colors={colors}
              t={t}
            />

            {renderMainPostContent()}

            <AttachmentSection
              postType={postType}
              activeAttachment={activeAttachment}
              selectedImages={selectedImages}
              setShowImageModal={setShowImageModal}
              setSelectedImages={setSelectedImages}
              linkUrl={linkUrl}
              setLinkUrl={setLinkUrl}
              youtubeUrl={youtubeUrl}
              setYoutubeUrl={setYoutubeUrl}
              handlePickVideo={handlePickVideo}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              setActiveAttachment={setActiveAttachment}
            />
          </ScrollView>
        </TouchableWithoutFeedback>
      ) : (
        <PostSettings
          settings={settings}
          onUpdateSetting={updateSetting}
          onReturn={() => setActiveTab('post')}
          isPoll={isPollPost}
        />
      )}

      <CreatePostFooter
        colors={colors}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        postType={postType}
        handlePostTypeChange={handlePostTypeChange}
        activeAttachment={activeAttachment}
        setActiveAttachment={setActiveAttachment}
        setShowImageModal={setShowImageModal}
        handlePickDocument={handlePickDocument}
        bottomItems={bottomItems}
        scrollViewRef={scrollViewRef}
        handleScrollRight={handleScrollRight}
        content={content}
        isWeb={isWeb}
        isPending={isPending}
        t={t}
        router={router}
        groupId={groupId}
        channelId={channelId}
        setShowPostModal={setShowPostModal}
        goBack={goBack}
        isEditMode={isEditMode}
        handlePost={handlePost}
        isPostButtonEnabled={isPostButtonEnabled}
        isUploading={isUploading}
        isAnnouncementMode={isAnnouncementMode}
        postTitle={postTitle}
      />

      <ImageSelectionModal
        visible={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSelectImage={(imageUrl) => {
          setSelectedImages((prev) => [...prev, imageUrl])
        }}
      />

      <FloatingCloseButton
        keyboardHeight={keyboardHeight}
        bottom={bottom}
        fabAnimation={fabAnimation}
        onDismiss={dismissKeyboard}
        primaryColor={colors.primary}
        content={content}
        limit={POST_MAX_LENGTH}
        colors={colors}
        t={t}
        postType={postType}
        isAnnouncementMode={isAnnouncementMode}
        postTitle={postTitle}
      />

      <InfoModal
        visible={videoSizeError}
        onClose={() => setVideoSizeError(false)}
        title="File Too Large"
        description={`Video size cannot be more than ${VIDEO_MAX_SIZE_MB} MB. Please choose a smaller video file.`}
        buttonText="OK"
        icon="info"
      />
    </View>
  )
}

/**
 * Sub-components to reduce cognitive complexity of the main screen
 */

/**
 * Hooks and helpers to reduce cognitive complexity of the main screen
 */

const useKeyboardFab = (
  hiddenInputRef: React.RefObject<TextInput | null>,
  content: string,
  setContent: (val: string) => void,
) => {
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const fabAnimation = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height)
      Animated.timing(fabAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start()
    })
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
      Animated.timing(fabAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start()
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  const dismissKeyboard = () => {
    hiddenInputRef.current?.focus()
    setTimeout(() => {
      Keyboard.dismiss()
      hiddenInputRef.current?.blur()
    }, 50)
    const current = content
    setContent('')
    setTimeout(() => setContent(current), 100)
    setTimeout(() => Keyboard.dismiss(), 150)
    setTimeout(() => Keyboard.dismiss(), 250)
  }

  return { keyboardHeight, fabAnimation, dismissKeyboard }
}

const getBottomItems = ({
  isAnnouncementMode,
  isAnnouncement,
  allowedTypes,
  postType,
  postTypeConfig,
  isEditMode,
}: any) => {
  return [
    ...(allowedTypes.includes('TEXT') || !isAnnouncement
      ? [{ ...postTypeConfig.TEXT, key: 'TEXT' }]
      : []),
    ...(allowedTypes.includes('IMAGE') && postType !== 'BLOG'
      ? [{ ...postTypeConfig.IMAGE, key: 'IMAGE' }]
      : []),
    ...(allowedTypes.includes('LINK')
      ? [{ ...postTypeConfig.LINK, key: 'LINK' }]
      : []),
    // Only show EVENT option in create mode, not in edit mode
    ...(allowedTypes.includes('EVENT') && !isEditMode
      ? [{ ...postTypeConfig.EVENT, key: 'EVENT' }]
      : []),
    ...(allowedTypes.includes('VIDEO')
      ? [{ ...postTypeConfig.VIDEO, key: 'VIDEO' }]
      : []),
    ...(allowedTypes.includes('DOCUMENT')
      ? [{ ...postTypeConfig.DOCUMENT, key: 'DOCUMENT' }]
      : []),
    // Only show POLL option in create mode, not in edit mode
    ...(allowedTypes.includes('POLL') && !isEditMode
      ? [{ ...postTypeConfig.POLL, key: 'POLL' }]
      : []),
    ...(allowedTypes.includes('BLOG')
      ? [{ ...postTypeConfig.BLOG, key: 'BLOG' }]
      : []),
    ...(postType !== 'POLL' &&
    postType !== 'ANNOUNCEMENT' &&
    postType !== 'BLOG' &&
    postType !== 'EVENT'
      ? [{ ...postTypeConfig.SETTINGS, key: 'SETTINGS' }]
      : []),
  ]
}

const ScreenHeader = ({
  hideHeader,
  activeTab,
  isAnnouncementMode,
  isEditMode,
  dismissKeyboard,
  setActiveTab,
  setShowPostModal,
  goBack,
  t,
}: any) => {
  if (hideHeader) return null

  const getTitle = () => {
    if (activeTab !== 'post') {
      return t('home.groups.createPost.settingsTitle')
    }
    if (isAnnouncementMode) {
      return t('home.groups.createPost.announcementTitle')
    }
    return isEditMode
      ? t('home.groups.createPost.editTitle')
      : t('home.groups.createPost.title')
  }

  const handleBack = () => {
    dismissKeyboard()
    if (activeTab === 'settings') {
      setActiveTab('post')
    } else if (setShowPostModal) {
      setShowPostModal(false)
    } else {
      goBack()
    }
  }

  return (
    <Header title={getTitle()} showBackButton={true} onBackPress={handleBack} />
  )
}

const PostTypeHeader = ({
  postType,
  blogHeaderImage,
  setBlogHeaderImage,
  handleMemberSelect,
  groupId,
  channelDetail,
  colors,
  settings,
}: any) => {
  if (postType === 'BLOG') {
    return (
      <BlogCreatePostHeader
        colors={colors.inputBackground}
        image={blogHeaderImage}
        onImageSelect={setBlogHeaderImage}
        onMemberSelect={handleMemberSelect}
        groupId={groupId}
      />
    )
  }

  return (
    <NormalCreatePostHeader
      canPostAnonymously={settings?.show_anonymous}
    />
  )
}

const AttachmentSection = ({
  postType,
  activeAttachment,
  selectedImages,
  setShowImageModal,
  setSelectedImages,
  linkUrl,
  setLinkUrl,
  youtubeUrl,
  setYoutubeUrl,
  handlePickVideo,
  selectedFile,
  setSelectedFile,
  setActiveAttachment,
}: any) => {
  if (postType === 'POLL') return null

  return (
    <>
      {activeAttachment === 'media' && selectedImages.length > 0 && (
        <MediaAttachment
          images={selectedImages}
          onAddPress={() => setShowImageModal(true)}
          onRemoveImage={(index: number) => {
            setSelectedImages((prev: any[]) =>
              prev.filter((_, i) => i !== index),
            )
          }}
        />
      )}

      {activeAttachment === 'link' && (
        <LinkAttachment url={linkUrl} onChangeUrl={setLinkUrl} />
      )}

      {activeAttachment === 'youtube' && (
        <YoutubeAttachment
          url={youtubeUrl}
          onChangeUrl={setYoutubeUrl}
          onVideoUpload={handlePickVideo}
          localVideo={
            selectedFile?.mimeType?.startsWith('video/') ? selectedFile : null
          }
          onRemoveLocalVideo={() => {
            setSelectedFile(null)
          }}
        />
      )}

      {activeAttachment === 'file' && selectedFile && (
        <DocumentAttachment
          filename={selectedFile.name}
          size={selectedFile.size?.toString()}
          onRemove={() => {
            setSelectedFile(null)
            setActiveAttachment('none')
          }}
        />
      )}
    </>
  )
}

const CreatePostFooter = ({
  colors,
  activeTab,
  setActiveTab,
  postType,
  handlePostTypeChange,
  activeAttachment,
  setActiveAttachment,
  setShowImageModal,
  handlePickDocument,
  bottomItems,
  scrollViewRef,
  handleScrollRight,
  content,
  isWeb,
  isPending,
  t,
  router,
  groupId,
  channelId,
  setShowPostModal,
  goBack,
  isEditMode,
  handlePost,
  isPostButtonEnabled,
  isUploading,
  isAnnouncementMode,
  postTitle,
}: any) => {
  const handleMediaTab = () => {
    if (postType !== 'IMAGE') handlePostTypeChange('IMAGE')
    if (activeAttachment === 'media') {
      setActiveAttachment('none')
    } else {
      setActiveAttachment('media')
      setShowImageModal(true)
      setActiveTab('post')
    }
  }

  const handleDocumentTab = () => {
    if (postType !== 'DOCUMENT') handlePostTypeChange('DOCUMENT')
    if (activeAttachment === 'file') {
      setActiveAttachment('none')
    } else {
      handlePickDocument()
    }
  }

  const handleTabPress = (tab: string) => {
    switch (tab) {
      case 'settings':
        setActiveTab('settings')
        break
      case 'EVENT':
        if (setShowPostModal) setShowPostModal(false)
        router.push(`/create-event?groupId=${groupId}&channelId=${channelId}`)
        break
      case 'TEXT':
        setActiveAttachment('none')
        if (postType !== 'TEXT') handlePostTypeChange('TEXT')
        break
      case 'LINK':
        if (postType !== 'LINK') {
          setActiveAttachment('none')
          handlePostTypeChange('LINK')
        }
        break
      case 'POLL':
        if (postType !== 'POLL') {
          setActiveAttachment('none')
          handlePostTypeChange('POLL')
        }
        break
      case 'VIDEO':
        if (postType !== 'VIDEO') {
          setActiveAttachment('none')
          handlePostTypeChange('VIDEO')
        }
        break
      case 'BLOG':
        if (postType !== 'BLOG') {
          setActiveAttachment('none')
          handlePostTypeChange('BLOG')
        }
        break
      case 'IMAGE':
        handleMediaTab()
        break
      case 'DOCUMENT':
        handleDocumentTab()
        break
      default:
        setActiveTab('post')
        setActiveAttachment(activeAttachment === tab ? 'none' : tab)
        break
    }
  }

  return (
    <View style={[tw`px-4 pt-4 pb-2 border-t`, { borderColor: colors.border }]}>
      <PostTypeSelector
        scrollViewRef={scrollViewRef}
        bottomItems={bottomItems}
        handleTabPress={handleTabPress}
        handleScrollRight={handleScrollRight}
        colors={colors}
        activeTab={activeTab}
        postType={postType}
        t={t}
        isWeb={isWeb}
      />

      {postType === 'TEXT' && (
        <View style={[tw`absolute right-4 -top-8 px-2 py-0.5 rounded-full`]}>
          <AppText
            style={{
              color:
                stripHtml(content).length > POST_MAX_LENGTH
                  ? colors.error
                  : colors.text.secondary,
            }}
            variant="secondary"
            size="small"
            fontWeight={
              stripHtml(content).length > POST_MAX_LENGTH ? 'bold' : 'medium'
            }
          >
            {t('home.groups.createPost.characterCount', {
              count: isAnnouncementMode ? postTitle.length : stripHtml(content).length,
              limit: POST_MAX_LENGTH,
            })}
          </AppText>
        </View>
      )}

      <FooterActions
        isWeb={isWeb}
        isEditMode={isEditMode}
        handlePost={handlePost}
        isPostButtonEnabled={isPostButtonEnabled}
        isUploading={isUploading}
        isPending={isPending}
        setShowPostModal={setShowPostModal}
        goBack={goBack}
        t={t}
      />
    </View>
  )
}

const PostTypeSelector = ({
  scrollViewRef,
  bottomItems,
  handleTabPress,
  handleScrollRight,
  colors,
  activeTab,
  postType,
  t, // Added 't' as it's needed for tooltips
  isWeb,
}: any) => {
  const getEmojiTooltip = (tab: string) => {
    switch (tab) {
      case 'TEXT':
        return t('home.groups.createChannel.tags.postTypes.text')
      case 'IMAGE':
        return t('home.groups.createChannel.tags.postTypes.image')
      case 'LINK':
        return t('home.groups.createChannel.tags.postTypes.link')
      case 'VIDEO':
        return t('home.groups.createChannel.tags.postTypes.video')
      case 'DOCUMENT':
        return t('home.groups.createChannel.tags.postTypes.document')
      case 'POLL':
        return t('home.groups.createChannel.tags.postTypes.poll')
      case 'EVENT':
        return t('home.groups.createChannel.tags.postTypes.eventListing')
      case 'BLOG':
        return t('home.groups.createChannel.tags.postTypes.blog')
      case 'settings':
        return t('home.groups.createPost.settingsTitle')
      default:
        return ''
    }
  }

  return (
    <View style={tw`flex-row justify-center items-center mb-6 relative`}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={tw`gap-5 items-center pl-4 pr-10`}
        style={tw`w-full`}
      >
        {bottomItems.map((item: any) => (
          <Tooltip text={getEmojiTooltip(item.tab)} key={item.tab}>
            <TouchableOpacity
              testID={`button-${item.tab}`}
              onPress={() => handleTabPress(item.tab)}
            >
              <View
                style={[
                  tw`w-8 h-8 rounded-lg items-center justify-center`,
                  (item.tab === 'settings' && activeTab === 'settings') ||
                  (item.tab === postType && activeTab === 'post')
                    ? { backgroundColor: colors.gray6 }
                    : {},
                ]}
              >
                {React.cloneElement(item.icon as React.ReactElement<any>, {
                  color: (() => {
                    const isActive =
                      (item.tab === 'settings' && activeTab === 'settings') ||
                      (item.tab === postType && activeTab === 'post')
                    if (isActive) return colors.primary
                    if (item.tab === 'IMAGE') return '#F4511E'
                    if (item.tab === 'DOCUMENT') return '#00BCD4'
                    if (item.tab === 'EVENT') return '#FF6B35'
                    return '#4C4C4C'
                  })(),
                })}
              </View>
            </TouchableOpacity>
          </Tooltip>
        ))}
      </ScrollView>
      {!isWeb && (
        <TouchableOpacity
          onPress={handleScrollRight}
          style={[
            tw`absolute -right-4 top-0 bottom-0 justify-center px-1`,
            { backgroundColor: colors.background, opacity: 0.8 },
          ]}
        >
          <ChevronRight color={colors.text.secondary} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const FooterActions = ({
  isWeb,
  isEditMode,
  handlePost,
  isPostButtonEnabled,
  isUploading,
  isPending,
  setShowPostModal,
  goBack,
  t,
}: any) => {
  const onCancel = () => (setShowPostModal ? setShowPostModal(false) : goBack())

  return (
    <View style={isWeb ? tw`flex-row justify-between` : tw`flex-col`}>
      {isWeb && (
        <View style={tw`flex-1 mr-2`}>
          <AppButton
            title={t('home.groups.createPost.cancelButton')}
            onPress={onCancel}
            fullWidth
            variant="secondary"
            testID="cancel-button"
          />
        </View>
      )}

      <View style={isWeb ? tw`flex-1 ml-2` : tw`w-full`}>
        <AppButton
          title={
            isEditMode
              ? t('home.groups.createPost.updateButton')
              : t('home.groups.createPost.postButton')
          }
          onPress={() => handlePost(isWeb, setShowPostModal)}
          disabled={!isPostButtonEnabled() || isUploading}
          isLoading={isPending || isUploading}
          fullWidth
          variant="primary"
          testID="post-button"
        />
      </View>

      {!isWeb && (
        <View style={tw`w-full mt-3`}>
          <AppButton
            title={t('home.groups.createPost.cancelButton')}
            onPress={onCancel}
            fullWidth
            variant="secondary"
            testID="cancel-button"
          />
        </View>
      )}
    </View>
  )
}

const getMaxLength = (
  isAnnouncementMode: boolean,
  postType: string,
): number => {
  if (isAnnouncementMode) {
    return POST_MAX_LENGTH
  }
  return 100
}

const getNumberOfLines = (
  isAnnouncementMode: boolean,
  postType: string,
): number => {
  if (isAnnouncementMode && postType === 'TEXT') {
    return 4
  }
  if (isAnnouncementMode) {
    return 3
  }
  return 1
}

const getContainerStyle = (isAnnouncementMode: boolean, postType: string) => {
  if (isAnnouncementMode && postType === 'TEXT') {
    return { minHeight: 250 }
  }
  if (isAnnouncementMode) {
    return { minHeight: 100 }
  }
  return undefined
}

const getTextInputStyle = (isAnnouncementMode: boolean, postType: string) => {
  if (isAnnouncementMode && postType === 'TEXT') {
    return { minHeight: 220, paddingTop: 8 }
  }
  if (isAnnouncementMode) {
    return { minHeight: 70, paddingTop: 8 }
  }
  return undefined
}

const MainTitleInput = ({
  postType,
  postTitle,
  setPostTitle,
  isAnnouncementMode,
  colors,
  t,
}: any) => {
  if (postType === 'POLL') return null

  return (
    <View style={tw`mt-2`}>
      <AppTextInput
        value={postTitle}
        onChangeText={setPostTitle}
        placeholder={t(
          isAnnouncementMode
            ? 'home.groups.createPost.announcementTitlePlaceholder'
            : 'home.groups.createPost.titlePlaceholder',
          isAnnouncementMode ? 'Enter Announcement' : 'Enter title...',
        )}
        placeholderTextColor={colors.text.secondary}
        maxLength={getMaxLength(isAnnouncementMode, postType)}
        multiline={isAnnouncementMode}
        numberOfLines={getNumberOfLines(isAnnouncementMode, postType)}
        variant={isAnnouncementMode ? 'multiline' : 'text'}
        containerStyle={getContainerStyle(isAnnouncementMode, postType)}
        style={getTextInputStyle(isAnnouncementMode, postType)}
      />
    </View>
  )
}

const FloatingCloseButton = ({
  keyboardHeight,
  bottom,
  fabAnimation,
  onDismiss,
  primaryColor,
  content,
  limit,
  colors,
  t,
  postType,
  isAnnouncementMode,
  postTitle,
}: any) => {
  const count = isAnnouncementMode
    ? postTitle.length
    : stripHtml(content).length
  const isOverLimit = count > limit

  return (
    <Animated.View
      style={[
        tw`absolute right-4 z-50 flex-row items-center`,
        {
          bottom:
            Platform.OS === 'android'
              ? Math.min(keyboardHeight + 60, keyboardHeight + bottom + 30)
              : keyboardHeight + 20,
          opacity: fabAnimation,
          transform: [{ scale: fabAnimation }],
        },
      ]}
    >
      {(postType === 'TEXT' || postType === 'BLOG') && (
        <View
          style={[
            tw`bg-white/90 px-3 py-1.5 rounded-full mr-3 shadow-sm border`,
            { borderColor: isOverLimit ? colors.error : colors.border },
          ]}
        >
          <AppText
            style={{
              color: isOverLimit ? colors.error : colors.text.secondary,
            }}
            variant="secondary"
            size="small"
            fontWeight={isOverLimit ? 'bold' : 'medium'}
          >
            {t('home.groups.createPost.characterCount', {
              count,
              limit,
            })}
          </AppText>
        </View>
      )}
      <TouchableOpacity
        onPress={onDismiss}
        style={[
          tw`w-14 h-14 rounded-full items-center justify-center shadow-lg`,
          { backgroundColor: primaryColor },
        ]}
      >
        <AppText style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
          ✕
        </AppText>
      </TouchableOpacity>
    </Animated.View>
  )
}
