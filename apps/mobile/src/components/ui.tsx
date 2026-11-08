import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { motion } from '@repo/design';
import { Icon, type IconName } from './icons';
import { radius, shadow, space, typography, usePalette, type Palette } from '@/lib/theme';

export const haptic = {
  light: () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  success: () => Platform.OS !== 'web' && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  selection: () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => undefined),
};

/* ---------------------------------- text ---------------------------------- */

type ColorKey = keyof Palette;

export function Text({
  variant = 'body',
  color = 'ink',
  align,
  style,
  ...rest
}: TextProps & { variant?: keyof typeof typography; color?: ColorKey; align?: TextStyle['textAlign'] }) {
  const p = usePalette();
  const t = typography[variant];
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      {...rest}
      style={[
        { fontSize: t.fontSize, lineHeight: t.lineHeight, fontWeight: t.fontWeight, letterSpacing: t.letterSpacing, color: p[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

/* --------------------------------- layout --------------------------------- */

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  padded = true,
  bottomInset = 120,
  contentStyle,
  ...scrollProps
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  bottomInset?: number;
  contentStyle?: StyleProp<ViewStyle>;
} & ScrollViewProps) {
  const p = usePalette();
  const inner = [{ paddingHorizontal: padded ? space.md : 0, paddingBottom: bottomInset }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: p.background }}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} {...scrollProps}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const p = usePalette();
  return (
    <View
      style={[
        { backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
        shadow(p, 'card'),
        padded && { padding: space.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({ children, gap = space.xs, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Spacer({ size = space.md }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  style,
}: {
  title: string;
  subtitle?: string;
  /** Either a custom node or a text label used with `onAction`. */
  action?: ReactNode;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Row style={[{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: space.xl, marginBottom: space.sm }, style]}>
      <View style={{ flex: 1 }}>
        <Text variant="section" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof action === 'string' && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text variant="secondaryStrong" color="primaryText">
            {action}
          </Text>
        </Pressable>
      ) : (
        action
      )}
    </Row>
  );
}

/* -------------------------------- pressables ------------------------------- */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ children, style, onPressIn, onPressOut, ...rest }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        scale.set(withSpring(0.97, motion.spring));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, motion.spring));
        onPressOut?.(e);
      }}
      style={[style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'lg',
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'lg' | 'md';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const p = usePalette();
  const colors: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: p.primary, fg: p.onPrimary },
    soft: { bg: p.primarySoft, fg: p.primaryText },
    secondary: { bg: p.surface, fg: p.ink, border: p.borderStrong },
    ghost: { bg: 'transparent', fg: p.primaryText },
    danger: { bg: p.errorSoft, fg: p.errorText },
  };
  const c = colors[variant];
  const inactive = disabled || loading;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        haptic.light();
        onPress?.();
      }}
      style={[
        {
          minHeight: size === 'lg' ? 54 : 44,
          paddingHorizontal: size === 'lg' ? space.xl : space.md,
          borderRadius: radius.pill,
          backgroundColor: c.bg,
          borderWidth: c.border ? 1 : 0,
          borderColor: c.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.xs,
          opacity: disabled ? 0.45 : 1,
        },
        variant === 'primary' && shadow(p, 'card'),
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={c.fg} /> : icon ? <Icon name={icon} size={20} color={c.fg} /> : null}
      <Text variant={size === 'lg' ? 'bodyStrong' : 'secondaryStrong'} style={{ color: c.fg }}>
        {title}
      </Text>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'surface',
  size = 44,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'surface' | 'primary' | 'soft' | 'clear';
  size?: number;
}) {
  const p = usePalette();
  const bg = tone === 'primary' ? p.primary : tone === 'surface' ? p.surface : tone === 'soft' ? p.primarySoft : 'transparent';
  const fg = tone === 'primary' ? p.onPrimary : tone === 'soft' ? p.primaryText : p.ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.light();
        onPress();
      }}
      hitSlop={8}
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' },
        tone === 'surface' && { borderWidth: StyleSheet.hairlineWidth, borderColor: p.border },
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.48)} color={fg} />
    </PressableScale>
  );
}

