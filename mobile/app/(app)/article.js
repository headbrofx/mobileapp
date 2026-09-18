import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { content as contentApi } from '../../lib/api';
import { ErrorBox } from '../../lib/ui';
import { colors, font, radius, spacing, type } from '../../lib/theme';

// One article, read in full.
//
// The body is plain text with a little markdown in it — ** for a run of
// bold and - for a bullet — because that is what somebody writing in an
// admin form will naturally type. Rendering it here rather than
// shipping a markdown library keeps the bundle down for the two marks
// that actually get used.

export default function Article() {
  const { slug } = useLocalSearchParams();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await contentApi.get(slug);
        setArticle(data?.content ?? data?.item ?? null);
      } catch (err) {
        setError(err.message);
      }
    })();
  }, [slug]);

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ErrorBox error={error} />

      {article ? (
        <>
          <Text style={styles.title}>{article.title}</Text>

          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.noteText}>
              Maelezo ya jumla. Kwa hali yako binafsi, ongea na muuguzi wako.
            </Text>
          </View>

          {renderBody(article.body)}
        </>
      ) : !error ? (
        <Text style={styles.muted}>Inapakia…</Text>
      ) : null}
    </ScrollView>
  );
}

function renderBody(body = '') {
  return body
    .split('\n')
    .map((line, index) => {
      const text = line.trim();
      if (!text) return <View key={index} style={styles.gap} />;

      if (text.startsWith('- ')) {
        return (
          <View key={index} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.paragraph}>{inline(text.slice(2))}</Text>
          </View>
        );
      }

      return (
        <Text key={index} style={styles.paragraph}>
          {inline(text)}
        </Text>
      );
    });
}

// **bold** runs, and nothing else. Splitting on the marker keeps the
// surrounding text intact rather than stripping it.
function inline(text) {
  return text.split('**').map((part, index) =>
    index % 2 === 1 ? (
      <Text key={index} style={styles.bold}>
        {part}
      </Text>
    ) : (
      part
    )
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.xl },
  title: { ...type.title, color: colors.text, marginBottom: spacing.sm },
  muted: { ...type.body, color: colors.muted },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  noteText: { flex: 1, ...type.small, color: colors.text },

  paragraph: { ...type.body, color: colors.text, marginBottom: spacing.xs },
  bold: { fontFamily: font.bold },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 8,
  },
  gap: { height: spacing.xs },
});
