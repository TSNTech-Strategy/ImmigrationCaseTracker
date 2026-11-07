/**
 * CasePingo's "approved" seal: a blue medal with a ring of stars, a white
 * check on navy and red and blue ribbon tails. Drawn here (no artwork files)
 * so the share picture and the website use exactly the same seal; the app
 * draws the same shapes with react-native-svg.
 */

const NAVY = "#0F1B2D";
const BLUE = "#1758A8";
const RED = "#E43B53";

/** Points of a five-pointed star centred on (cx, cy). */
export function starPoints(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

/** Where the 12 stars sit on the medal's ring. */
export function sealStars(): { x: number; y: number }[] {
  return Array.from({ length: 12 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 6;
    return { x: 180 + 126 * Math.cos(a), y: 150 + 126 * Math.sin(a) };
  });
}

/** The seal as an SVG document (viewBox 360 × 330). */
export function approvedSealSvg(): string {
  const stars = sealStars()
    .map((s) => `<polygon points="${starPoints(s.x, s.y, 9, 4)}" fill="#FFFFFF"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 330" width="360" height="330">
<polygon points="112,230 74,322 116,300 140,326 168,250" fill="${RED}"/>
<polygon points="248,230 286,322 244,300 220,326 192,250" fill="${BLUE}"/>
<circle cx="180" cy="150" r="148" fill="${RED}"/>
<circle cx="180" cy="150" r="140" fill="${BLUE}"/>
<circle cx="180" cy="150" r="112" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="3"/>
${stars}
<circle cx="180" cy="150" r="104" fill="${NAVY}"/>
<path d="M128 154 L164 190 L234 116" fill="none" stroke="#FFFFFF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
