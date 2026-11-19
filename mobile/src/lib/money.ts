// Money as US dollars: $1,250 or $764.50 (cents only when there are any).
export function money(amount: number): string {
  const cents = Math.round(amount * 100) % 100 !== 0;
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
