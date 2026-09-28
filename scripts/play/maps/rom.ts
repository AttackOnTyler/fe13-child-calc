/**
 * Read-only access to Awakening's romfs data files: the LZ13 wrapper and the FE13 `.bin` container.
 * Formats from docs/research/fe13-map-terrain.md on research/fe13-map-terrain (FEAT, Paragon, fefates-tools),
 * re-implemented here. Nothing read from the ROM is committed except the derived map facts.
 */
import { readFileSync } from 'node:fs';

/** LZ13 = a 4-byte 0x13 prefix, then a Nintendo LZ11 stream. */
export const lz13 = (file: Uint8Array): Uint8Array => {
  const src = file[0] === 0x13 && file[4] === 0x11 ? file.subarray(4) : file;
  if (src[0] !== 0x11) throw new Error('not an LZ11 stream');
  let size = src[1] | (src[2] << 8) | (src[3] << 16);
  let at = 4;
  if (size === 0) {
    size = (src[4] | (src[5] << 8) | (src[6] << 16) | (src[7] << 24)) >>> 0;
    at = 8;
  }
  const out = new Uint8Array(size);
  let n = 0;
  while (n < size) {
    const flags = src[at++];
    for (let bit = 7; bit >= 0 && n < size; bit--) {
      if (!(flags & (1 << bit))) {
        out[n++] = src[at++];
        continue;
      }
      const b0 = src[at];
      let len: number;
      let disp: number;
      switch (b0 >> 4) {
        case 0:
          len = (((b0 & 0xf) << 4) | (src[at + 1] >> 4)) + 0x11;
          disp = (((src[at + 1] & 0xf) << 8) | src[at + 2]) + 1;
          at += 3;
          break;
        case 1:
          len = (((b0 & 0xf) << 12) | (src[at + 1] << 4) | (src[at + 2] >> 4)) + 0x111;
          disp = (((src[at + 2] & 0xf) << 8) | src[at + 3]) + 1;
          at += 4;
          break;
        default:
          len = (b0 >> 4) + 1;
          disp = (((b0 & 0xf) << 8) | src[at + 1]) + 1;
          at += 2;
      }
      for (let i = 0; i < len; i++, n++) out[n] = out[n - disp];
    }
  }
  return out;
};

const sjis = new TextDecoder('shift_jis');

/** The FE13 `.bin` container: a data region at 0x20, a pointer table, labels, then strings. */
export class Bin {
  readonly view: DataView;
  readonly labels = new Map<string, number>();
  readonly pointers = new Set<number>();

  constructor(readonly bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dataSize = this.u32raw(4);
    const p1 = this.u32raw(8);
    const p2 = this.u32raw(0xc);
    const ptrTable = 0x20 + dataSize;
    for (let i = 0; i < p1; i++) this.pointers.add(this.u32raw(ptrTable + i * 4));
    const labelTable = ptrTable + p1 * 4;
    const strings = labelTable + p2 * 8;
    for (let i = 0; i < p2; i++) {
      const dataAt = this.u32raw(labelTable + i * 8);
      const nameAt = this.u32raw(labelTable + i * 8 + 4);
      this.labels.set(this.cstr(strings + nameAt), dataAt);
    }
  }

  static load(path: string): Bin {
    return new Bin(lz13(new Uint8Array(readFileSync(path))));
  }

  private u32raw(at: number): number {
    return this.view.getUint32(at, true);
  }
  private cstr(at: number): string {
    let end = at;
    while (this.bytes[end] !== 0) end++;
    return sjis.decode(this.bytes.subarray(at, end));
  }

  /** Data-region reads (offsets relative to 0x20). */
  u8(at: number): number {
    return this.bytes[0x20 + at];
  }
  u32(at: number): number {
    return this.u32raw(0x20 + at);
  }
  label(name: string): number {
    const at = this.labels.get(name);
    if (at === undefined) throw new Error(`no label ${name}`);
    return at;
  }
  /** A pointer field: its target offset, or null when the slot isn't in the pointer table. */
  ptr(at: number): number | null {
    return this.pointers.has(at) ? this.u32(at) : null;
  }
  /** A Shift-JIS string behind a pointer field. */
  str(at: number): string | null {
    const p = this.ptr(at);
    return p === null ? null : this.cstr(0x20 + p);
  }
  /** A UTF-16LE message at a data offset (message archives). */
  utf16(at: number): string {
    let s = '';
    for (let i = 0x20 + at; ; i += 2) {
      const c = this.view.getUint16(i, true);
      if (c === 0) return s;
      s += String.fromCharCode(c);
    }
  }
}

/** English text by message key (`MTID_*`, `MCID_*`, ...) from `m/E/GameData.bin.lz`. */
export const messages = (path: string): Map<string, string> => {
  const bin = Bin.load(path);
  const out = new Map<string, string>();
  for (const [key, at] of bin.labels) out.set(key, bin.utf16(at));
  return out;
};
