import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from './theme';

// The name, set as text rather than as a picture.
//
// It used to be assets/wordmark.png. That file is cropped: the tops of
// the A, f, t and y in "Afya" are cut flat against the top edge of the
// canvas, and no amount of layout fixes that, because the pixels are
// not in the file. Padding the box only moves the cut; 'contain' cannot
// restore what was never exported.
//
// So the name is typed now, in the app's own Jakarta ExtraBold, in the
// logo's two colours. Nothing can clip it, it stays sharp at every
// density, it costs no download, and it reads at sizes where the raised
// 3-D lettering in the artwork turned to mud.
//
// The house-and-stethoscope mark is not here. It was beside the name on
// the sign-in screens and at the top of Home, and the owner asked for it
// to go and the words to stay.

export function Wordmark({ size = 26, align = 'flex-start', style }) {
  return (
    <View style={[styles.row, { alignItems: align, alignSelf: align }, style]}>
      <Text
        style={[styles.text, { fontSize: size, lineHeight: Math.round(size * 1.24) }]}
        accessibilityRole="header"
        // One label for the pair, so a screen reader says the name once
        // rather than reading it as two unrelated words.
        accessibilityLabel="Afya Nyumbani"
      >
        <Text style={{ color: colors.brandOrange }}>Afya </Text>
        <Text style={{ color: colors.brandBlue }}>Nyumbani</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignSelf: 'flex-start' },
  text: {
    fontFamily: font.extrabold,
    letterSpacing: -0.4,
    // Descenders in "y" need the room; without this the line box clips
    // them on Android exactly the way the old picture clipped the caps.
    includeFontPadding: false,
    paddingBottom: 2,
  },
});
