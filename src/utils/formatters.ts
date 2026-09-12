export function formatCurrency(cents: number): string {
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = absCents / 100;
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(dollars);

  return isNegative ? `-${formatted}` : formatted;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
  return dateStr;
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function decimalStringToCents(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s]/g, '');
  const val = parseFloat(cleaned);
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}
