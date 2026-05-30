interface SectionHeaderProps {
  label: string;
  action?: React.ReactNode;
}

export function SectionHeader({ label, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {action}
    </div>
  );
}
