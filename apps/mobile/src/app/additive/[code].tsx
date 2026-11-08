import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, View } from 'react-native';
import { formatNumber, parseLocalDate, type Additive } from '@repo/core';
import { Collapsible } from '@/components/collapsible';
import { Icon, type IconName } from '@/components/icons';
import { Appear } from '@/components/motion';
import { Card, ErrorState, IconButton, ListRow, Row, Screen, Skeleton, Text } from '@/components/ui';
import { trackActivity } from '@/lib/activity';
import { apiClient } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useT } from '@/lib/i18n';
import { radius, space, usePalette } from '@/lib/theme';

const CLASS_ICONS: Record<string, IconName> = {
  colour: 'drop',
  sweetener: 'cube',
  preservative: 'clock',
  antioxidant: 'leaf',
  emulsifier: 'drop',
  thickener: 'drop',
  'gelling-agent': 'drop',
  stabiliser: 'drop',
};

/**
 * Additive sheet: understandable name, status, a short explanation and what
 * it means — then the evidence and the original sources on demand. Only
 * verifiable data; editorial workflow states are never shown here.
 */
export default function AdditiveScreen() {
  const { t } = useT();
  const { code } = useLocalSearchParams<{ code: string }>();
  const additive = useQuery({ queryKey: ['additive', code], queryFn: () => apiClient().getAdditive(code) });

  useEffect(() => {
    if (additive.data) trackActivity('ingredient_explored', additive.data.code);
  }, [additive.data]);

  return (
    <Screen>
      <Row style={{ paddingTop: space.sm }}>
        <IconButton icon="chevronLeft" label={t.common.back} onPress={() => router.back()} />
      </Row>
      {additive.isLoading ? (
        <View style={{ gap: space.md, marginTop: space.lg }}>
          <Skeleton height={72} width={72} style={{ borderRadius: 36 }} />
          <Skeleton height={34} width="70%" />
          <Skeleton height={90} />
        </View>
      ) : additive.isError || !additive.data ? (
        <ErrorState message={errorMessage(additive.error, t)} onRetry={() => additive.refetch()} retryLabel={t.common.retry} />
      ) : (
        <AdditiveDetail a={additive.data} />
      )}
    </Screen>
  );
}

