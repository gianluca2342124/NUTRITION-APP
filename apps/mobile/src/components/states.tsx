import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { CharacterExpression } from '@repo/design';
import { FudyuCharacter } from './art';
import { Text } from './ui';
import { space } from '@/lib/theme';

/** Empty or completion state with the character — brief, warm, actionable. */
export function FriendlyEmptyState({
  expression = 'smile',
  title,
  body,
  action,
  size = 88,
  compact,
}: {
  expression?: CharacterExpression;
  title: string;
  body?: string;
  action?: ReactNode;
  size?: number;
  compact?: boolean;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? space.lg : space.xxl, paddingHorizontal: space.lg, gap: space.sm }}>
      <FudyuCharacter expression={expression} size={size} />
      <Text variant="cardTitle" align="center" style={{ marginTop: space.xs }}>
        {title}
      </Text>
      {body ? (
        <Text variant="secondary" color="textSecondary" align="center" style={{ maxWidth: 300 }}>
          {body}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: space.sm, alignSelf: 'stretch', alignItems: 'center' }}>{action}</View> : null}
    </View>
  );
}
