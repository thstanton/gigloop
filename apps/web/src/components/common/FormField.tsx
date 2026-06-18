import { cloneElement, isValidElement, useId } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({ label, required, error, children, className }: FormFieldProps) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;

  const child = isValidElement(children)
    ? cloneElement(children as React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-required'?: string }>, {
        id: fieldId,
        ...(error && { 'aria-describedby': errorId }),
        ...(required && { 'aria-required': 'true' }),
      })
    : children;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={fieldId}>
        {label}
        {required && <span aria-hidden="true" className="text-status-cancelled ml-0.5">*</span>}
      </Label>
      {child}
      {error && <p id={errorId} className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
}
