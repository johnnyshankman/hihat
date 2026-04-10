import React from 'react';

// Icon size convention (enforced per zone):
//   sidebar row icons: 16px (MUI @mui/icons-material default sx fontSize)
//   toolbar / header icons: 20px (MUI fontSize="small" or sx { fontSize: 20 })
//   transport secondaries: 20px (MaterialSymbolIcon fontSize="small")
//   play / pause button:   35px (MUI fontSize="large", dominant control)
//   player bar volume:     20px (MUI sx { fontSize: 20 })
// Material Symbols axes: wght defaults to 400. The 500 override used by
// shuffle/repeat is deliberate optical-weight compensation — stroked
// glyphs need extra weight to match neighbouring filled MUI icons.
interface MaterialSymbolIconProps {
  icon: string;
  /**
   * Either a preset size name or an exact pixel value. Numeric values
   * exist so callers can compensate for per-glyph optical differences
   * (e.g. `skip_previous` draws smaller than `shuffle` at the same
   * em size because its triangle shape leaves whitespace in the box).
   */
  fontSize?: 'small' | 'medium' | 'large' | 'inherit' | number;
  /**
   * Material Symbols variable-font weight axis (100–700).
   * Omit to inherit the CSS default (400).
   */
  weight?: number;
  /**
   * Material Symbols FILL axis. When true, the glyph's background
   * shape (e.g. the rounded square behind shuffle_on/repeat_on) is
   * filled instead of outlined.
   */
  filled?: boolean;
}

const sizeMap = {
  small: 20,
  medium: 24,
  large: 28,
  inherit: 'inherit' as const,
};

function MaterialSymbolIcon({
  icon,
  fontSize = 'medium',
  weight,
  filled,
}: MaterialSymbolIconProps) {
  // Build font-variation-settings only for axes the caller actually
  // set, so we don't override the CSS defaults unnecessarily.
  const variationAxes: string[] = [];
  if (filled !== undefined) variationAxes.push(`'FILL' ${filled ? 1 : 0}`);
  if (weight !== undefined) variationAxes.push(`'wght' ${weight}`);

  const resolvedFontSize =
    typeof fontSize === 'number' ? fontSize : sizeMap[fontSize];

  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: resolvedFontSize,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(variationAxes.length > 0
          ? { fontVariationSettings: variationAxes.join(', ') }
          : {}),
      }}
    >
      {icon}
    </span>
  );
}

export default MaterialSymbolIcon;
