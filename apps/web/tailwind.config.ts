import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],   // 12px
        sm: ['0.875rem', { lineHeight: '1.5' }],  // 14px
        base: ['1rem', { lineHeight: '1.5' }],    // 16px
        lg: ['1.125rem', { lineHeight: '1.5' }],  // 18px
        '2xl': ['1.5rem', { lineHeight: '1.4' }], // 24px
        '3xl': ['1.875rem', { lineHeight: '1.3' }], // 30px
        '4xl': ['2.25rem', { lineHeight: '1.2' }],  // 36px
      },
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        muted: 'hsl(var(--muted))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        status: {
          enquiry: 'hsl(var(--status-enquiry) / <alpha-value>)',
          confirmed: 'hsl(var(--status-confirmed) / <alpha-value>)',
          invoiced: 'hsl(var(--status-invoiced) / <alpha-value>)',
          settled: 'hsl(var(--status-settled) / <alpha-value>)',
          completed: 'hsl(var(--status-completed) / <alpha-value>)',
          cancelled: 'hsl(var(--status-cancelled) / <alpha-value>)',
        },
      },
      borderColor: {
        DEFAULT: 'hsl(var(--border))',
      },
    },
  },
  plugins: [],
};

export default config;
