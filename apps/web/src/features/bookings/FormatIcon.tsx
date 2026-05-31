import { Heart, GlassWater, Utensils, Moon, Briefcase, Music, Music2, type LucideIcon } from 'lucide-react';

const FORMAT_ICON_MAP: Record<string, LucideIcon> = {
  heart: Heart,
  'glass-water': GlassWater,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  music: Music,
  'music-2': Music2,
};

export default function FormatIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = FORMAT_ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}
