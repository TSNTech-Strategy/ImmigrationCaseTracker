/**
 * The receipt-number frame on the in-app camera, and where it falls in the photo.
 * Plain TypeScript with no React Native imports, so the website's test suite
 * checks it too (src/lib/__tests__/receipt-frame.test.ts).
 *
 * The camera preview fills its box the way CSS "cover" does (iOS resizeAspectFill,
 * Android FILL_CENTER, object-fit: cover on the web): the picture is scaled until it
 * covers the box and centered, so the box shows a centered slice of the photo.
 */

export type Size = { width: number; height: number };
export type Rect = { x: number; y: number; width: number; height: number };
/** A crop in the photo's pixels, as expo-image-manipulator takes it. */
export type Crop = { originX: number; originY: number; width: number; height: number };

/** Extra room around the frame, as a share of its size: people rarely line the number up exactly. */
export const FRAME_MARGIN = { x: 0.06, y: 0.5 };

/**
 * The frame inside the preview box: wide and short like a receipt number, a
 * little above the middle (people hold the phone a bit low).
 */
export function receiptFrame(box: Size): Rect {
  const width = Math.round(box.width * 0.86);
  const height = Math.round(Math.min(box.width * 0.24, box.height * 0.3));
  return { x: Math.round((box.width - width) / 2), y: Math.round(box.height * 0.44 - height / 2), width, height };
}

/**
 * The part of the photo shown inside the frame (plus FRAME_MARGIN), or null when
 * the sizes don't make sense. If the photo turns out to be sideways the crop simply
 * misses the number, and the caller falls back to reading the whole photo.
 */
export function frameToPhotoCrop(box: Size, frame: Rect, photo: Size, margin: { x: number; y: number } = FRAME_MARGIN): Crop | null {
  const sizes = [box.width, box.height, photo.width, photo.height, frame.width, frame.height];
  if (!sizes.every((n) => Number.isFinite(n) && n > 0)) return null;
  const scale = Math.max(box.width / photo.width, box.height / photo.height);
  const offsetX = (photo.width * scale - box.width) / 2;
  const offsetY = (photo.height * scale - box.height) / 2;
  const toPhotoX = (x: number) => (x + offsetX) / scale;
  const toPhotoY = (y: number) => (y + offsetY) / scale;
  const left = Math.max(0, Math.floor(toPhotoX(frame.x - frame.width * margin.x)));
  const top = Math.max(0, Math.floor(toPhotoY(frame.y - frame.height * margin.y)));
  const right = Math.min(photo.width, Math.ceil(toPhotoX(frame.x + frame.width * (1 + margin.x))));
  const bottom = Math.min(photo.height, Math.ceil(toPhotoY(frame.y + frame.height * (1 + margin.y))));
  // Too small to hold a readable number: the frame was off the photo.
  if (right - left < 32 || bottom - top < 16) return null;
  return { originX: left, originY: top, width: right - left, height: bottom - top };
}
