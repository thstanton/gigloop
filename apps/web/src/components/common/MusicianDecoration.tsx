import { useState } from 'react';
import {
  MUSICIAN_DARK_CLASSES,
  MUSICIAN_FIGURE_ASSETS,
  MUSICIAN_FIGURE_DARK,
  MUSICIAN_FIGURE_ORDER,
  MUSICIAN_TAILPIECE_PX,
  type MusicianFigure,
} from '@/lib/constants';

function pickFigure(): MusicianFigure {
  return MUSICIAN_FIGURE_ORDER[Math.floor(Math.random() * MUSICIAN_FIGURE_ORDER.length)];
}

interface MusicianDecorationProps {
  /** Rendered size in px, square. Defaults to the tailpiece tier. */
  size?: number;
  /**
   * Story/test escape hatch only — production call sites never name a figure, so the
   * ornament stays a uniform random draw from the pool (#858).
   */
  figure?: MusicianFigure;
}

/**
 * A woodcut musician figure, drawn at random from the pool — score-cover ornament,
 * not a mascot. Carries no information, so it is hidden from assistive technology:
 * a screen reader announcing "trumpeter" here would be noise.
 *
 * At most one figure may be visible at a time (CLAUDE.md → UI Rules), which is why
 * call sites are a closed, approved list rather than anywhere it looks nice.
 */
export function MusicianDecoration({ size = MUSICIAN_TAILPIECE_PX, figure }: MusicianDecorationProps) {
  // Frozen at mount. A bare pickFigure() in the render body re-rolls on every
  // re-render, so the figure would flicker mid-dialog once the pool grows past one.
  const [drawn] = useState(pickFigure);
  const shown = figure ?? drawn;

  return (
    <img
      src={MUSICIAN_FIGURE_ASSETS[shown]}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={`mx-auto select-none ${MUSICIAN_DARK_CLASSES[MUSICIAN_FIGURE_DARK[shown]]}`}
    />
  );
}
