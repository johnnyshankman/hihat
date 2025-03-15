/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class', // Enable dark mode with class-based switching
  theme: {
    extend: {
      colors: {
        // Custom color palette for the application
        primary: {
          light: '#3478DA', // Blue accent color
          dark: '#2B2B2B', // Dark background
        },
        text: {
          light: '#000000', // Light mode text
          dark: '#FFFFFF', // Dark mode text
          muted: '#666666', // Muted text color
        },
        background: {
          light: '#FFFFFF', // Light mode background
          dark: '#2B2B2B', // Dark mode background
        },
      },
      spacing: {
        // Custom spacing values
        128: '32rem',
        144: '36rem',
      },
    },
  },
  plugins: [],
};