/** Selectable card/pill used for answers and filters. */
export function Choice({
  label,
  hint,
  selected,
  onPress,
  compact,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole={compact ? 'button' : 'checkbox'}
      accessibilityState={{ checked: selected, selected }}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={{
        paddingVertical: compact ? space.xs : space.md,
        paddingHorizontal: compact ? space.md : space.lg,
        borderRadius: compact ? radius.pill : radius.md,
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? p.primary : p.border,
        backgroundColor: selected ? p.primarySoft : p.surface,
        minHeight: compact ? 40 : 56,
        justifyContent: 'center',
      }}
    >
      <Text variant={compact ? 'secondaryStrong' : 'bodyStrong'} style={{ color: selected ? p.primaryText : p.ink }}>
        {label}
      </Text>
      {hint ? (
        <Text variant="secondary" color="textSecondary" style={{ marginTop: 2 }}>
          {hint}
        </Text>
      ) : null}
    </PressableScale>
  );
}

/** Filter capsule (single row of horizontally scrollable choices). */
export function Chip({ label, selected, onPress, icon }: { label: string; selected: boolean; onPress: () => void; icon?: IconName }) {
  const p = usePalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 38,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        backgroundColor: selected ? p.primary : p.surface,
        borderWidth: selected ? 0 : StyleSheet.hairlineWidth,
        borderColor: p.borderStrong,
      }}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? p.onPrimary : p.textSecondary} /> : null}
      <Text variant="secondaryStrong" style={{ color: selected ? p.onPrimary : p.ink }}>
        {label}
      </Text>
    </PressableScale>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const p = usePalette();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: p.surfaceMuted, borderRadius: radius.pill, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic.selection();
              onChange(o.value);
            }}
            style={[
              { flex: 1, minHeight: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
              active && [{ backgroundColor: p.surface }, shadow(p, 'card')],
            ]}
          >
            <Text variant="secondaryStrong" color={active ? 'ink' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* --------------------------------- inputs --------------------------------- */

export function Field({ label, suffix, style, ...rest }: TextInputProps & { label?: string; suffix?: string }) {
  const p = usePalette();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="secondaryStrong" color="textSecondary">
          {label}
        </Text>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: p.border,
          backgroundColor: p.surface,
          paddingHorizontal: space.md,
        }}
      >
        <TextInput
          placeholderTextColor={p.textTertiary}
          maxFontSizeMultiplier={1.6}
          {...rest}
          style={[{ flex: 1, fontSize: 17, color: p.ink, paddingVertical: space.sm }, style]}
        />
        {suffix ? (
          <Text variant="secondary" color="textSecondary">
            {suffix}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/* --------------------------------- states --------------------------------- */

export function Notice({ tone = 'info', text, icon }: { tone?: 'info' | 'warning' | 'error' | 'success'; text: string; icon?: IconName }) {
  const p = usePalette();
  const styles = {
    info: { bg: p.primarySoft, fg: p.primaryText, icon: 'info' as const },
    warning: { bg: p.warningSoft, fg: p.warningText, icon: 'alert' as const },
    error: { bg: p.errorSoft, fg: p.errorText, icon: 'alert' as const },
    success: { bg: p.secondarySoft, fg: p.secondaryText, icon: 'check' as const },
  }[tone];
  return (
    <View
      accessibilityRole="text"
      style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-start', backgroundColor: styles.bg, borderRadius: radius.md, padding: space.sm }}
    >
      <Icon name={icon ?? styles.icon} size={18} color={styles.fg} />
      <Text variant="secondary" style={{ color: styles.fg, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.lg, gap: space.sm }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={30} color={p.primaryText} />
      </View>
      <Text variant="cardTitle" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="secondary" color="textSecondary" align="center">
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, retryLabel }: { message: string; onRetry?: () => void; retryLabel: string }) {
  return (
    <View style={{ gap: space.sm, paddingVertical: space.lg }}>
      <Notice tone="error" text={message} />
      {onRetry ? <Button title={retryLabel} variant="secondary" size="md" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function Skeleton({ height = 20, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[{ height, width, borderRadius: radius.sm, backgroundColor: p.surfaceMuted }, style]} />;
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  leading,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
}) {
  const p = usePalette();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, minHeight: 52 }}>
      {leading}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Icon name="chevronRight" size={18} color={p.textTertiary} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

/** Non-interactive label (never looks like a button). */
export function Badge({ text, tone = 'primary' }: { text: string; tone?: 'primary' | 'neutral' | 'warning' }) {
  const p = usePalette();
  const c = {
    primary: { bg: p.primarySoft, fg: p.primaryText },
    neutral: { bg: p.surfaceMuted, fg: p.textSecondary },
    warning: { bg: p.warningSoft, fg: p.warningText },
  }[tone];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 6 }}>
      <Text variant="secondaryStrong" style={{ color: c.fg }}>
        {text}
      </Text>
    </View>
  );
}
