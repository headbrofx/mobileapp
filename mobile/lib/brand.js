import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from './theme';

// The name, set as text rather than as a picture.
//
// It used to be assets/wordmark.png. That file was cropped: the tops of
// the A, f, t and y in "Afya" were cut flat against the edge of the
// canvas, and no amount of layout fixes that, because the pixels are
// not in the file.
//
// The raised 3-D lettering is back where it belongs — on the app icon
// and the launch screen, rebuilt from this same typeface at a size
// where the depth reads. Here it stays typed, because this draws the
// name at 21 points in a header, and extruded letters at 21 points are
// mud. Same two colours, same shapes; the depth is what is dropped.
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
