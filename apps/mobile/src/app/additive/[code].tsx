import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, View } from 'react-native';
import { formatNumber } from '@repo/core';
import { Badge, Card, ErrorState, IconButton, ListRow, Notice, Row, Screen, Skeleton, Text } from '@/components/ui';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

export default function AdditiveScreen() {
  const { t, f, locale } = useT();
  const { code } = useLocalSearchParams<{ code: string }>();
  const additive = useQuery({ queryKey: ['additive', code], queryFn: () => apiClient().getAdditive(code) });
  const a = additive.data;
  const name = a ? (locale === 'en' ? (a.nameEn ?? a.nameEs) : (a.nameEs ?? a.nameEn)) : null;
  const note = a ? (locale === 'en' ? a.editorialNoteEn : a.editorialNoteEs) : null;

  return (
    <Screen>
      <Row style={{ paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
      </Row>
      {additive.isLoading ? (
        <Skeleton height={40} width="60%" style={{ marginTop: space.md }} />
      ) : additive.isError || !a ? (
        <ErrorState message={errorMessage(additive.error, t)} onRetry={() => additive.refetch()} retryLabel={t.common.retry} />
      ) : (
        <View style={{ gap: space.md, marginTop: space.md }}>
          <View>
            <Text variant="largeTitle">{a.eNumber}</Text>
            {name ? (
              <Text variant="section" color="textSecondary">
                {name}
              </Text>
            ) : null}
          </View>
          <Row gap={space.xs} style={{ flexWrap: 'wrap' }}>
            {a.classes.map((c) => (
              <Badge key={c} text={t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c} />
            ))}
          </Row>
          {a.reviewStatus !== 'reviewed' && <Notice tone="info" text={t.additive.notReviewed} />}
          {note ? <Notice tone="warning" text={note} /> : <Text variant="secondary" color="textSecondary">{t.additive.noEvidence}</Text>}
          {a.efsa && (
            <Card style={{ gap: space.sm }}>
              <Text variant="cardTitle">{t.additive.efsa}</Text>
              {a.efsa.title ? (
                <Text variant="body">
                  {a.efsa.title}
                  {a.efsa.date ? ` (${a.efsa.date.slice(0, 4)})` : ''}
                </Text>
              ) : null}
              {a.efsa.adiMgPerKgBw != null && (
                <Text variant="body">
                  {t.additive.adi}: {f(t.additive.adiValue, { value: formatNumber(a.efsa.adiMgPerKgBw, locale, 3) })}
                </Text>
              )}
              {a.efsa.exposureAboveAdiGroups.length > 0 && (
                <Text variant="secondary" color="textSecondary">
                  {f(t.additive.exposure, {
                    groups: a.efsa.exposureAboveAdiGroups.map((g) => t.additive.groups[g as keyof typeof t.additive.groups] ?? g).join(', '),
                  })}
                </Text>
              )}
              <Text variant="caption" color="textTertiary">
                {t.additive.efsaNote}
              </Text>
            </Card>
          )}
          {a.sources.length > 0 && (
            <Card style={{ paddingVertical: 0 }}>
              {a.sources.map((s) => (
                <ListRow
                  key={s.url ?? s.title}
                  title={s.title}
                  subtitle={[s.publisher, s.publishedOn?.slice(0, 4)].filter(Boolean).join(' · ')}
                  onPress={s.url ? () => Linking.openURL(s.url!) : undefined}
                />
              ))}
            </Card>
          )}
          <Text variant="caption" color="textTertiary">
            Open Food Facts (ODbL) · {t.disclaimer.notMedical}
          </Text>
        </View>
      )}
    </Screen>
  );
}
