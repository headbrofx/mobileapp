// The map itself, as one small HTML page: Leaflet drawing OpenStreetMap
// tiles. The same page runs inside an iframe on web and a WebView on a
// phone, so there is one map, not two that drift apart.
//
// Why this and not a maps SDK: it needs no API key and no billing
// account, and it is a real map of real streets. What it does not do is
// routing or arrival times. Those come from a provider configured on the
// server (see the API's integrations/location), and until then nothing
// in the app claims to know how long a drive takes.
//
// OpenStreetMap's tile servers are fine for light use with attribution,
// which is kept. Heavy production traffic should move to a tile
// provider; that is a URL change here, nothing else.

const LEAFLET = 'https://unpkg.com/leaflet@1.9.4/dist';

// markers: [{ lat, lng, label, colour }]
// circles: [{ lat, lng, radiusKm, colour }]
// pickable: a tap anywhere reports { lat, lng } back to the app.
export function mapHtml({ id, center, zoom = 14, markers = [], circles = [], pickable = false }) {
  const config = JSON.stringify({ id, center, zoom, markers, circles, pickable });
  return `<!doctype html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" />
<style>
  html, body, #map { height: 100%; margin: 0; }
  .lbl { background: #fff; border: 0; border-radius: 8px; padding: 2px 6px; font: 600 11px system-ui, sans-serif; box-shadow: 0 1px 4px rgba(0,0,0,.25); }
  .hint { position: absolute; z-index: 999; left: 8px; bottom: 22px; background: rgba(255,255,255,.92); border-radius: 8px; padding: 4px 8px; font: 12px system-ui, sans-serif; }
</style>
</head><body>
<div id="map"></div>
<script src="${LEAFLET}/leaflet.js"></script>
<script>
  var cfg = ${config};
  var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([cfg.center.lat, cfg.center.lng], cfg.zoom);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  var bounds = [];
  cfg.circles.forEach(function (c) {
    var circle = L.circle([c.lat, c.lng], { radius: c.radiusKm * 1000, color: c.colour, weight: 1.5, fillOpacity: 0.06 }).addTo(map);
    if (!cfg.markers.length) bounds.push(circle.getBounds());
  });

  var pick = null;
  function dot(m) {
    return L.circleMarker([m.lat, m.lng], { radius: 9, color: '#fff', weight: 3, fillColor: m.colour, fillOpacity: 1 });
  }
  cfg.markers.forEach(function (m) {
    var mk = dot(m).addTo(map);
    if (m.label) mk.bindTooltip(m.label, { permanent: true, direction: 'top', className: 'lbl', offset: [0, -8] });
    bounds.push(L.latLngBounds([m.lat, m.lng], [m.lat, m.lng]));
    if (m.pick) pick = mk;
  });

  if (bounds.length > 1) {
    var all = bounds[0];
    bounds.slice(1).forEach(function (b) { all = all.extend(b); });
    map.fitBounds(all, { padding: [36, 36], maxZoom: 16 });
  } else if (bounds.length === 1 && cfg.circles.length && !cfg.markers.length) {
    map.fitBounds(bounds[0]);
  }

  function send(msg) {
    msg.id = cfg.id;
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent) window.parent.postMessage(s, '*');
  }

  if (cfg.pickable) {
    var hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Gusa ramani kuweka pini';
    document.body.appendChild(hint);
    map.on('click', function (e) {
      var p = { lat: e.latlng.lat, lng: e.latlng.lng };
      if (pick) pick.setLatLng([p.lat, p.lng]);
      else pick = dot({ lat: p.lat, lng: p.lng, colour: '#1F7A5C' }).addTo(map);
      send({ type: 'pick', lat: p.lat, lng: p.lng });
    });
  }
</script>
</body></html>`;
}

// A neutral starting view when there is nothing to show yet: the first
// service zone, which comes from the server, so no city is written into
// the app.
export function centreFor({ markers = [], circles = [], fallback }) {
  if (markers.length) return { lat: markers[0].lat, lng: markers[0].lng };
  if (circles.length) return { lat: circles[0].lat, lng: circles[0].lng };
  return fallback ?? null;
}
