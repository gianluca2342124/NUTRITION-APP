import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AiConsentSheet, useAiConsent } from '@/components/ai-consent';
import { Icon } from '@/components/icons';
import { Button, Card, Field, IconButton, Notice, PressableScale, Row, Screen, Text, haptic } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { fileForm } from '@/lib/images';
import { today, useHealth } from '@/lib/queries';
import { draftStore } from '@/lib/stores';
import { shadow, space, usePalette } from '@/lib/theme';

type Phase = 'idle' | 'recording' | 'transcribing' | 'interpreting';

export default function VoiceScreen() {
  const { t } = useT();
  const p = usePalette();
  const params = useLocalSearchParams<{ meal?: string; typed?: string }>();
  const health = useHealth();
  const consent = useAiConsent();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [askConsent, setAskConsent] = useState<null | (() => void)>(null);
  const [source, setSource] = useState<'voice' | 'text'>(params.typed ? 'text' : 'voice');

  const dictationAvailable = health.data?.services.transcription === true;

  const withConsent = (action: () => void) => {
    if (consent.granted) action();
    else setAskConsent(() => action);
  };

  const startRecording = async () => {
    setError(null);
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError(t.voice.micPermission);
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    haptic.light();
    setPhase('recording');
  };

  const stopRecording = async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    if (!uri) {
      setPhase('idle');
      return;
    }
    setPhase('transcribing');
    try {
      const ext = Platform.OS === 'web' ? 'webm' : 'm4a';
      const form = await fileForm('audio', uri, `recording.${ext}`, Platform.OS === 'web' ? 'audio/webm' : 'audio/m4a');
      const result = await apiClient().transcribe(form);
      setText(result.text);
      setSource('voice');
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setPhase('idle');
    }
  };

  const interpret = async () => {
    if (text.trim().length < 2) return;
    setError(null);
    setPhase('interpreting');
    try {
      const draft = await apiClient().parseMealText(text.trim(), source, today());
      draftStore.set({ draft: { ...draft, mealType: (params.meal as typeof draft.mealType) || draft.mealType }, photoUri: null });
      router.replace('/review');
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setPhase('idle');
    }
  };

  const recording = recorderState.isRecording || phase === 'recording';

  return (
    <Screen edges={['top', 'bottom']} bottomInset={40}>
      <Row style={{ justifyContent: 'space-between', paddingTop: space.sm }}>
        <Text variant="title" style={{ flex: 1 }}>
          {t.voice.title}
        </Text>
        <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
      </Row>
      <Text variant="body" color="textSecondary" style={{ marginTop: space.xs }}>
        {t.voice.hint}
      </Text>

      {dictationAvailable ? (
        <View style={{ alignItems: 'center', marginVertical: space.xxl, gap: space.md }}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={recording ? t.voice.tapToStop : t.voice.tapToSpeak}
            onPress={() => withConsent(recording ? stopRecording : startRecording)}
            disabled={phase === 'transcribing' || phase === 'interpreting'}
            style={[
              { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: recording ? p.error : p.primary },
              shadow(p, 'floating'),
            ]}
          >
            <Icon name="mic" size={48} color={p.onPrimary} />
          </PressableScale>
          <Text variant="bodyStrong" color="textSecondary">
            {phase === 'transcribing' ? t.voice.transcribing : recording ? t.voice.listening : t.voice.tapToSpeak}
          </Text>
        </View>
      ) : (
        <View style={{ marginVertical: space.lg }}>
          {!health.isLoading && <Notice tone="info" text={t.voice.transcriptionUnavailable} />}
        </View>
      )}

      <Card style={{ gap: space.sm }}>
        <Text variant="secondaryStrong" color="textSecondary">
          {text && source === 'voice' ? t.voice.transcriptLabel : t.voice.typePlaceholder}
        </Text>
        <Field
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (!v) setSource('text');
          }}
          placeholder={t.voice.typePlaceholder}
          multiline
          maxLength={1000}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
        {error && <Notice tone="error" text={error} />}
        <Button
          title={phase === 'interpreting' ? t.voice.interpreting : t.voice.send}
          icon="coach"
          loading={phase === 'interpreting'}
          disabled={text.trim().length < 2 || phase !== 'idle'}
          onPress={() => withConsent(interpret)}
        />
      </Card>
      {phase === 'transcribing' && <ActivityIndicator color={p.primary} style={{ marginTop: space.md }} />}

      <AiConsentSheet
        visible={askConsent != null}
        onCancel={() => setAskConsent(null)}
        onDone={() => {
          const action = askConsent;
          setAskConsent(null);
          action?.();
        }}
      />
    </Screen>
  );
}
