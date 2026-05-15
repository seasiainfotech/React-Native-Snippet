import React from 'react'
import { View } from 'react-native'
import { AppText, AppStatusBar } from 'app/components'
import { tw } from 'app/utils/tw'
import { useThemeStore } from 'app/store/useThemeStore'

export function CreateGroupConfirmScreen() {
    const { colors } = useThemeStore()

    return (
        <View style={tw`flex-1 bg-[${colors.background}]`}>
            <AppStatusBar variant="dark" />
            <View style={tw`flex-1 items-center justify-center`}>
                <AppText size="2xl" fontWeight="bold">
                    Confirm Group Creation
                </AppText>
                <AppText variant="gray" size="base" style={tw`mt-2`}>
                    Screen coming soon...
                </AppText>
            </View>
        </View>
    )
}

export default CreateGroupConfirmScreen
