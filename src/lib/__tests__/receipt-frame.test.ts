import { describe, expect, it } from "vitest";
// The app's camera frame math (plain TypeScript), checked here with the website's tests.
import { FRAME_MARGIN, frameToPhotoCrop, receiptFrame } from "../../../mobile/src/lib/receipt-frame";

const NO_MARGIN = { x: 0, y: 0 };

describe("receiptFrame", () => {
  it("is wide and short, centered across, a little above the middle", () => {
    const box = { width: 358, height: 448 };
    const f = receiptFrame(box);
    expect(f.width).toBe(308);
    expect(f.height).toBe(86);
    expect(f.x).toBe(25);
    expect(f.x * 2 + f.width).toBe(box.width);
    expect(f.y + f.height / 2).toBeCloseTo(box.height * 0.44, 0);
    expect(f.y + f.height).toBeLessThan(box.height);
  });

  it("stays inside a short box", () => {
    const f = receiptFrame({ width: 400, height: 200 });
    expect(f.height).toBe(60);
    expect(f.y).toBeGreaterThanOrEqual(0);
    expect(f.y + f.height).toBeLessThanOrEqual(200);
  });
});

describe("frameToPhotoCrop", () => {
  it("maps the frame through the cover scaling of a portrait photo (iPhone 12 MP)", () => {
    // Box 358×448 shows a 3024×4032 photo: scale = max(358/3024, 448/4032) = 0.1185, so the
    // photo is drawn 358.0 × 477.3 and 14.7 points are cut off at the top and bottom.
    const box = { width: 358, height: 448 };
    const photo = { width: 3024, height: 4032 };
    const frame = { x: 25, y: 154, width: 308, height: 86 };
    const crop = frameToPhotoCrop(box, frame, photo, NO_MARGIN)!;
    const scale = 358 / 3024;
    const offsetY = (4032 * scale - 448) / 2;
    expect(crop.originX).toBe(Math.floor(25 / scale));
    expect(crop.originY).toBe(Math.floor((154 + offsetY) / scale));
    expect(crop.originX + crop.width).toBe(Math.ceil(333 / scale));
    expect(crop.originY + crop.height).toBe(Math.ceil((240 + offsetY) / scale));
  });

  it("maps through a landscape photo cut at the sides (a web camera)", () => {
    // 640×480 video in a 358×448 box: scale = 448/480 and 119.3 points are cut off on each side.
    const box = { width: 358, height: 448 };
    const photo = { width: 640, height: 480 };
    const frame = { x: 25, y: 154, width: 308, height: 86 };
    const crop = frameToPhotoCrop(box, frame, photo, NO_MARGIN)!;
    const scale = 448 / 480;
    const offsetX = (640 * scale - 358) / 2;
    expect(crop.originX).toBe(Math.floor((25 + offsetX) / scale));
    expect(crop.originY).toBe(Math.floor(154 / scale));
    expect(crop.width).toBe(Math.ceil((333 + offsetX) / scale) - Math.floor((25 + offsetX) / scale));
  });

  it("the whole box maps to the visible part of the photo", () => {
    const box = { width: 300, height: 300 };
    const photo = { width: 3000, height: 4000 };
    const crop = frameToPhotoCrop(box, { x: 0, y: 0, width: 300, height: 300 }, photo, NO_MARGIN)!;
    expect(crop).toEqual({ originX: 0, originY: 500, width: 3000, height: 3000 });
  });

  it("adds room around the frame and keeps it inside the photo", () => {
    const box = { width: 300, height: 400 };
    const photo = { width: 3000, height: 4000 };
    const frame = { x: 20, y: 100, width: 260, height: 70 };
    const plain = frameToPhotoCrop(box, frame, photo, NO_MARGIN)!;
    const roomy = frameToPhotoCrop(box, frame, photo)!;
    expect(roomy.originX).toBeLessThan(plain.originX);
    expect(roomy.originY).toBe(Math.floor((100 - 70 * FRAME_MARGIN.y) * 10));
    expect(roomy.height).toBeGreaterThan(plain.height * 1.9);
    // A frame at the very edge is clamped to the photo.
    const edge = frameToPhotoCrop(box, { x: 0, y: 0, width: 300, height: 60 }, photo)!;
    expect(edge.originX).toBe(0);
    expect(edge.originY).toBe(0);
    expect(edge.originX + edge.width).toBe(3000);
  });

  it("returns null for sizes that don't make sense or a frame off the photo", () => {
    const frame = { x: 10, y: 10, width: 100, height: 30 };
    expect(frameToPhotoCrop({ width: 0, height: 400 }, frame, { width: 3000, height: 4000 })).toBeNull();
    expect(frameToPhotoCrop({ width: 300, height: 400 }, frame, { width: NaN, height: 4000 })).toBeNull();
    expect(frameToPhotoCrop({ width: 300, height: 400 }, { ...frame, width: 0 }, { width: 3000, height: 4000 })).toBeNull();
    expect(frameToPhotoCrop({ width: 300, height: 400 }, { x: 2000, y: 10, width: 100, height: 30 }, { width: 3000, height: 4000 })).toBeNull();
  });
});
