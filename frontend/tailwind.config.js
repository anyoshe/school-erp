/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  // theme: {
  //   extend: {
  //     colors: {
  //       primary: "#1D4ED8",   // Blue for headers, sidebar
  //       secondary: "#2563EB", // Slightly brighter blue for accents
  //       accent: "#FBBF24",    // Yellow/orange highlights
  //       neutral: "#F3F4F6",   // Background neutral
  //     },
  //   },
  // },
  theme: {
  extend: {
    colors: {
      primary: '#1E3A8A',
      secondary: '#10B981',
      accent: '#38BDF8',
      background: '#F8FAFC',
      textPrimary: '#0F172A',
      textMuted: '#64748B',
      danger: '#EF4444',
      warning: '#F59E0B',
    },
  },
},

  plugins: [],
};
