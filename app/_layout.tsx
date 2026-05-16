import { useColorScheme } from '@/hooks/use-color-scheme';
import { clearData, getData, saveData } from '@/utils/storage';
import NetInfo from '@react-native-community/netinfo';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import CustomToastConfig from './customtoast';

// ------------------ Global API URL ---------------------------------------------
// global.API_URL = 'https://devolamobile-api.manilateachersonline.com/'; // deployed
global.API_URL = "https://172.16.20.35:45456/";
// -------------------------------------------------------------------------------

export const unstable_settings = {
  initialRouteName: 'login',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(true);

  // ------------------ NETWORK STATUS -------------------------------------------
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected && isConnected) {
        Toast.show({
          type: 'error',
          text1: 'No internet connection',
        });
      } else if (state.isConnected && !isConnected) {
        Toast.show({
          type: 'success',
          text1: 'Back online',
        });
      }

      if (state.isConnected && state.isInternetReachable === false) {
        Toast.show({
          type: 'error',
          text1: 'Connected but no internet access',
        });
      }

      if (
        state.isConnected &&
        state.details &&
        'cellularGeneration' in state.details &&
        typeof state.details.cellularGeneration === 'string'
      ) {
        const slowTypes = ['2g', 'slow-2g'];
        if (slowTypes.includes(state.details.cellularGeneration)) {
          Toast.show({
            type: 'info',
            text1: 'Slow internet detected',
          });
        }
      }

      setIsConnected(state.isConnected ?? true);
    });

    return () => unsubscribe();
  }, [isConnected]);

  // ------------------ SESSION HANDLING ------------------------------------------
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'inactive' || state === 'background') {
        await saveData('sessionActive', false);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const sessionActive = await getData('sessionActive');

      if (sessionActive === false) {
        await clearData('user');
        await clearData('ftpRef');

        setTimeout(() => {
          router.replace('/login');
        }, 0);
      }

      await saveData('sessionActive', true);
    };

    checkSession();
  }, []);

  // ------------------ SPLASH SCREEN ---------------------------------------------
  const [ready, setReady] = useState(false);
  const slideAnim = useRef(new Animated.Value(50)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const blurAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(blurAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(blurAnim, {
              toValue: 0,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        ).start();
      });
    });

    const timeout = setTimeout(() => setReady(true), 4000);
    return () => clearTimeout(timeout);
  }, []);

  if (!ready) {
    return (
      <View style={styles.container}>
        <Animated.View
          style={{ transform: [{ translateY: slideAnim }], alignItems: 'center' }}
        >
          <Image
            source={require('@/assets/images/ola_splash.png')}
            style={{ width: 200, height: 200 }}
          />
          <Animated.Text style={[styles.text, { opacity: textOpacity }]}>
            OLA - MOBILE
          </Animated.Text>
        </Animated.View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>App Build v2.0.0</Text>
        </View>

        <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: blurAnim }}>
          <BlurView intensity={100} style={{ flex: 1 }} />
        </Animated.View>
      </View>
    );
  }

  // ------------------ APP NAVIGATION --------------------------------------------
  return (
    <>
      <PaperProvider>
        <ThemeProvider value={DefaultTheme}>
          <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="forgotpassword" options={{ headerShown: false }} />
            <Stack.Screen name="registration" options={{ headerShown: false }} />
            <Stack.Screen name="activation" options={{ headerShown: false }} />
            <Stack.Screen name="loanconfirmation" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </PaperProvider>

      <Toast config={CustomToastConfig} />
    </>
  );
}

// ------------------ STYLES ------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 20,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ff5a5f',
  },
  versionContainer: {
    position: 'absolute',
    bottom: 30,
    width: '100%',
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: '#999',
  },
});
