export function getMonthlyUnavailableSummaryLabel(params: {
  calendarMonthKey: string;
  currentMonthKey: string;
}): string {
  return params.calendarMonthKey === params.currentMonthKey
    ? '本月餘下日子暫滿'
    : '本月暫滿';
}
