import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatNumber } from '@repo/core';
import { getProductById, linkScanToEntry, type ProductScan } from '@repo/data';
import { AddToDiaryCard } from './add-to-diary';
import { FoodImage } from './food-image';
import { Icon, type IconName } from './icons';
import { BottomSheet } from './sheet';
import { Button, Notice, PressableScale, Skeleton, Text } from './ui';
import { entryTitle, markScanLinked, scanTitle, type FeedItem } from '@/lib/feed';
import { useT } from '@/lib/i18n';
import { matchFromProduct } from '@/lib/matches';
import { entryImage, useMealPhotoUrl } from '@/lib/media';
import { today } from '@/lib/queries';
import { radius, shadow, space, usePalette } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

type Status = 'logged' | 'scanned' | 'viewed';

function statusOf(item: FeedItem): Status {
  if (item.kind === 'entry') return 'logged';
  return item.scan.source === 'search' ? 'viewed' : 'scanned';
}

/** Small state chip: only logged items count towards the day. */
export function StatusChip({ status }: { status: Status }) {
  const p = usePalette();
  const { t } = useT();
  const logged = status === 'logged';
  const icon: IconName = logged ? 'check' : status === 'scanned' ? 'barcode' : 'eye';
  const fg = logged ? p.secondaryText : p.textSecondary;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: logged ? p.secondarySoft : p.surfaceMuted,
      }}
    >
      <Icon name={icon} size={11} color={fg} strokeWidth={2.4} />
      <Text variant="micro" style={{ color: fg, letterSpacing: 0.2 }}>
        {t.today.status[status]}
      </Text>
    </View>
  );
}

/** The user's own meal photo first, then real food/product photos, then art. */
function FeedThumb({ item, size }: { item: FeedItem; size: number }) {
  const entry = item.kind === 'entry' ? item.entry : null;
  const image = entry ? entryImage(entry) : null;
  const photo = useMealPhotoUrl(image?.photoPath ?? null);
  if (item.kind === 'scan') {
    return (
      <View style={{ width: size, height: size, borderRadius: 16, backgroundColor: '#FFFFFF', padding: 4, overflow: 'hidden' }}>
        <FoodImage uri={item.scan.product.imageUrl} fallback="product" width={size - 8} height={size - 8} radius={12} fit="contain" />
      </View>
    );
  }
  return <FoodImage uri={photo.data ?? image?.uri ?? null} fallback={image?.art && image.art !== 'other' ? image.art : 'lunch'} width={size} height={size} radius={16} />;
}

function SmallAction({ icon, label, onPress, tone = 'muted' }: { icon: IconName; label: string; onPress: () => void; tone?: 'muted' | 'danger' }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? (tone === 'danger' ? p.errorSoft : p.surfaceMuted) : 'transparent',
      })}
    >
      <Icon name={icon} size={17} color={p.textTertiary} />
    </Pressable>
  );
}

/**
 * One item of "Recientes": photo, name, time and state. Logged items show
 * their energy and can be edited; scanned ones can be added to the day.
 * Both can be removed (with undo).
 */
