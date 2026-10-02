import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { centreFor, mapHtml } from './map-html';
import { colors, radius, type } from './theme';
import { tx } from './i18n';

// The map on web: the shared Leaflet page in an iframe. A tap on a
// pickable map comes back through postMessage, matched by an id so two
// maps on one screen never hear each other.
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
    // The page is rebuilt only when what it draws changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(markers), JSON.stringify(circles), centre?.lat, centre?.lng, zoom, Boolean(onPick)]
  );

  useEffect(() => {
    if (!onPick) return undefined;
    function listen(event) {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : null;
        if (msg && msg.id === idRef.current && msg.type === 'pick') onPick({ lat: msg.lat, lng: msg.lng });
      } catch {
        // Not ours.
      }
    }
    window.addEventListener('message', listen);
    return () => window.removeEventListener('message', listen);
  }, [onPick]);

  if (!html) {
    return (
      <View style={[styles.frame, styles.empty, { height }]}>
        <Text style={styles.emptyText}>{tx('Ramani itaonekana ukiweka mahali')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <iframe title="map" srcDoc={html} style={{ border: 0, width: '100%', height: '100%' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...type.small, color: colors.muted },
});
