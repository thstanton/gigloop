import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Commissioner', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        display: ['Playfair Display', 'serif'],
        wordmark: ['Major Mono Display', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.5' }],
        '2xl': ['1.5rem', { lineHeight: '1.4' }],
        '3xl': ['1.875rem', { lineHeight: '1.3' }],
        '4xl': ['2.25rem', { lineHeight: '1.2' }],
      },
      borderRadius: {
        none: '0px',
        sm: '2px',
        DEFAULT: '2px',
        md: '2px',
        lg: '2px',
        xl: '3px',
        '2xl': '4px',
        '3xl': '6px',
        full: '9999px',
      },
      colors: {
        background: 'hsl(var(--background))',
        surface: 'hsl(var(--surface))',
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        // Text token. `DEFAULT` stays so the deliberate translucent washes
        // (`bg-muted/20`…`/50`) keep resolving; there is no `foreground`
        // sub-key, because `muted` IS the foreground.
        muted: {
          DEFAULT: 'hsl(var(--muted))',
        },
        // VOID's dedicated text color (#1004) — darker than `muted` so its
        // label clears AA on top of the shared muted washes it sits on
        // (bg-muted/20, bg-muted/40). See ADR-0039's "Amended by #977".
        void: {
          DEFAULT: 'hsl(var(--void))',
        },
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        chrome: {
          DEFAULT: 'hsl(var(--chrome))',
          foreground: 'hsl(var(--chrome-foreground))',
          muted: 'hsl(var(--chrome-muted))',
        },
        dashboard: 'hsl(var(--dashboard-surface))',
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          surface: 'hsl(var(--warning-surface))',
          border: 'hsl(var(--warning-border))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        'date-badge': {
          DEFAULT: 'hsl(var(--date-badge))',
          foreground: 'hsl(var(--date-badge-foreground))',
        },
        overlay: 'hsl(var(--overlay) / <alpha-value>)',
        'on-status': 'hsl(var(--on-status) / <alpha-value>)',
        status: {
          enquiry: 'hsl(var(--status-enquiry) / <alpha-value>)',
          provisional: 'hsl(var(--status-provisional) / <alpha-value>)',
          confirmed: 'hsl(var(--status-confirmed) / <alpha-value>)',
          ready: 'hsl(var(--status-ready) / <alpha-value>)',
          complete: 'hsl(var(--status-complete) / <alpha-value>)',
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
