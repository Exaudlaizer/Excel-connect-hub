/**
 * Works out what a file really is by looking at its first bytes.
 *
 * The type a browser reports for an upload is just a label the client chose, so
 * "a.png" containing a script or an executable would sail through a check that
 * only reads the label. This reads the file's own signature instead.
 *
 * Only the formats the platform accepts are recognised. Anything else returns
 * null, including SVG (which can carry script) and HTML.
 */

const startsWith = (buffer, bytes, offset = 0) =>
  buffer.length >= offset + bytes.length && bytes.every((byte, i) => buffer[offset + i] === byte);

const ascii = (buffer, start, end) => buffer.subarray(start, end).toString("latin1");

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "image/jpeg";

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";

  // GIF: "GIF87a" or "GIF89a"
  const gif = ascii(buffer, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return "image/gif";

  // WebP: "RIFF" <size> "WEBP"
  if (ascii(buffer, 0, 4) === "RIFF" && ascii(buffer, 8, 12) === "WEBP") return "image/webp";

  // AVIF: an ISO base media "ftyp" box whose major or compatible brands include
  // avif/avis. Layout: <size:4> "ftyp" <major:4> <minor:4> <compatible brands:4 each>
  if (ascii(buffer, 4, 8) === "ftyp") {
    const boxSize = buffer.readUInt32BE(0);
    const end = Math.min(buffer.length, boxSize >= 16 && boxSize <= 128 ? boxSize : 64);
    const brands = [ascii(buffer, 8, 12)];
    for (let offset = 16; offset + 4 <= end; offset += 4) brands.push(ascii(buffer, offset, offset + 4));
    if (brands.some((brand) => brand === "avif" || brand === "avis")) return "image/avif";
  }

  return null;
}

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif"
};

module.exports = { detectImageType, EXTENSIONS };
