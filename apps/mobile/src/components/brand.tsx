import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Brand mark v1 (proposal): a bowl that is also a smile, and a fresh seed. */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityElementsHidden importantForAccessibility="no">
      <Defs>
        <LinearGradient id="markBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3B6EFF" />
          <Stop offset="1" stopColor="#1E4FE6" />
        </LinearGradient>
      </Defs>
      <Rect width={1024} height={1024} rx={236} fill="url(#markBg)" />
      <Path d="M286 488 A226 226 0 0 0 738 488" fill="none" stroke="#FFFFFF" strokeWidth={100} strokeLinecap="round" />
      <Circle cx={610} cy={326} r={78} fill="#17C995" />
    </Svg>
  );
}
