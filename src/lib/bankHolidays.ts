import { dayKey } from './dates';

/** Current U.S. Federal Reserve bank holiday rules, calculated locally for offline use.
 * https://www.frbservices.org/about/holiday-schedules/
 * Sunday holidays are observed Monday; Saturday holidays do not close Friday.
 */
export function bankHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const fixed = (month: number, day: number, name: string) => {
    const date = new Date(year, month - 1, day);
    const observed = date.getDay() === 0;
    if (observed) date.setDate(date.getDate() + 1);
    holidays.set(dayKey(date), name + (observed ? ' (observed)' : ''));
  };
  const nth = (month: number, weekday: number, occurrence: number, name: string) => {
    const first = new Date(year, month - 1, 1);
    const day = 1 + (weekday - first.getDay() + 7) % 7 + (occurrence - 1) * 7;
    holidays.set(dayKey(new Date(year, month - 1, day)), name);
  };

  fixed(1, 1, "New Year's Day");
  nth(1, 1, 3, 'Martin Luther King Jr. Day');
  nth(2, 1, 3, 'Presidents Day');
  const mayEnd = new Date(year, 4, 31);
  holidays.set(dayKey(new Date(year, 4, 31 - (mayEnd.getDay() + 6) % 7)), 'Memorial Day');
  if (year >= 2021) fixed(6, 19, 'Juneteenth');
  fixed(7, 4, 'Independence Day');
  nth(9, 1, 1, 'Labor Day');
  nth(10, 1, 2, 'Columbus Day');
  fixed(11, 11, 'Veterans Day');
  nth(11, 4, 4, 'Thanksgiving Day');
  fixed(12, 25, 'Christmas Day');
  return holidays;
}
