import { Modal, View } from 'react-native';
import { Button, Card, Text } from './ui';
import { Icon } from './icons';
import { useT } from '@/lib/i18n';
import { useConsents, useRecordConsent } from '@/lib/queries';
import { space, usePalette } from '@/lib/theme';

/** True once the user agreed to send photos/text to the AI provider. */
export function useAiConsent() {
  const consents = useConsents();
  return { granted: consents.data?.ai_processing === true, loading: consents.isLoading };
}

/**
 * Explains, before first use, what is sent to the AI provider and why the
 * numbers do not come from the AI. Consent is recorded server-side.
 */
export function AiConsentSheet({ visible, onDone, onCancel }: { visible: boolean; onDone: () => void; onCancel: () => void }) {
  const { t } = useT();
  const p = usePalette();
  const record = useRecordConsent();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: p.scrim }}>
        <Card style={{ margin: space.sm, marginBottom: space.xl, padding: space.xl, gap: space.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="coach" size={28} color={p.primaryText} />
          </View>
          <Text variant="title">{t.scan.aiConsentTitle}</Text>
          <Text variant="body" color="textSecondary">
            {t.scan.aiConsentBody}
          </Text>
          <Button
            title={t.scan.aiConsentAccept}
            loading={record.isPending}
            onPress={async () => {
              await record.mutateAsync({ type: 'ai_processing', granted: true });
              onDone();
            }}
          />
          <Button title={t.common.cancel} variant="ghost" size="md" onPress={onCancel} />
        </Card>
      </View>
    </Modal>
  );
}
