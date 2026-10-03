import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppearanceControl } from './AppearanceControl';

describe('AppearanceControl', () => {
  it('renders an accessible radiogroup with one radio per preference, reflecting the value', () => {
    render(<AppearanceControl value="dark" onChange={vi.fn()} />);
    expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'System' })).not.toBeChecked();
  });

  it('calls onChange when an option is clicked', async () => {
    const onChange = vi.fn();
    render(<AppearanceControl value="system" onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(onChange).toHaveBeenCalledWith('light');
  });

  it('moves and selects with the arrow keys, wrapping at the ends', async () => {
    const onChange = vi.fn();
    render(<AppearanceControl value="system" onChange={onChange} />);
    screen.getByRole('radio', { name: 'System' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('light');
    screen.getByRole('radio', { name: 'System' }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('dark');
  });

  it('selects the focused option with Space and only tabs to the selected one', async () => {
    const onChange = vi.fn();
    render(<AppearanceControl value="light" onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Dark' })).toHaveAttribute('tabindex', '-1');
    screen.getByRole('radio', { name: 'Dark' }).focus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});
