import { describe, expect, it } from 'vitest';
import { bankHolidays } from './bankHolidays';

describe('U.S. bank holidays', () => {
  it('matches the published 2026 Federal Reserve schedule', () => {
    expect(Object.fromEntries(bankHolidays(2026))).toEqual({
      '2026-01-01': "New Year's Day",
      '2026-01-19': 'Martin Luther King Jr. Day',
      '2026-02-16': 'Presidents Day',
      '2026-05-25': 'Memorial Day',
      '2026-06-19': 'Juneteenth',
      '2026-07-04': 'Independence Day',
      '2026-09-07': 'Labor Day',
      '2026-10-12': 'Columbus Day',
      '2026-11-11': 'Veterans Day',
      '2026-11-26': 'Thanksgiving Day',
      '2026-12-25': 'Christmas Day',
    });
  });

  it('moves Sunday holidays to Monday, without duplicating Sunday', () => {
    const holidays = bankHolidays(2027);
    expect(holidays.get('2027-07-05')).toBe('Independence Day (observed)');
    expect(holidays.has('2027-07-04')).toBe(false);
    expect(bankHolidays(2023).get('2023-01-02')).toBe("New Year's Day (observed)");
  });

  it('does not shift Saturday holidays to Friday or across the year boundary', () => {
    expect(bankHolidays(2026).has('2026-07-03')).toBe(false);
    expect(bankHolidays(2028).get('2028-01-01')).toBe("New Year's Day");
    expect(bankHolidays(2027).has('2027-12-31')).toBe(false);
  });

  it('handles leap years and months whose last Monday is the 31st', () => {
    expect(bankHolidays(2028).get('2028-05-29')).toBe('Memorial Day');
    expect(bankHolidays(2027).get('2027-05-31')).toBe('Memorial Day');
    expect(bankHolidays(2028).get('2028-11-23')).toBe('Thanksgiving Day');
    expect(bankHolidays(2020).has('2020-06-19')).toBe(false);
  });
});
