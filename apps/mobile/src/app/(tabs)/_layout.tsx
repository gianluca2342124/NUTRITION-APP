import { Tabs } from 'expo-router/js-tabs';
import { AddActionSheet } from '@/components/add-sheet';
import { FloatingTabBar } from '@/components/floating-tab-bar';
import { useT } from '@/lib/i18n';
import { usePalette } from '@/lib/theme';

export default function TabsLayout() {
  const { t } = useT();
  const p = usePalette();
  return (
    <>
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: p.background } }}
    >
      <Tabs.Screen name="index" options={{ title: t.nav.today }} />
      <Tabs.Screen name="explore" options={{ title: t.nav.explore }} />
      <Tabs.Screen name="coach" options={{ title: t.nav.coach }} />
      <Tabs.Screen name="profile" options={{ title: t.nav.profile }} />
    </Tabs>
    <AddActionSheet />
    </>
  );
}
