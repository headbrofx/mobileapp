import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { invoices as invoicesApi } from '../../lib/api';
import { Card, ErrorBox } from '../../lib/ui';
import { colors, font, spacing } from '../../lib/theme';

const STATUS_SW = {
  DRAFT: 'Rasimu',
  ISSUED: 'Inadaiwa',
  PARTIALLY_PAID: 'Imelipwa kiasi',
  PAID: 'Imelipwa',
  CANCELLED: 'Imeghairiwa',
};

// Amounts arrive as whole shillings, as integers. They are formatted for
// reading and never recomputed here: the number the server sent is the
// number, and a client that does its own arithmetic on money is a client
// that will eventually disagree with the books.
function tzs(amount) {
  return `TZS ${Number(amount).toLocaleString('en-US')}`;
}

export default function Invoices() {
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await invoicesApi.list();
      setList(data?.invoices ?? []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ErrorBox error={error} />

      {list.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Huna ankara yoyote.</Text>
        </Card>
      ) : (
        list.map((invoice) => (
          <Card key={invoice.id}>
            <Text style={styles.number}>{invoice.number}</Text>
            <Text style={styles.amount}>{tzs(invoice.amount)}</Text>
            <Text style={styles.muted}>
              {STATUS_SW[invoice.status] ?? invoice.status}
              {invoice.balance > 0 ? ` · Bado ${tzs(invoice.balance)}` : ''}
            </Text>
            {invoice.dueDate ? (
              <Text style={styles.muted}>
                Ilipwe ifikapo {new Date(invoice.dueDate).toLocaleDateString('sw-TZ')}
              </Text>
            ) : null}
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  number: { fontSize: 14, color: colors.muted, letterSpacing: 0.4 },
  amount: { fontSize: 20, fontFamily: font.bold, color: colors.text, marginVertical: 2 },
  muted: { fontSize: 14, color: colors.muted, marginTop: 2 },
});
