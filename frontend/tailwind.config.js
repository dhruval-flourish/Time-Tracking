/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        background: '#f1f5f9',
        accent: '#9DCC74',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        'sans': ['Open Sans', 'sans-serif'],
        'secondary': ['Montserrat', 'sans-serif'],
        'tertiary': ['Raleway', 'sans-serif'],
        'roboto': ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 10px rgba(0, 0, 0, 0.1)',
        'medium': '0 4px 20px rgba(0, 0, 0, 0.15)',
      },
      backgroundImage: {
        'sidebar-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'header-gradient': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        'admin-gradient': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      }
    },
  },
  plugins: [],
}
