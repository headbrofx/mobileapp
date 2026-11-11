import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui';
import { ActionButton } from './care-ui';
import { colors, font, fs, radius, spacing, type } from './theme';
import { tx } from './i18n';

// A nurse's visit report, drawn the same way for the client who reads
// it and the office that prints it. One component, so the two never
// disagree about what a report says.

export const VITAL_TYPES = [
  { type: 'BLOOD_PRESSURE', label: 'Presha (BP)', unit: 'mmHg', pair: true },
  { type: 'TEMPERATURE', label: 'Joto', unit: '°C' },
  { type: 'HEART_RATE', label: 'Mapigo ya moyo', unit: 'bpm' },
  { type: 'OXYGEN_SATURATION', label: 'Oksijeni (SpO2)', unit: '%' },
  { type: 'BLOOD_GLUCOSE', label: 'Sukari', unit: 'mmol/L' },
  { type: 'WEIGHT', label: 'Uzito', unit: 'kg' },
];

const LABEL = Object.fromEntries(VITAL_TYPES.map((v) => [v.type, v.label]));

const dateSw = (value, withTime = false) =>
  value
    ? new Date(value).toLocaleString('sw-TZ', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '—';

function Section({ title, children }) {
  if (!children) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

export function VisitReportView({ report, printable = true }) {
  if (!report) return null;
  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="document-text" size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{tx('Ripoti ya ziara')}</Text>
          <Text style={styles.meta}>
            {report.reference} · {dateSw(report.checkInAt, true)}
          </Text>
        </View>
        <View style={[styles.badge, report.status !== 'FINAL' && styles.badgeDraft]}>
          <Text style={[styles.badgeText, report.status !== 'FINAL' && styles.badgeTextDraft]}>
            {report.status === 'FINAL' ? tx('Imekamilika') : tx('Rasimu')}
          </Text>
        </View>
      </View>

      <View style={styles.facts}>
        <Fact label={tx('Mgonjwa')} value={report.patient?.name} />
        <Fact label={tx('Muuguzi')} value={report.nurse?.name} />
        <Fact label={tx('Huduma')} value={report.service} />
      </View>

      {report.vitals?.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tx('Vipimo')}</Text>
          <View style={styles.vitals}>
            {report.vitals.map((v) => (
              <View key={v.measurementId ?? `${v.type}-${v.summary}`} style={styles.vital}>
                <Text style={styles.vitalValue}>{v.summary}</Text>
                <Text style={styles.vitalLabel}>{tx(LABEL[v.type] ?? v.type)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <Section title={tx('Tathmini ya muuguzi')}>{report.assessment}</Section>
      <Section title={tx('Huduma iliyotolewa')}>{report.treatmentNotes}</Section>
      <Section title={tx('Mapendekezo')}>{report.recommendations}</Section>
      {report.followUpDate ? <Section title={tx('Ziara ijayo')}>{dateSw(report.followUpDate)}</Section> : null}

      {printable ? (
      <View style={styles.actions}>
        <ActionButton variant="ghost" icon={Platform.OS === 'web' ? 'print-outline' : 'share-outline'} title={Platform.OS === 'web' ? tx('Chapisha / PDF') : tx('Shiriki ripoti')} onPress={() => printReport(report)} />
      </View>
      ) : null}
    </Card>
  );
}

function Fact({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

// --- Print / share --------------------------------------------------
//
// On web, a clean one-page document opens and the browser's print
// dialog takes it from there, where "Save as PDF" is one of the
// printers. On a phone, the report goes to the share sheet as text, so
// it can be sent on WhatsApp or saved. No PDF library is shipped for
// this: the browser already is one.

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');

function asText(r) {
  const lines = [
    `AFYA NYUMBANI — ${tx('Ripoti ya ziara')}`,
    `${r.reference} · ${dateSw(r.checkInAt, true)}`,
    `${tx('Mgonjwa')}: ${r.patient?.name ?? '—'}`,
    `${tx('Muuguzi')}: ${r.nurse?.name ?? '—'}`,
    `${tx('Huduma')}: ${r.service ?? '—'}`,
    '',
  ];
  if (r.vitals?.length) {
    lines.push(`${tx('Vipimo')}:`);
    r.vitals.forEach((v) => lines.push(`  • ${tx(LABEL[v.type] ?? v.type)}: ${v.summary}`));
    lines.push('');
  }
  if (r.assessment) lines.push(`${tx('Tathmini ya muuguzi')}:`, r.assessment, '');
  if (r.treatmentNotes) lines.push(`${tx('Huduma iliyotolewa')}:`, r.treatmentNotes, '');
  if (r.recommendations) lines.push(`${tx('Mapendekezo')}:`, r.recommendations, '');
  if (r.followUpDate) lines.push(`${tx('Ziara ijayo')}: ${dateSw(r.followUpDate)}`);
  return lines.join('\n');
}

export async function printReport(r) {
  if (Platform.OS !== 'web') {
    await Share.share({ message: asText(r), title: `${tx('Ripoti ya ziara')} ${r.reference}` });
    return;
  }
  const row = (label, value) => (value ? `<tr><th>${esc(label)}</th><td>${esc(value)}</td></tr>` : '');
  const block = (label, value) => (value ? `<h3>${esc(label)}</h3><p>${esc(value)}</p>` : '');
  const vitals = r.vitals?.length
    ? `<h3>${esc(tx('Vipimo'))}</h3><table class="v">${r.vitals
        .map((v) => `<tr><th>${esc(tx(LABEL[v.type] ?? v.type))}</th><td>${esc(v.summary)}</td></tr>`)
        .join('')}</table>`
    : '';
  const html = `<!doctype html><html lang="sw"><head><meta charset="utf-8"/>
<title>${esc(tx('Ripoti ya ziara'))} ${esc(r.reference)}</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#2B2B2B;max-width:720px;margin:32px auto;padding:0 24px;line-height:1.5}
 header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #2B2B2B;padding-bottom:10px;margin-bottom:18px}
 h1{font-size:20px;margin:0} .ref{font-size:13px;color:#555}
 h3{font-size:13px;text-transform:uppercase;letter-spacing:.5px;color:#555;margin:20px 0 6px}
 p{margin:0} table{border-collapse:collapse;width:100%} th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e3e3e3;font-size:14px}
 th{width:40%;color:#555;font-weight:600} .status{font-size:12px;padding:3px 8px;border:1px solid #2B2B2B;border-radius:12px}
 footer{margin-top:32px;font-size:11px;color:#777;border-top:1px solid #e3e3e3;padding-top:10px}
 @media print{body{margin:0}}
</style></head><body>
<header><div><h1>Afya Nyumbani — ${esc(tx('Ripoti ya ziara'))}</h1><div class="ref">${esc(r.reference)}</div></div>
<span class="status">${esc(r.status === 'FINAL' ? tx('Imekamilika') : tx('Rasimu'))}</span></header>
<table>
${row(tx('Mgonjwa'), r.patient?.name)}
${row(tx('Huduma'), r.service)}
${row(tx('Muuguzi'), r.nurse?.name)}
${row(tx('Mahali'), r.place)}
${row(tx('Alianza'), dateSw(r.checkInAt, true))}
${row(tx('Alimaliza'), r.checkOutAt ? dateSw(r.checkOutAt, true) : '')}
</table>
${vitals}
${block(tx('Tathmini ya muuguzi'), r.assessment)}
${block(tx('Huduma iliyotolewa'), r.treatmentNotes)}
${block(tx('Mapendekezo'), r.recommendations)}
${r.followUpDate ? block(tx('Ziara ijayo'), dateSw(r.followUpDate)) : ''}
<footer>${esc(tx('Ripoti hii ni ya siri. Imetolewa kutoka mfumo wa Afya Nyumbani'))} · ${esc(new Date().toLocaleString('sw-TZ'))}</footer>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
  const win = globalThis.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginTop: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.bodyStrong, fontFamily: font.bold, color: colors.text },
  meta: { ...type.small, color: colors.muted },
  badge: { backgroundColor: colors.successBg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDraft: { backgroundColor: colors.cautionBg },
  badgeText: { ...type.tiny, fontFamily: font.bold, color: colors.success },
  badgeTextDraft: { color: colors.caution },
  facts: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.hairline, paddingTop: spacing.xs },
  fact: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: 4 },
  factLabel: { ...type.small, color: colors.muted },
  factValue: { ...type.small, fontFamily: font.semibold, color: colors.text, flexShrink: 1, textAlign: 'right' },
  section: { marginTop: spacing.md },
  sectionTitle: { ...type.tiny, fontFamily: font.bold, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBody: { ...type.body, color: colors.text, marginTop: 4 },
  vitals: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  vital: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  vitalValue: { fontSize: fs(16), fontFamily: font.bold, color: colors.text },
  vitalLabel: { ...type.tiny, color: colors.muted },
  actions: { flexDirection: 'row', marginTop: spacing.md },
});
