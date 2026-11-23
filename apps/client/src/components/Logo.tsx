import { memo } from 'react';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { LOGO_CAPTION, LOGO_NAME } from './logoGlyphs';
import { useSvgId } from './svgId';

// Layout, in the drawing's own units (the same design as the app icon's banner).
const NAME_X = 20 - LOGO_NAME.x;
const BASELINE = 92;
const CX = 20 + LOGO_NAME.w / 2;
const CAP_SCALE = 0.34;
const CAP_W = LOGO_CAPTION.w * CAP_SCALE;
const CAP_H = LOGO_CAPTION.h * CAP_SCALE;
const BW = CAP_W + 70;
const BY = BASELINE + 14;
const BH = 50;
const BL = CX - BW / 2;
const BR = CX + BW / 2;
const CAP_T = `translate(${CX - CAP_W / 2 - LOGO_CAPTION.x * CAP_SCALE} ${BY + BH / 2 + CAP_H / 2}) scale(${CAP_SCALE})`;

const VIEW = { x: 4, y: 12, w: 612, h: 164 };
/** Height for a given width. */
export const LOGO_ASPECT = VIEW.h / VIEW.w;

const OUTLINE = '#2E1203';

/** The game's name in chunky gold letters, on a red "TRADITIONAL" banner. */
function LogoImpl({ width }: { width: number }) {
  const id = useSvgId();
  const name = <Path d={LOGO_NAME.d} transform={`translate(${NAME_X} ${BASELINE})`} />;
  return (
    <Svg width={width} height={width * LOGO_ASPECT} viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}>
      <Defs>
        <LinearGradient id={`gold${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FFF6C9" />
          <Stop offset="0.42" stopColor="#FFD54A" />
          <Stop offset="0.75" stopColor="#F0A41C" />
          <Stop offset="1" stopColor="#C9700E" />
        </LinearGradient>
        <LinearGradient id={`gloss${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={`red${id}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F0525A" />
          <Stop offset="0.55" stopColor="#C21F2A" />
          <Stop offset="1" stopColor="#8A0F18" />
        </LinearGradient>
        <ClipPath id={`clip${id}`}>{name}</ClipPath>
      </Defs>

      {/* The name: depth, outline, gold, and a shine across the top. */}
      <G fill="#4A1F05" stroke={OUTLINE} strokeWidth={16} strokeLinejoin="round" transform="translate(0 9)">
        {name}
      </G>
      <G fill={OUTLINE} stroke={OUTLINE} strokeWidth={16} strokeLinejoin="round">
        {name}
      </G>
      <G fill={`url(#gold${id})`}>{name}</G>
      <G clipPath={`url(#clip${id})`}>
        <Rect x={0} y={BASELINE - 74} width={640} height={36} fill={`url(#gloss${id})`} />
      </G>

      {/* The banner: folded tails behind, then the band. */}
      <G stroke={OUTLINE} strokeWidth={4} strokeLinejoin="round">
        <Path d={`M ${BL + 14} ${BY + 12} L ${BL - 40} ${BY + 12} L ${BL - 24} ${BY + 12 + BH / 2} L ${BL - 40} ${BY + 12 + BH} L ${BL + 14} ${BY + 12 + BH} Z`} fill="#7E0E16" />
        <Path d={`M ${BR - 14} ${BY + 12} L ${BR + 40} ${BY + 12} L ${BR + 24} ${BY + 12 + BH / 2} L ${BR + 40} ${BY + 12 + BH} L ${BR - 14} ${BY + 12 + BH} Z`} fill="#7E0E16" />
        <Path d={`M ${BL} ${BY + BH} L ${BL + 14} ${BY + BH + 12} L ${BL + 14} ${BY + BH} Z M ${BR} ${BY + BH} L ${BR - 14} ${BY + BH + 12} L ${BR - 14} ${BY + BH} Z`} fill="#4A070C" />
        <Rect x={BL} y={BY} width={BW} height={BH} rx={6} fill={`url(#red${id})`} />
      </G>
      <Rect x={BL + 6} y={BY + 5} width={BW - 12} height={BH - 10} rx={3} fill="none" stroke="#FFD54A" strokeWidth={2.5} strokeOpacity={0.9} />
      <Path d={LOGO_CAPTION.d} transform={CAP_T} fill="none" stroke="#5A0A10" strokeWidth={6 / CAP_SCALE} strokeLinejoin="round" />
      <Path d={LOGO_CAPTION.d} transform={CAP_T} fill="#FFF1C8" />
    </Svg>
  );
}

export const Logo = memo(LogoImpl);
