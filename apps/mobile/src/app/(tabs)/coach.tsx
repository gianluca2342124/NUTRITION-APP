import { router } from 'expo-router';
import { View } from 'react-native';
import { FudyuCharacter } from '@/components/art';
import { GlassSurface } from '@/components/glass';
import { Icon, type IconName } from '@/components/icons';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

/**
 * The Nutrition Coach is the next phase. This tab shows where it will live and
 * what it will do — without simulating a conversation or answers — and points
 * to the tools that already work.
 */
export default function CoachScreen() {
  const { t } = useT();
  const p = usePalette();
  const capabilities: [IconName, string][] = [
    ['book', t.coach.capabilityLog],
    ['compare', t.coach.capabilityCompare],
    ['flask', t.coach.capabilityExplain],
  ];
  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm }}>
        <Text variant="largeTitle">{t.coach.title}</Text>
        <View style={{ backgroundColor: p.primarySoft, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 6 }}>
          <Text variant="caption" color="primaryText" style={{ fontWeight: '700' }}>
            {t.coach.comingSoon}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'center', marginTop: space.xl, gap: space.md }}>
        <FudyuCharacter expression="thinking" size={104} />
        <Text variant="body" color="textSecondary" align="center" style={{ maxWidth: 320 }}>
          {t.coach.body}
        </Text>
      </View>

      <Card style={{ marginTop: space.lg, gap: space.md }}>
        {capabilities.map(([icon, text]) => (
          <View key={text} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={20} color={p.primaryText} />
            </View>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </Card>

      <Text variant="cardTitle" style={{ marginTop: space.xl, marginBottom: space.sm }}>
        {t.coach.meanwhile}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button title={t.scan.modeVoice} icon="mic" variant="soft" size="md" style={{ flex: 1 }} onPress={() => router.push('/voice')} />
        <Button title={t.compare.title} icon="compare" variant="soft" size="md" style={{ flex: 1 }} onPress={() => router.push('/compare')} />
      </View>

      {/* The future composer, shown disabled: nothing here pretends to answer. */}
      <View style={{ marginTop: space.xl, opacity: 0.6 }} accessibilityState={{ disabled: true }} accessible accessibilityLabel={t.coach.notAvailable}>
        <GlassSurface radius={radius.pill} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 54, paddingHorizontal: space.md }}>
          <Icon name="coach" size={20} color={p.textTertiary} />
          <Text variant="body" color="textTertiary" style={{ flex: 1 }}>
            {t.coach.composerPlaceholder}
          </Text>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.surfaceMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={18} color={p.textTertiary} />
          </View>
        </GlassSurface>
      </View>
      <Text variant="caption" color="textTertiary" align="center" style={{ marginTop: space.sm }}>
        {t.coach.notAvailable}
      </Text>
    </Screen>
  );
}
