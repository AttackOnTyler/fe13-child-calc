/**
 * Decompresses an Awakening save container: a plain header, a `PMOC` block, then a
 * Nintendo 8-bit Huffman stream. Written from the format description (GBATEK "Huffman"
 * and the FEAST notes in docs/research/awakening-state-capture.md on research/awakening-state-capture),
 * not from FEAST's GPL code.
 */

/** Offset of the `PMOC` block: 0xC0 in a US Chapter save, 0 in Global (no text header). */
export const findPmoc = (buf: Uint8Array): number => {
  for (const at of [0xc0, 0x80, 0]) {
    if (buf[at] === 0x50 && buf[at + 1] === 0x4d && buf[at + 2] === 0x4f && buf[at + 3] === 0x43) return at;
  }
  return -1;
};

/** Decodes one Nintendo Huffman stream (type 0x28, 8-bit symbols) starting at `at`. */
export const huffman8 = (buf: Uint8Array, at: number): Uint8Array => {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const header = view.getUint32(at, true);
  if ((header & 0xff) !== 0x28) throw new Error(`not an 8-bit Huffman stream (type 0x${(header & 0xff).toString(16)})`);
  const size = header >>> 8;
  const treeAt = at + 4;
  // The tree table is (treeSize + 1) * 2 bytes including its size byte; the root node follows the size byte.
  const dataAt = treeAt + (buf[treeAt] + 1) * 2;
  const root = treeAt + 1;
  const out = new Uint8Array(size);
  let n = 0;
  let node = root;
  let word = 0;
  let bits = 0;
  let pos = dataAt;
  while (n < size) {
    if (bits === 0) {
      word = view.getUint32(pos, true);
      pos += 4;
      bits = 32;
    }
    const right = (word >>> 31) & 1;
    word = (word << 1) >>> 0;
    bits--;
    const b = buf[node];
    // Children sit at (node & ~1) + offset*2 + 2; bit 7 flags the left child as a leaf, bit 6 the right.
    const child = (node & ~1) + (b & 0x3f) * 2 + 2 + right;
    const leaf = right ? b & 0x40 : b & 0x80;
    if (leaf) {
      out[n++] = buf[child];
      node = root;
    } else {
      node = child;
    }
  }
  return out;
};

/** The decompressed body of a Chapter or Global save. */
export const decompressSave = (buf: Uint8Array): Uint8Array => {
  const pmoc = findPmoc(buf);
  if (pmoc < 0) throw new Error('no PMOC block: not an Awakening save');
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const expected = view.getUint32(pmoc + 8, true);
  const body = huffman8(buf, pmoc + 0x10);
  if (body.length !== expected) throw new Error(`decompressed ${body.length} bytes, PMOC says ${expected}`);
  return body;
};
