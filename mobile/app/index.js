import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Wordmark } from '../lib/brand';
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
        <Wordmark size={34} align="center" style={styles.wordmark} />
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
  wordmark: { marginBottom: spacing.lg },
});
