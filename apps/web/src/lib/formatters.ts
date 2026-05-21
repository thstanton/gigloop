const _date = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const _day = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

const _currency = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

const _currencyWhole = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatDate(iso: string): string {
  return _date.format(new Date(iso));
}

export function formatDateAndDay(iso: string): { date: string; day: string } {
  const d = new Date(iso);
  return { date: _date.format(d), day: _day.format(d) };
}

export function formatCurrency(amount: number): string {
  return _currency.format(amount);
}

export function formatCurrencyWhole(amount: number): string {
  return _currencyWhole.format(amount);
}

export function formatFee(fee: string | null): string | null {
  if (!fee) return null;
  const n = parseFloat(fee);
  return isNaN(n) ? null : _currency.format(n);
}

export function formatFeeWhole(fee: string | null): string | null {
  if (!fee) return null;
  const n = parseFloat(fee);
  return isNaN(n) ? null : _currencyWhole.format(n);
}

