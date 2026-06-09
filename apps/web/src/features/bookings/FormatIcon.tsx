import { Music } from 'lucide-react';
import { PACKAGE_ICON_MAP } from '@/lib/constants';

export default function FormatIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}
