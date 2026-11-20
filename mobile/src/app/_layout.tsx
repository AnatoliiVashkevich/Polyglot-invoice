// Root: signed out → the sign-in screen; signed in → the 4 tabs. Full-screen flows (new invoice, job card…) are
// added here as routes later. The splash screen stays until the saved session has been read.
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/lib/auth';
import { setUpNotifications } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();
setUpNotifications();

function Screens() {
  const { ready, signedIn } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  // tapping a notification (task reminder, late invoice) opens that job
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (ready && signedIn && typeof url === 'string' && response?.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      router.push(url as never);
    }
  }, [response, ready, signedIn]);
  if (!ready) return null;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-invoice" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="new-task" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="new-note" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="client/[id]" />
        <Stack.Screen name="edit-client" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <Screens />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
