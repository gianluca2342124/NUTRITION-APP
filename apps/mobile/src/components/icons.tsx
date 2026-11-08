import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { NUTRIENT_ICON_PATHS } from '@repo/design';

/** Original 24×24 stroke icons drawn for this app (no third-party icon set). */
const PATHS = {
  home: ['M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z'],
  explore: ['M15.5 8.5l-2 5-5 2 2-5z'],
  coach: ['M12 3.5l1.7 4.6 4.8 1.7-4.8 1.8L12 16.2l-1.7-4.6-4.8-1.8 4.8-1.7z', 'M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'],
  scan: ['M4 8.5V5.5A1.5 1.5 0 0 1 5.5 4h3', 'M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3', 'M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3', 'M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3', 'M7.5 12h9'],
  camera: ['M4.5 8h2.8l1.7-2.5h6l1.7 2.5h2.8A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z'],
  barcode: ['M4 6v12', 'M7 6v12', 'M10.5 6v12', 'M13 6v12', 'M16.5 6v12', 'M20 6v12'],
  label: ['M6.5 3.5h8l4 4v13h-12z', 'M14 3.5V8h4.5', 'M9 12.5h6.5', 'M9 16h4.5'],
  mic: ['M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3z', 'M5.5 11a6.5 6.5 0 0 0 13 0', 'M12 17.5V21'],
  search: ['M20 20l-4.2-4.2'],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  chevronRight: ['M9.5 6l6 6-6 6'],
  chevronLeft: ['M14.5 6l-6 6 6 6'],
  chevronDown: ['M6 9.5l6 6 6-6'],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  trash: ['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 13h9l1-13'],
  pencil: ['M4.5 19.5h4l10-10-4-4-10 10z', 'M13 7l4 4'],
  heart: ['M12 19.5s-7-4.3-7-9.7a4 4 0 0 1 7-2.6 4 4 0 0 1 7 2.6c0 5.4-7 9.7-7 9.7z'],
  info: ['M12 11v5', 'M12 7.8v.2'],
  alert: ['M12 4.5 3 19.5h18z', 'M12 10v4', 'M12 16.8v.2'],
  user: ['M4.5 20c1.4-3.7 4.2-5.5 7.5-5.5s6.1 1.8 7.5 5.5'],
  flame: ['M12 3.5c1 3.3 5 5.4 5 9.9a5 5 0 0 1-10 0c0-2.1.9-3.5 1.9-4.4.3 1.7 1.1 2.6 2.1 2.9-.4-2.9-.1-5.8 1-8.4z'],
  image: ['M8.5 14.5l2.5-2.5 5.5 6', 'M14 15.5l2-2 3.5 3.5'],
  bolt: ['M13 3.5 5.5 13.5h6l-1 7 7.5-10h-6z'],
  refresh: ['M19.5 11a7.5 7.5 0 1 0-2.2 5.3', 'M19.5 4.5v6.5H13'],
  keyboard: ['M7 10h.01', 'M10.5 10h.01', 'M14 10h.01', 'M17.5 10h.01', 'M8 14h8'],
  chart: ['M5 20v-8', 'M12 20V5', 'M19 20v-5'],
  compare: ['M8 4.5v15', 'M16 4.5v15', 'M5 8l3-3.5L11 8', 'M13 16l3 3.5 3-3.5'],
  leaf: ['M5 19c0-8 6-13.5 14.5-14 0 8.5-6 14-14.5 14z', 'M5 19l7-7'],
  lock: ['M8 10.5V8a4 4 0 0 1 8 0v2.5'],
  download: ['M12 4v11', 'M7.5 10.5 12 15l4.5-4.5', 'M5 19.5h14'],
  logout: ['M14.5 4.5h4v15h-4', 'M10 8l-4 4 4 4', 'M6 12h9.5'],
  globe: ['M3.5 12h17', 'M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5c-2.4-2.5-3.5-5.3-3.5-8.5s1.1-6 3.5-8.5z'],
  scale: ['M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V6A1.5 1.5 0 0 1 6 4.5z', 'M9 9.5a4 4 0 0 1 6 0l-2 2'],
  drop: ['M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z'],
  flask: ['M9.5 3.5h5', 'M10.5 3.5V9l-5 9a1.8 1.8 0 0 0 1.6 2.5h9.8a1.8 1.8 0 0 0 1.6-2.5l-5-9V3.5', 'M7.8 14.5h8.4'],
  cube: ['M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z', 'M4.5 7.7 12 12l7.5-4.3', 'M12 12v8.5'],
  clock: ['M12 7.5V12l3 2'],
  book: ['M5 5.5A1.5 1.5 0 0 1 6.5 4H19v14H6.5A1.5 1.5 0 0 0 5 19.5z', 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19'],
  share: ['M12 4v11', 'M8 8l4-4 4 4', 'M6 13v5.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V13'],
  drumstick: NUTRIENT_ICON_PATHS.drumstick,
  wheat: NUTRIENT_ICON_PATHS.wheat,
  cubes: NUTRIENT_ICON_PATHS.cubes,
  dropHalf: NUTRIENT_ICON_PATHS.dropHalf,
  shaker: NUTRIENT_ICON_PATHS.shaker,
  edit: ['M14.5 5.5l4 4', 'M5 19l1-4.5 9.5-9.5a1.4 1.4 0 0 1 2 0l2 2a1.4 1.4 0 0 1 0 2L10 18.5z'],
  undo: ['M9 14 4.5 9.5 9 5', 'M4.5 9.5h9a5.5 5.5 0 0 1 0 11H11'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z'],
  article: ['M7 4.5h10A1.5 1.5 0 0 1 18.5 6v12A1.5 1.5 0 0 1 17 19.5H7A1.5 1.5 0 0 1 5.5 18V6A1.5 1.5 0 0 1 7 4.5z', 'M8.5 8.5h7', 'M8.5 12h7', 'M8.5 15.5h4'],
  eye: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z', 'M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  camera2: ['M4.5 8h2.8l1.7-2.5h6l1.7 2.5h2.8A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-8A1.5 1.5 0 0 1 4.5 8z', 'M12 16.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
} as const;

const CIRCLES: Partial<Record<IconName, [number, number, number][]>> = {
  explore: [[12, 12, 8.5]],
  camera: [[12, 13.3, 3.5]],
  search: [[10.8, 10.8, 6.8]],
  info: [[12, 12, 8.5]],
  user: [[12, 8, 3.8]],
  image: [[9, 9.5, 1.6]],
  globe: [[12, 12, 8.5]],
  clock: [[12, 12, 8.5]],
};

const RECTS: Partial<Record<IconName, [number, number, number, number, number][]>> = {
  image: [[3.5, 4.5, 17, 15, 2]],
  keyboard: [[3, 6.5, 18, 11, 2]],
  lock: [[5.5, 10.5, 13, 9.5, 2]],
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 2,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
  fill?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no">
      {RECTS[name]?.map(([x, y, w, h, r], i) => (
        <Rect key={`r${i}`} x={x} y={y} width={w} height={h} rx={r} stroke={color} strokeWidth={strokeWidth} fill="none" />
      ))}
      {CIRCLES[name]?.map(([cx, cy, r], i) => (
        <Circle key={`c${i}`} cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeWidth} fill="none" />
      ))}
      {PATHS[name].map((d, i) => (
        <Path key={i} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" fill={fill} />
      ))}
    </Svg>
  );
}
