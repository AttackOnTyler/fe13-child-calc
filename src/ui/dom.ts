type Attrs = Record<string, string | boolean | undefined | ((e: Event) => void)>;

/** Creates an element: `on*` attributes become listeners, `true` sets a bare attribute, `false`/undefined are skipped. */
export function h(tag: string, attrs: Attrs = {}, ...children: (Node | string | null)[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children) if (c !== null) el.append(c);
  return el;
}
