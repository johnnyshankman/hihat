/**
 * Motion tokens for sx props. Values resolve to the CSS custom
 * properties declared in App.css so CSS files and sx share one source
 * of truth, and the global prefers-reduced-motion override applies to
 * both.
 */
export const duration = {
  fast: 'var(--motion-fast)',
  base: 'var(--motion-base)',
  slow: 'var(--motion-slow)',
} as const;

export const easing = {
  out: 'var(--ease-out)',
  standard: 'var(--ease-standard)',
} as const;

/** Global keyframes declared in App.css. */
export const FADE_IN = 'hihat-fade-in';

/** `animation` shorthand for a one-shot fade-in. */
export const fadeIn = (
  speed: keyof typeof duration = 'base',
  delay = '0ms',
): string => `${FADE_IN} ${duration[speed]} ${easing.out} ${delay} both`;
