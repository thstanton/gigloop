import { Music } from 'lucide-react';
import { PACKAGE_ICON_MAP } from '@/lib/constants';

/**
 * Renders the Lucide icon for a package/format icon key, falling back to Music
 * when the key is unknown. Single source for package icon rendering across the
 * app (booking detail, performance editor, package templates, logistics).
 */
export function PackageIcon({
  icon,
  size = 14,
  strokeWidth,
}: {
  icon: string;
  size?: number;
  strokeWidth?: number;
}) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={size} strokeWidth={strokeWidth} />;
}
