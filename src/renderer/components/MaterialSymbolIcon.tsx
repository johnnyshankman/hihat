import React from 'react';

interface MaterialSymbolIconProps {
  icon: string;
  fontSize?: 'small' | 'medium' | 'large' | 'inherit';
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

  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: sizeMap[fontSize],
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
