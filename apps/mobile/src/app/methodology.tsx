import { router } from 'expo-router';
import { View } from 'react-native';
import { FUDYU_SCORE_VERSION, SCORE_LEVELS } from '@repo/core';
import { scaleTone } from '@repo/design';
import { Card, IconButton, Row, Screen, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';

const RANGES = { excellent: '80–100', good: '60–79', fair: '40–59', poor: '20–39', limit: '0–19' } as const;

/** Fudyu Score methodology, one tap from every score. Full version: docs/fudyu-score.md. */
export default function MethodologyScreen() {
  const { t, f } = useT();
  const p = usePalette();
  const m = t.methodology;
  const sections: [string, string][] = [
    [m.step1Title, m.step1Body],
    [m.step2Title, m.step2Body],
    [m.step3Title, m.step3Body],
    [m.personalTitle, m.personalBody],
    [m.sourcesTitle, m.sourcesBody],
  ];
  return (
    <Screen>
      <Row style={{ paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
      </Row>
      <Text variant="largeTitle" style={{ marginTop: space.md }} accessibilityRole="header">
        {m.title}
      </Text>
      <Text variant="body" color="textSecondary" style={{ marginTop: space.xs }}>
        {m.intro}
      </Text>
      <Card style={{ marginTop: space.lg, gap: space.sm }}>
        <Text variant="bodyStrong">{m.levelsTitle}</Text>
        {SCORE_LEVELS.map((level) => {
          const tone = scaleTone(p, level);
          return (
            <View key={level} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ width: 64, paddingVertical: 4, borderRadius: 999, backgroundColor: tone.soft, alignItems: 'center' }}>
                <Text variant="caption" style={{ color: tone.text, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {RANGES[level]}
                </Text>
              </View>
              <Text variant="secondaryStrong">{t.score.levels[level]}</Text>
            </View>
          );
        })}
      </Card>
      {sections.map(([title, body]) => (
        <View key={title} style={{ marginTop: space.lg, gap: 4 }}>
          <Text variant="cardTitle">{title}</Text>
          <Text variant="body" color="textSecondary">
            {body}
          </Text>
        </View>
      ))}
      <Text variant="caption" color="textTertiary" style={{ marginTop: space.lg }}>
        {f(m.version, { version: FUDYU_SCORE_VERSION })} · {t.disclaimer.notMedical}
      </Text>
    </Screen>
  );
}
