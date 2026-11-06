const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { detectImageType } = require("../src/utils/imageSignature");

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const pad = (...parts) => Buffer.concat([...parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, "latin1"))), Buffer.alloc(16)]);
const box = (...brands) => {
  const body = Buffer.concat([Buffer.from("ftyp", "latin1"), ...brands.map((b) => Buffer.from(b, "latin1"))]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(body.length + 4);
  return Buffer.concat([size, body, Buffer.alloc(8)]);
};

describe("image type detection from file content", () => {
  test("recognises each accepted format", () => {
    assert.equal(detectImageType(PNG), "image/png");
    assert.equal(detectImageType(pad(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), "JFIF")), "image/jpeg");
    assert.equal(detectImageType(pad("GIF89a", Buffer.from([1, 0, 1, 0]))), "image/gif");
    assert.equal(detectImageType(pad("GIF87a")), "image/gif");
    assert.equal(detectImageType(pad("RIFF", Buffer.from([0x24, 0, 0, 0]), "WEBPVP8 ")), "image/webp");
  });

  test("recognises AVIF by its major or compatible brand", () => {
    assert.equal(detectImageType(box("avif", "\0\0\0\0", "avif", "mif1")), "image/avif");
    assert.equal(detectImageType(box("avis", "\0\0\0\0", "avis")), "image/avif");
    assert.equal(detectImageType(box("mif1", "\0\0\0\0", "mif1", "avif")), "image/avif", "avif listed only as a compatible brand");
  });

  test("refuses other containers that look similar", () => {
    assert.equal(detectImageType(box("heic", "\0\0\0\0", "heic", "mif1")), null, "HEIC is not accepted");
    assert.equal(detectImageType(box("isom", "\0\0\0\0", "isom", "mp42")), null, "MP4 video is not an image");
    assert.equal(detectImageType(pad("RIFF", Buffer.from([0x24, 0, 0, 0]), "WAVEfmt ")), null, "RIFF audio is not WebP");
  });

  test("refuses things that are not images, whatever they are called", () => {
    const notImages = {
      svg: '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
      html: "<html><script>alert(1)</script></html>",
      php: "<?php system($_GET['c']); ?>",
      pdf: "%PDF-1.7 fake document body here",
      zip: "PK\x03\x04 not really a zip but starts like one",
      exe: "MZ\x90\x00 pretend executable header bytes",
      text: "hello world, this is plain text"
    };
    for (const [name, content] of Object.entries(notImages)) assert.equal(detectImageType(Buffer.from(content, "latin1")), null, name);
  });

  test("handles junk input without throwing", () => {
    for (const value of [null, undefined, "image/png", 42, {}, Buffer.alloc(0), Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(11)]) {
      assert.equal(detectImageType(value), null);
    }
  });

  test("a truncated real image is not mistaken for a valid one when the signature is cut short", () => {
    assert.equal(detectImageType(PNG.subarray(0, 7)), null);
  });
});