export function FeedItemCard({
  item,
  onOpen,
  onEdit,
  onAdd,
  onDelete,
}: {
  item: FeedItem;
  onOpen: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const p = usePalette();
  const { t, f, locale } = useT();
  const status = statusOf(item);
  const title = item.kind === 'entry' ? entryTitle(item.entry) : scanTitle(item.scan, locale);
  const brand = item.kind === 'scan' ? item.scan.product.brand : null;
  const time = new Date(item.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const kcal = item.kind === 'entry' ? item.entry.totals.values.energy_kcal : null;
  const estimate = item.kind === 'entry' && item.entry.items.some((i) => i.isEstimate);
  const a11y = [title, t.today.status[status], time, kcal != null ? `${formatNumber(kcal, locale)} kcal` : null].filter(Boolean).join('. ');

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: p.border, padding: space.xs, gap: space.xs },
        shadow(p, 'card'),
      ]}
    >
      <PressableScale accessibilityRole="button" accessibilityLabel={a11y} onPress={onOpen} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <FeedThumb item={item} size={56} />
        <View style={{ flex: 1, gap: 5 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {title}
            {brand ? (
              <Text variant="secondary" color="textTertiary">
                {` · ${brand}`}
              </Text>
            ) : null}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text variant="caption" color="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>
              {time}
            </Text>
            <StatusChip status={status} />
            {estimate ? (
              <Text variant="caption" color="textTertiary" numberOfLines={1}>
                {t.common.estimate}
              </Text>
            ) : null}
          </View>
        </View>
      </PressableScale>
      <View style={{ alignItems: 'flex-end', gap: 2, paddingRight: 2 }}>
        {item.kind === 'entry' ? (
          <Text variant="bodyStrong" style={{ fontVariant: ['tabular-nums'], paddingRight: 6 }}>
            {kcal == null ? '—' : formatNumber(kcal, locale)}
            <Text variant="caption" color="textSecondary">
              {' '}
              kcal
            </Text>
          </Text>
        ) : (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={f(t.today.addToDay, { name: title })}
            onPress={onAdd}
            disabled={!item.scan.product.nutritionAvailable}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 12,
              height: 32,
              borderRadius: radius.pill,
              backgroundColor: p.primarySoft,
              opacity: item.scan.product.nutritionAvailable ? 1 : 0.4,
            }}
          >
            <Icon name="plus" size={15} color={p.primaryText} strokeWidth={2.6} />
            <Text variant="caption" style={{ color: p.primaryText, fontWeight: '700' }}>
              {t.today.add}
            </Text>
          </PressableScale>
        )}
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {item.kind === 'entry' ? <SmallAction icon="edit" label={f(t.today.edit, { name: title })} onPress={onEdit} /> : null}
          <SmallAction icon="trash" tone="danger" label={f(t.today.delete, { name: title })} onPress={onDelete} />
        </View>
      </View>
    </View>
  );
}

/**
 * "Añadir al día" for a scanned product: compact amount picker, one tap to
 * confirm. Nothing is logged until the user confirms.
 */
export function ScanAddSheet({ scan, onClose }: { scan: ProductScan | null; onClose: () => void }) {
  const { t, locale } = useT();
  return (
    <BottomSheet visible={!!scan} onClose={onClose} title={t.product.addToDay}>
      {scan ? <ScanAddBody key={scan.id} scan={scan} locale={locale} onClose={onClose} /> : null}
    </BottomSheet>
  );
}

function ScanAddBody({ scan, locale, onClose }: { scan: ProductScan; locale: string; onClose: () => void }) {
  const { t } = useT();
  const qc = useQueryClient();
  const product = useQuery({ queryKey: ['product-id', scan.productId], queryFn: () => getProductById(supabase(), scan.productId), staleTime: 10 * 60_000 });
  const isToday = scan.scannedOn === today();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#FFFFFF', padding: 3 }}>
          <FoodImage uri={scan.product.imageUrl} fallback="product" width={46} height={46} radius={11} fit="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {scanTitle(scan, locale)}
          </Text>
          {scan.product.brand ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {scan.product.brand}
            </Text>
          ) : null}
        </View>
      </View>
      {product.isLoading ? (
        <Skeleton height={140} />
      ) : product.data?.nutritionAvailable ? (
        <AddToDiaryCard
          bare
          compact
          match={matchFromProduct(product.data, locale)}
          defaultGrams={product.data.servingQuantity ?? 100}
          netQuantity={product.data.netQuantity}
          method={scan.source === 'search' ? 'search' : 'barcode'}
          date={scan.scannedOn}
          consumedAt={isToday ? null : scan.scannedAt}
          onSaved={(entryId) => {
            markScanLinked(qc, scan.id, entryId);
            linkScanToEntry(supabase(), scan.id, entryId).catch(() => qc.invalidateQueries({ queryKey: ['scans'] }));
            setTimeout(onClose, 650);
          }}
        />
      ) : (
        <>
          <Notice tone="info" text={t.product.nutritionMissing} />
          <Button title={t.common.close} variant="soft" onPress={onClose} />
        </>
      )}
    </View>
  );
}
