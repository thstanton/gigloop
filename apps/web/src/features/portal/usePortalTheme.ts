import type React from 'react';
import { pickTextColour } from '@/pages/portal/PortalPage';
import type { PortalTheme } from '@/types/api';

export function usePortalTheme(theme: PortalTheme) {
  const bold = theme === 'BOLD_MODERN' || theme === 'BOLD_ROMANTIC';

  return {
    bold,

    // ── Text colours ────────────────────────────────────────────────
    primaryText: bold ? 'text-white' : 'text-[#1a1a1a]',
    mutedText: bold ? 'text-white/60' : 'text-[#6b7280]',
    subtleText: bold ? 'text-white/75' : 'text-[#374151]',
    formText: bold ? 'text-white/80' : 'text-[#374151]',
    artistText: bold ? 'text-white/50' : 'text-[#9ca3af]',
    emptyText: bold ? 'text-white/40' : 'text-[#9ca3af]',
    sectionLabel: bold ? 'text-white/35' : 'text-[#a39e97]',
    iconSubtle: bold ? 'text-white/35' : 'text-[#b0a89c]',
    iconMuted: bold ? 'text-white/40' : 'text-[#9ca3af]',

    // Used for booking detail row labels — includes sizing so it's a full class string
    rowLabelClass: bold ? 'text-white/50' : 'text-[#a39e97] text-xs uppercase tracking-wide font-medium',

    // Used for key-moment section headings — includes sizing
    sectionHeadingClass: bold
      ? 'text-xs font-medium uppercase tracking-wide mb-3 text-white/50'
      : 'text-xs font-medium uppercase tracking-wide mb-3 text-[#9ca3af]',

    // ── Containers ──────────────────────────────────────────────────
    card: bold
      ? 'rounded-lg px-5 py-5 space-y-3.5 bg-white/15'
      : 'rounded-lg px-6 py-5 space-y-4 bg-[#f5f2ed]',
    docList: bold ? 'divide-white/10 bg-white/15' : 'divide-[#ede9e4] bg-[#f5f2ed]',
    contentBox: bold ? 'bg-white/10' : 'bg-white border border-[#e5e5e5]',
    songList: bold ? 'divide-white/10 bg-white/5' : 'divide-[#e5e5e5] border border-[#e5e5e5]',

    // ── Inputs ──────────────────────────────────────────────────────
    inputClass: bold
      ? 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/60'
      : 'w-full rounded-lg border px-3 py-2.5 text-sm outline-none bg-white border-[#e5e5e5] text-[#1a1a1a] placeholder-[#9ca3af] focus:border-[#1a1a1a]',

    // ── Checkboxes ──────────────────────────────────────────────────
    checkboxSelected: bold ? 'bg-white border-white' : 'bg-[#1a1a1a] border-[#1a1a1a]',
    checkboxUnselected: bold ? 'border-white/30 bg-transparent' : 'border-[#d1d5db] bg-transparent',
    checkboxTick: bold ? 'text-[#1a1a1a]' : 'text-white',

    // ── Interactive states ──────────────────────────────────────────
    songRowHover: bold ? 'hover:bg-white/10' : 'hover:bg-[#f9fafb]',

    // ── CTAs ────────────────────────────────────────────────────────
    ctaClass: bold
      ? 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium transition-opacity hover:opacity-90'
      : 'flex items-center justify-center gap-2 w-full rounded-lg px-5 py-3.5 text-sm font-medium transition-colors border hover:bg-[#f5f2ed]',
    ctaStyle: (brand: string): React.CSSProperties =>
      bold
        ? { backgroundColor: brand, color: pickTextColour(brand) }
        : { borderColor: brand, color: brand },

    // ── Genre badge (active state is a runtime value) ───────────────
    genreClass: (active: boolean) => {
      if (active) return bold ? 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-white text-[#1a1a1a]' : 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-[#1a1a1a] text-white';
      return bold ? 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-white/10 text-white/70 hover:bg-white/20' : 'px-3 py-1.5 rounded-full text-sm font-medium transition-colors bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]';
    },
  };
}
