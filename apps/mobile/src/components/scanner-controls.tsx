import { Pressable, View } from 'react-native';
import { GlassSurface } from './glass';
import { IconButton, PressableScale, Text, haptic } from './ui';
import { useT } from '@/lib/i18n';
import { radius, space } from '@/lib/theme';

export type ScanMode = 'food' | 'barcode' | 'label';

/** Two main modes in a glass capsule; the label mode is reached contextually. */
export function ScanModeSwitch({ mode, onChange }: { mode: ScanMode; onChange: (m: ScanMode) => void }) {
  const { t } = useT();
  const options: { value: ScanMode; label: string }[] = [
    { value: 'food', label: t.scan.modeFood },
    { value: 'barcode', label: t.scan.modeBarcode },
  ];
  return (
    <GlassSurface radius={radius.pill} style={{ flexDirection: 'row', padding: 4, alignSelf: 'center' }}>
      {options.map((o) => {
        const active = o.value === mode;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              haptic.selection();
              onChange(o.value);
            }}
            style={{
              minWidth: 104,
              height: 40,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.md,
              backgroundColor: active ? 'rgba(255,255,255,0.95)' : 'transparent',
            }}
          >
            <Text variant="secondaryStrong" style={{ color: active ? '#172033' : '#FFFFFF' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </GlassSurface>
  );
}

/** Gallery · shutter · microphone. The shutter is hidden while reading barcodes (automatic). */
export function ScannerControls({
  showShutter,
  onCapture,
  onGallery,
  onMic,
  shutterLabel,
}: {
  showShutter: boolean;
  onCapture: () => void;
  onGallery: () => void;
  onMic: () => void;
  shutterLabel: string;
}) {
  const { t } = useT();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xl }}>
      <IconButton icon="image" label={t.scan.pickFromLibrary} onPress={onGallery} size={52} />
      {showShutter ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={shutterLabel}
          onPress={() => {
            haptic.light();
            onCapture();
          }}
          style={{ width: 82, height: 82, borderRadius: 41, borderWidth: 5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF' }} />
        </PressableScale>
      ) : (
        <View style={{ width: 82, height: 82 }} />
      )}
      <IconButton icon="mic" label={t.scan.modeVoice} onPress={onMic} size={52} />
    </View>
  );
}
