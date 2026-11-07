import { router } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/icons';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';

/**
 * The Nutrition Coach is Phase 2. Rather than shipping a generic chatbot, this
 * tab says so honestly and points to the tools that already work.
 */
export default function CoachScreen() {
  const { t } = useT();
  const p = usePalette();
  return (
    <Screen>
      <Text variant="largeTitle" style={{ paddingTop: space.sm }}>
        {t.coach.title}
      </Text>
      <Card style={{ marginTop: space.lg, gap: space.md, padding: space.xl }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="coach" size={32} color={p.primaryText} />
        </View>
        <Text variant="secondaryStrong" color="primaryText">
          {t.coach.comingSoon}
        </Text>
        <Text variant="body" color="textSecondary">
          {t.coach.body}
        </Text>
        <Button title={t.scan.modeVoice} icon="mic" variant="secondary" onPress={() => router.push('/voice')} />
        <Button title={t.compare.title} icon="compare" variant="secondary" onPress={() => router.push('/compare')} />
      </Card>
    </Screen>
  );
}
