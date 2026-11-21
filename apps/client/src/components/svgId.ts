import { useId } from 'react';

/**
 * A suffix that makes SVG gradient/pattern ids unique to one component
 * instance. On the web, ids are shared by the whole page, and screens further
 * back in the navigation stay mounted (hidden); a `url(#id)` that resolves to
 * a hidden copy draws nothing. Native SVG ids are per-drawing, so this is
 * harmless there.
 */
export function useSvgId(): string {
  return useId().replace(/[^a-zA-Z0-9]/g, '');
}