function AdditiveDetail({ a }: { a: Additive }) {
  const { t, f, locale } = useT();
  const p = usePalette();
  const en = locale === 'en';
  const name = (en ? (a.nameEn ?? a.nameEs) : (a.nameEs ?? a.nameEn)) ?? a.eNumber;
  const classes = a.classes.map((c) => (t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c).toLowerCase());
  const summary = en ? a.summaryEn : a.summaryEs;
  const implication = en ? a.implicationEn : a.implicationEs;
  const statusNote = en ? a.euStatusNoteEn : a.euStatusNoteEs;
  const note = en ? a.editorialNoteEn : a.editorialNoteEs;
  const notAuthorised = a.euStatus === 'not_authorised';
  const exposure = a.efsa?.exposureAboveAdiGroups ?? [];
  const groups = exposure.map((g) => t.additive.groups[g as keyof typeof t.additive.groups] ?? g).join(', ');
  const icon = CLASS_ICONS[a.classes[0] ?? ''] ?? 'flask';

  // Short explanation: the editorial summary when written, otherwise facts composed from the data.
  const facts = [
    summary,
    !summary && classes.length ? f(t.additive.usedAs, { classes: classes.join(', ') }) : null,
    !notAuthorised && a.efsa?.adiMgPerKgBw != null ? f(t.additive.adiFact, { value: formatNumber(a.efsa.adiMgPerKgBw, locale, 3) }) : null,
  ].filter((x): x is string => !!x);
  const meaning = implication ?? (exposure.length && !notAuthorised ? f(t.additive.exposureFact, { groups }) : null);

  return (
    <View style={{ gap: space.lg, marginTop: space.md }}>
      <Appear index={0}>
        <View style={{ gap: space.md }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: notAuthorised ? p.scaleCoralSoft : p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={34} color={notAuthorised ? p.scaleCoralText : p.primaryText} />
          </View>
          <View>
            <Text variant="largeTitle" accessibilityRole="header">
              {name}
            </Text>
            <Text variant="section" color="textSecondary">
              {a.eNumber}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {notAuthorised ? (
              <StatusChip text={t.additive.statusNotAuthorised} bg={p.scaleCoralSoft} fg={p.scaleCoralText} />
            ) : (
              <>
                {a.classes.map((c) => (
                  <StatusChip key={c} text={t.additiveClasses[c as keyof typeof t.additiveClasses] ?? c} bg={p.primarySoft} fg={p.primaryText} />
                ))}
                {exposure.length ? <StatusChip text={t.additive.statusExposure} bg={p.scaleAmberSoft} fg={p.scaleAmberText} /> : null}
              </>
            )}
          </View>
        </View>
      </Appear>

      <Appear index={1}>
        <View style={{ gap: space.sm }}>
          {facts.length ? (
            facts.map((fact) => (
              <Text key={fact} variant="body">
                {fact}
              </Text>
            ))
          ) : (
            <Text variant="body" color="textSecondary">
              {t.additive.noData}
            </Text>
          )}
        </View>
      </Appear>

      {meaning ? (
        <Appear index={2}>
          <Card style={{ gap: space.xs, backgroundColor: notAuthorised ? p.scaleCoralSoft : p.surface }}>
            <Text variant="bodyStrong" style={{ color: notAuthorised ? p.scaleCoralText : p.ink }}>
              {t.additive.whatItMeans}
            </Text>
            <Text variant="secondary" style={{ color: notAuthorised ? p.scaleCoralText : p.textSecondary }}>
              {meaning}
            </Text>
          </Card>
        </Appear>
      ) : null}

      <View style={{ gap: space.sm }}>
        {notAuthorised && (statusNote || a.euStatusSince) ? (
          <Collapsible title={t.additive.regulationTitle} icon="book" summary={statusNote ?? null}>
            {statusNote ? (
              <Text variant="secondary" color="textSecondary">
                {statusNote}
              </Text>
            ) : null}
            {a.euStatusSince ? (
              <Text variant="caption" color="textTertiary">
                {parseLocalDate(a.euStatusSince).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })}
              </Text>
            ) : null}
          </Collapsible>
        ) : null}

        {a.efsa ? (
          <Collapsible
            title={t.additive.evidenceTitle}
            icon="flask"
            summary={a.efsa.date ? f(t.additive.evaluationYear, { year: a.efsa.date.slice(0, 4) }) : (a.efsa.title ?? null)}
          >
            {a.efsa.title ? <Text variant="secondaryStrong">{a.efsa.title}</Text> : null}
            {a.efsa.adiMgPerKgBw != null ? (
              <Text variant="secondary" color="textSecondary">
                {t.additive.adi}: {f(t.additive.adiValue, { value: formatNumber(a.efsa.adiMgPerKgBw, locale, 3) })}
              </Text>
            ) : null}
            {exposure.length ? (
              <Text variant="secondary" color="textSecondary">
                {f(t.additive.exposure, { groups })}
              </Text>
            ) : null}
            {note ? (
              <Text variant="secondary" color="textSecondary">
                {note}
              </Text>
            ) : null}
            <Text variant="caption" color="textTertiary">
              {t.additive.efsaNote}
            </Text>
          </Collapsible>
        ) : null}

        {a.sources.length ? (
          <Collapsible title={t.additive.sourcesTitle} icon="book" summary={a.sources[0]!.publisher}>
            {a.sources.map((s) => (
              <ListRow
                key={s.url ?? s.title}
                title={s.title}
                subtitle={[s.publisher, s.publishedOn?.slice(0, 4)].filter(Boolean).join(' · ')}
                onPress={s.url ? () => Linking.openURL(s.url!) : undefined}
              />
            ))}
          </Collapsible>
        ) : null}
      </View>

      <Text variant="caption" color="textTertiary">
        Open Food Facts (ODbL) · EFSA · {t.disclaimer.notMedical}
      </Text>
    </View>
  );
}

function StatusChip({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 6 }}>
      <Text variant="secondaryStrong" style={{ color: fg }}>
        {text}
      </Text>
    </View>
  );
}
