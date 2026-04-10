import React from 'react';

interface MaterialSymbolIconProps {
  icon: string;
  fontSize?: 'small' | 'medium' | 'large' | 'inherit';
  /**
   * Material Symbols variable-font weight axis (100–700).
   * Omit to inherit the CSS default (400).
   */
  weight?: number;
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
}: MaterialSymbolIconProps) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: sizeMap[fontSize],
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...(weight !== undefined ? { fontWeight: weight } : {}),
      }}
    >
      {icon}
    </span>
  );
}

export default MaterialSymbolIcon;
