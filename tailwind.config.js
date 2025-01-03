module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      animation: {
        'accordion-down': 'sui--accordion-down 0.2s ease-out',
        'accordion-up': 'sui--accordion-up 0.2s ease-out',
      },
      colors: {
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        background: 'hsl(var(--background))',
        border: 'hsl(var(--border))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        foreground: 'hsl(var(--foreground))',
        input: 'hsl(var(--input))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        ring: 'hsl(var(--ring))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
      },
      height: {
        vh80: '80vh',
      },
      /**
       * @dev This is not a mobile app so the sm breakpoint being 640 is too big.
       * I'm using 500px as the breakpoint for the "small" UX as that's when
       * the StaticPlayer component looks good snapping into a vertical layout.
       */
      screens: {
        sm: '600px',
        // => @media (min-width: 600px) { ... }
      },
      keyframes: {
        'sui--accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'sui--accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 },
        },
      },
      minHeight: {
        2: '0.5rem',
        5: '1.25rem',
      },
      minWidth: {
        2: '0.5rem',
        5: '1.25rem',
      },
    },
  },
  variants: {},
  plugins: [],
};
