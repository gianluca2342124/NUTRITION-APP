import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { normalizeBarcode } from '@repo/core';
import { motion } from '@repo/design';
import { AiConsentSheet, useAiConsent } from '@/components/ai-consent';
import { FudyuCharacter } from '@/components/art';
import { GlassSurface } from '@/components/glass';
import { ScanModeSwitch, ScannerControls, type ScanMode } from '@/components/scanner-controls';
import { Button, Card, Field, IconButton, Notice, Text, haptic } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { fileForm, prepareImage } from '@/lib/images';
import { trackScan } from '@/lib/queries';
import { addToCompare, draftStore, labelStore, manualLabelDraft } from '@/lib/stores';
import { radius, space, usePalette } from '@/lib/theme';

/**
 * Camera first: full-screen preview with minimal controls (close, mode,
 * capture, gallery, microphone). Food and barcode are the main modes; the
 * label mode is contextual (from a product that is not in the database) or
 * one tap away at the top.
 */
export default function ScanScreen() {
  const { t } = useT();
  const p = usePalette();
  const params = useLocalSearchParams<{ meal?: string; mode?: ScanMode; gtin?: string; compare?: string }>();
  const [mode, setMode] = useState<ScanMode>(params.mode ?? 'food');
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
    if (params.compare) {
      void addScannedToCompare(gtin);
      return;
    }
    router.replace({ pathname: '/product/[code]', params: { code: gtin, meal: params.meal ?? '', from: 'barcode' } });
  };

  // From "Comparar": look the product up and go straight back to the comparison.
  const addScannedToCompare = async (gtin: string) => {
    setBusy(t.scan.revealProduct);
    setError(null);
    try {
      const result = await apiClient().lookupProduct(gtin);
      if (result.status !== 'found') {
        setError(result.status === 'invalid_code' ? t.scan.invalidCode : t.product.notFoundTitle);
        scanned.current = false;
        return;
      }
      addToCompare(result.product.id);
      trackScan(result.product.id, 'barcode');
      router.back();
    } catch (e) {
      setError(errorMessage(e, t));
      scanned.current = false;
    } finally {
      setBusy(null);
    }
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
    setBusy(mode === 'label' ? t.scan.revealLabel : t.scan.revealFood);
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
    if (!asset) return;
    if (mode === 'barcode') setMode('food');
    await analyze({ uri: asset.uri, width: asset.width, height: asset.height });
  };

  const toVoice = () => router.replace({ pathname: '/voice', params: { meal: params.meal ?? '' } });
  const hint = mode === 'food' ? t.scan.foodHint : mode === 'barcode' ? t.scan.barcodeHint : t.scan.labelHint;
  const granted = permission?.granted === true;

  return (
    <View style={{ flex: 1, backgroundColor: '#0B1020' }}>
      {granted ? (
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
        {/* Top: close · label (secondary) */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.md }}>
          <IconButton icon="close" label={t.common.close} onPress={() => router.back()} />
          {granted ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: mode === 'label' }}
              onPress={() => {
                haptic.selection();
                setError(null);
                setMode(mode === 'label' ? 'food' : 'label');
              }}
            >
              <GlassSurface radius={radius.pill} style={{ paddingHorizontal: space.md, height: 40, justifyContent: 'center', backgroundColor: mode === 'label' ? 'rgba(255,255,255,0.95)' : undefined }}>
                <Text variant="secondaryStrong" style={{ color: mode === 'label' ? '#172033' : '#FFFFFF' }}>
                  {t.scan.modeLabel}
                </Text>
              </GlassSurface>
            </Pressable>
          ) : null}
        </View>

        {/* Middle: viewfinder or the one-line permission state */}
        {!permission ? null : !granted ? (
          <View style={{ paddingHorizontal: space.xl, alignItems: 'center', gap: space.lg }}>
            <FudyuCharacter expression="curious" size={88} />
            <Text variant="title" align="center" style={{ color: '#FFFFFF' }}>
              {t.scan.permissionShort}
            </Text>
            <View style={{ alignSelf: 'stretch', gap: space.sm }}>
              {permission.canAskAgain ? (
                <Button title={t.common.continue} onPress={requestPermission} />
              ) : Platform.OS !== 'web' ? (
                <Button title={t.scan.openSettings} onPress={() => Linking.openSettings()} />
              ) : null}
              <Button title={t.scan.pickPhoto} variant="secondary" icon="image" onPress={pick} />
            </View>
          </View>
        ) : busy ? null : (
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: mode === 'barcode' ? 280 : 300,
                height: mode === 'barcode' ? 160 : mode === 'label' ? 360 : 300,
                borderRadius: 32,
                borderWidth: 3,
                borderColor: 'rgba(255,255,255,0.92)',
              }}
            />
            <Text variant="bodyStrong" style={{ color: '#fff', marginTop: space.md, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 }}>
              {hint}
            </Text>
            {mode === 'barcode' ? (
              <Pressable accessibilityRole="button" onPress={() => setManual(true)} hitSlop={10} style={{ marginTop: space.sm }}>
                <Text variant="secondaryStrong" style={{ color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }}>
                  {t.scan.manualCodeLink}
                </Text>
              </Pressable>
            ) : mode === 'label' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  // No photo, no AI: the person types the values from the package.
                  labelStore.set({ draft: manualLabelDraft(), gtin: params.gtin || null, manual: true });
                  router.replace('/label');
                }}
                hitSlop={10}
                style={{ marginTop: space.sm }}
              >
                <Text variant="secondaryStrong" style={{ color: 'rgba(255,255,255,0.85)', textDecorationLine: 'underline' }}>
                  {t.scan.manualLabelLink}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Analysing: an elegant, honest wait */}
        {busy ? (
          <Animated.View entering={FadeIn.duration(motion.base)} style={{ alignItems: 'center', paddingHorizontal: space.xl }}>
            <GlassSurface radius={radius.xl} style={{ padding: space.xl, alignItems: 'center', gap: space.md, alignSelf: 'stretch' }}>
              <FudyuCharacter expression="thinking" size={76} />
              <Text variant="bodyStrong" align="center">
                {busy}
              </Text>
            </GlassSurface>
          </Animated.View>
        ) : null}

        {/* Bottom: errors, controls, mode switch */}
        <View style={{ padding: space.md, gap: space.lg }}>
          {error ? <Notice tone="error" text={error} /> : null}
          {granted && !busy ? (
            <>
              <ScannerControls showShutter={mode !== 'barcode'} onCapture={capture} onGallery={pick} onMic={toVoice} shutterLabel={hint} />
              <ScanModeSwitch
                mode={mode === 'label' ? 'food' : mode}
                onChange={(m) => {
                  setError(null);
                  setMode(m);
                }}
              />
            </>
          ) : null}
          {!granted && permission ? (
            <Pressable accessibilityRole="button" onPress={() => setManual(true)} style={{ alignSelf: 'center' }} hitSlop={10}>
              <Text variant="secondaryStrong" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {t.scan.manualCode}
              </Text>
            </Pressable>
          ) : null}
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
