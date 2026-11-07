import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeBarcode } from '@repo/core';
import { AiConsentSheet, useAiConsent } from '@/components/ai-consent';
import { GlassSurface } from '@/components/glass';
import { Icon } from '@/components/icons';
import { Button, Card, Field, IconButton, Notice, PressableScale, SegmentedControl, Text, haptic } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { fileForm, prepareImage } from '@/lib/images';
import { draftStore, labelStore } from '@/lib/stores';
import { space, usePalette } from '@/lib/theme';

type Mode = 'food' | 'barcode' | 'label';

export default function ScanScreen() {
  const { t } = useT();
  const p = usePalette();
  const params = useLocalSearchParams<{ meal?: string; mode?: Mode; gtin?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode ?? 'food');
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [pendingUri, setPendingUri] = useState<{ uri: string; width: number; height: number } | null>(null);
  const scanned = useRef(false);
  const consent = useAiConsent();

  const openProduct = (raw: string, type?: string) => {
    const gtin = normalizeBarcode(raw, type);
    if (!gtin) {
      setError(t.scan.invalidCode);
      return;
    }
    scanned.current = true;
    haptic.success();
    router.replace({ pathname: '/product/[code]', params: { code: gtin, meal: params.meal ?? '' } });
  };

  const onBarcode = (result: BarcodeScanningResult) => {
    if (scanned.current || mode !== 'barcode') return;
    if (normalizeBarcode(result.data, result.type)) openProduct(result.data, result.type);
  };

  const analyze = async (image: { uri: string; width: number; height: number }, consentJustGiven = false) => {
    if (!consent.granted && !consentJustGiven) {
      setPendingUri(image);
      return;
    }
    setError(null);
    setBusy(mode === 'label' ? t.scan.readingLabel : t.scan.analyzing);
    try {
      const prepared = await prepareImage(image.uri, image);
      const form = await fileForm('image', prepared.uri, 'photo.jpg', 'image/jpeg');
      if (mode === 'label') {
        const draft = await apiClient().extractLabel(form);
        labelStore.set({ draft, gtin: params.gtin ?? null });
        router.replace('/label');
      } else {
        const draft = await apiClient().analyzeMealPhoto(form);
        draftStore.set({ draft: { ...draft, mealType: (params.meal as typeof draft.mealType) || draft.mealType }, photoUri: prepared.uri });
        router.replace('/review');
      }
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(null);
    }
  };

  const capture = async () => {
    if (!camera.current || busy) return;
    haptic.light();
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.8, shutterSound: false });
      if (pic) await analyze({ uri: pic.uri, width: pic.width, height: pic.height });
    } catch (e) {
      setError(errorMessage(e, t));
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    const asset = res.canceled ? null : res.assets[0];
    if (asset) await analyze({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const hint = mode === 'food' ? t.scan.foodHint : mode === 'barcode' ? t.scan.barcodeHint : t.scan.labelHint;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {permission?.granted ? (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          active={!busy}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={mode === 'barcode' ? onBarcode : undefined}
        />
      ) : null}

      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.md }}>
          <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
          <IconButton icon="mic" label={t.scan.modeVoice} onPress={() => router.replace({ pathname: '/voice', params: { meal: params.meal ?? '' } })} />
        </View>

        {!permission ? null : !permission.granted ? (
          <Card style={{ margin: space.md, gap: space.md, padding: space.xl }}>
            <Icon name="camera" size={36} color={p.primary} />
            <Text variant="title">{t.scan.cameraPermissionTitle}</Text>
            <Text variant="body" color="textSecondary">
              {permission.canAskAgain ? t.scan.cameraPermissionBody : t.scan.cameraDenied}
            </Text>
            {permission.canAskAgain ? (
              <Button title={t.scan.cameraPermissionCta} onPress={requestPermission} />
            ) : (
              Platform.OS !== 'web' && <Button title={t.scan.openSettings} onPress={() => Linking.openSettings()} />
            )}
            <Button title={t.scan.pickFromLibrary} variant="secondary" icon="image" onPress={pick} />
            <Button title={t.scan.manualCode} variant="ghost" icon="keyboard" onPress={() => setManual(true)} />
          </Card>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: mode === 'barcode' ? 280 : 300,
                height: mode === 'barcode' ? 160 : 300,
                borderRadius: 28,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.9)',
              }}
            />
            <Text variant="bodyStrong" style={{ color: '#fff', marginTop: space.md, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>
              {hint}
            </Text>
          </View>
        )}

        <View style={{ padding: space.md, gap: space.md }}>
          {error && <Notice tone="error" text={error} />}
          {busy ? (
            <GlassSurface radius={24} style={{ padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <ActivityIndicator color={p.primary} />
              <Text variant="bodyStrong">{busy}</Text>
            </GlassSurface>
          ) : (
            <>
              {permission?.granted && mode !== 'barcode' && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
                  <IconButton icon="image" label={t.scan.pickFromLibrary} onPress={pick} />
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={hint}
                    onPress={capture}
                    style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 5, borderColor: '#fff', backgroundColor: 'rgba(255,255,255,0.25)' }}
                  />
                  <IconButton icon="keyboard" label={t.scan.typeInstead} onPress={() => router.replace({ pathname: '/voice', params: { meal: params.meal ?? '', typed: '1' } })} />
                </View>
              )}
              {permission?.granted && mode === 'barcode' && (
                <Button title={t.scan.manualCode} variant="secondary" icon="keyboard" onPress={() => setManual(true)} />
              )}
              <GlassSurface radius={24} style={{ padding: 4 }}>
                <SegmentedControl
                  value={mode}
                  onChange={(m) => {
                    setError(null);
                    setMode(m);
                  }}
                  options={[
                    { value: 'food', label: t.scan.modeFood },
                    { value: 'barcode', label: t.scan.modeBarcode },
                    { value: 'label', label: t.scan.modeLabel },
                  ]}
                />
              </GlassSurface>
            </>
          )}
        </View>
      </SafeAreaView>

      <Modal visible={manual} transparent animationType="fade" onRequestClose={() => setManual(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: space.md, backgroundColor: p.scrim }}>
          <Card style={{ gap: space.md, padding: space.xl }}>
            <Text variant="section">{t.scan.manualCode}</Text>
            <Field value={code} onChangeText={setCode} keyboardType="number-pad" placeholder="8410000000000" autoFocus maxLength={14} />
            <Button
              title={t.common.search}
              onPress={() => {
                setManual(false);
                openProduct(code);
              }}
            />
            <Button title={t.common.cancel} variant="ghost" size="md" onPress={() => setManual(false)} />
          </Card>
        </View>
      </Modal>

      <AiConsentSheet
        visible={pendingUri != null}
        onCancel={() => setPendingUri(null)}
        onDone={() => {
          const image = pendingUri;
          setPendingUri(null);
          if (image) setTimeout(() => analyze(image, true), 50);
        }}
      />
    </View>
  );
}
