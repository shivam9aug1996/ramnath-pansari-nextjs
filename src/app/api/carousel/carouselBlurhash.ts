import { encode } from "blurhash";
import sharp from "sharp";

const FETCH_TIMEOUT_MS = 15_000;

export async function blurhashFromImageUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}
