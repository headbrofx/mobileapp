import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useSession } from '../lib/session';
import { colors, spacing } from '../lib/theme';

// The gate. While the stored token is being checked against the API,
// neither destination is correct yet, so neither is shown.
export default function Index() {
  const { user, loading } = useSession();

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.brand}>Afya Nyumbani</Text>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={user ? '/home' : '/login'} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  brand: { fontSize: 22, fontWeight: '700', color: colors.primary, marginBottom: spacing.md },
});
