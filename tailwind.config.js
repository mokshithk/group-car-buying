/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF4FF',
          100: '#E0EBFF',
          200: '#C7D9FE',
          300: '#A4BFFC',
          400: '#7B9CF8',
          500: '#4F75F2',
          600: '#2563EB', // Core primary accent
          700: '#1D4ED8',
          800: '#1E3A8A', // Deep navy brand
          900: '#172554',
          950: '#0F172A',
        },
        surface: {
          canvas: '#F8FAFC',
          card: '#FFFFFF',
          subtle: '#F1F5F9',
          border: '#E2E8F0',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 8px 24px -4px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 4px 12px -2px rgba(15, 23, 42, 0.06), 0 16px 36px -6px rgba(15, 23, 42, 0.1)',
        subtle: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
        elevated: '0 20px 40px -15px rgba(15, 23, 42, 0.12)',
      },
      borderRadius: {
        '2xl': '16px',
        xl: '12px',
        lg: '10px',
      },
    },
  },
  plugins: [],
};
