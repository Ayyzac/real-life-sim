/** Money as it reads in the log: "$1,500". The UI has its own formatter. */
export function dollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}
