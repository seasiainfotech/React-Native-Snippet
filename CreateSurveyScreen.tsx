import React from 'react'
import { View, Platform } from 'react-native'
import Header from 'app/features/home/components/Header'
import { useThemeStore } from 'app/store/useThemeStore'
import { tw } from 'app/utils/tw'
import { useTranslation } from 'react-i18next'
import { useCrossPlatformNavigation } from 'app/hooks/useCrossPlatformNavigation'
import { useCreateSurvey } from 'app/api/surveys/survey.hooks'
import { CreateSurveyRequest } from 'app/api/surveys/survey.types'
import { SurveyForm } from './SurveyForm'

export function CreateSurveyScreen({ route, groupId: propGroupId, onSuccess }: any) {
    const groupId = propGroupId || route?.params?.groupId
    const { colors } = useThemeStore()
    const { t } = useTranslation()
    const { goBack } = useCrossPlatformNavigation()
    const { mutate: createSurvey, isPending } = useCreateSurvey()

    const handleCreateSurvey = (formData: { title: string; description: string; questions: any[] }) => {
        const payload: CreateSurveyRequest = {
            title: formData.title,
            description: formData.description,
            cover_image: null,
            group_id: Number(groupId),
            questions: formData.questions.map((q, index) => ({
                temp_id: q.tempId,
                question_text: q.text,
                question_type: q.type,
                is_required: q.isRequired,
                allow_multiple: q.type === 'MCQ' ? q.allowMultiple : false,
                position: index + 1,
                is_linked: q.isLinked,
                is_conditional: q.isConditional,
                parent_temp_id: q.isLinked || q.isConditional ? q.parentTempId : '',
                trigger_value: q.isConditional ? q.triggerValue : '',
                options: q.type === 'MCQ' ? q.options.map((o: any, oIndex: number) => ({
                    label: o.text,
                    value: o.text.toUpperCase().replaceAll(/\s+/g, '_'),
                    position: oIndex + 1
                })) : []
            }))
        }

        createSurvey(payload, {
            onSuccess: () => {
                if (onSuccess) {
                    onSuccess()
                } else {
                    goBack()
                }
            },
            onError: () => {
                // Error handled by hook/toast usually
            }
        })
    }

    return (
        <View style={[tw`flex-1`, { backgroundColor: colors.background }]}>
            {Platform.OS !== "web" && (
                <Header
                    title={t('home.groups.createSurvey.title')}
                    showBackButton={true}
                    onBackPress={goBack}
                />
            )}
            <SurveyForm
                onSubmit={handleCreateSurvey}
                isPending={isPending}
                submitButtonText={t('home.groups.createSurvey.actions.create')}
            />
        </View>
    )
}
