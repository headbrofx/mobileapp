import { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { centreFor, mapHtml } from './map-html';
import { colors, radius, type } from './theme';
import { tx } from './i18n';

// The map on a phone: the same Leaflet page as web, in a WebView.
// MapView.web.js is picked instead on web by the bundler.
let counter = 0;

export default function MapView({ markers = [], circles = [], zoom, height = 220, onPick, fallbackCentre }) {
  const idRef = useRef(null);
  if (!idRef.current) {
    counter += 1;
    idRef.current = `map-${counter}`;
  }
  const centre = centreFor({ markers, circles, fallback: fallbackCentre });

  const html = useMemo(
    () => (centre ? mapHtml({ id: idRef.current, center: centre, zoom, markers, circles, pickable: Boolean(onPick) }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(markers), JSON.stringify(circles), centre?.lat, centre?.lng, zoom, Boolean(onPick)]
  );

  if (!html) {
    return (
      <View style={[styles.frame, styles.empty, { height }]}>
        <Text style={styles.emptyText}>{tx('Ramani itaonekana ukiweka mahali')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://localhost' }}
        // A map inside a scrolling form should not fight the page for
        // the finger; nested scrolling stays inside the map.
        nestedScrollEnabled
        onMessage={(event) => {
          if (!onPick) return;
          try {
            const msg = JSON.parse(event.nativeEvent.data);
            if (msg.id === idRef.current && msg.type === 'pick') onPick({ lat: msg.lat, lng: msg.lng });
          } catch {
            // Not ours.
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.small, color: colors.muted },
});
