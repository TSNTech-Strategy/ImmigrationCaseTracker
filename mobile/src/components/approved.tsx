import Svg, { Circle, Path, Polygon } from "react-native-svg";

const NAVY = "#0F1B2D";
const BLUE = "#1758A8";
const RED = "#E43B53";

/** Points of a five-pointed star centred on (cx, cy). Same shapes as the website and the share picture. */
function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}
const STARS = Array.from({ length: 12 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 6;
  return { x: 180 + 126 * Math.cos(a), y: 150 + 126 * Math.sin(a) };
});

/** CasePingo's "approved" seal: a blue medal with stars, a white check on navy, red and blue ribbon tails. */
export function ApprovedSeal({ size = 200, label }: { size?: number; label?: string }) {
  return (
    <Svg width={size} height={(size * 330) / 360} viewBox="0 0 360 330" accessibilityLabel={label} accessible={Boolean(label)}>
      <Polygon points="112,230 74,322 116,300 140,326 168,250" fill={RED} />
      <Polygon points="248,230 286,322 244,300 220,326 192,250" fill={BLUE} />
      <Circle cx={180} cy={150} r={148} fill={RED} />
      <Circle cx={180} cy={150} r={140} fill={BLUE} />
      <Circle cx={180} cy={150} r={112} fill="none" stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={3} />
      {STARS.map((s, i) => (
        <Polygon key={i} points={starPoints(s.x, s.y, 9, 4)} fill="#FFFFFF" />
      ))}
      <Circle cx={180} cy={150} r={104} fill={NAVY} />
      <Path d="M128 154 L164 190 L234 116" fill="none" stroke="#FFFFFF" strokeWidth={24} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
