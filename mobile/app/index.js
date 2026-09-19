import { Redirect } from 'expo-router';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

// The gate. While the stored token is being checked against the API,
// neither destination is correct yet, so neither is shown.
//
// This carries the same wordmark on the same background as the native
// splash, so handing over from one to the other is invisible rather
// than a flash of a different screen.
export default function Index() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.container}>
        {/* The same raised lettering the HTML launch screen shows, at
            the same size, so handing over from one to the other is
            invisible rather than a jump from one logo to another. */}
        <Image
          source={require('../assets/wordmark-3d.png')}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="Afya Nyumbani"
        />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  wordmark: { width: 260, height: 40, marginBottom: spacing.lg },
});
