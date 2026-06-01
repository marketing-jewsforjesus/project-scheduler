/**
 * HOLIDAYS.JS
 * US Federal Holidays + commonly observed additional days.
 * Provides working-day arithmetic used throughout the scheduler.
 */

// ─────────────────────────────────────────────────────────────
//  HOLIDAY GENERATION (2024 – 2035)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the Nth occurrence of a weekday in a given month/year.
 * @param {number} year
 * @param {number} month  0-based (0 = Jan, 11 = Dec)
 * @param {number} weekday  0 = Sun, 1 = Mon, ... 6 = Sat
 * @param {number} n  1-based (1 = first, 2 = second, -1 = last)
 */
function nthWeekdayOfMonth(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(year, month, 1);
    const diff  = (weekday - first.getDay() + 7) % 7;
    return new Date(year, month, 1 + diff + (n - 1) * 7);
  } else {
    // negative: count from end of month
    const last = new Date(year, month + 1, 0); // last day of month
    const diff = (last.getDay() - weekday + 7) % 7;
    return new Date(year, month + 1, 0 - diff + (n + 1) * 7);
  }
}

/**
 * Adjusts a fixed-date holiday to its observed date.
 * If falls on Saturday → observed Friday.
 * If falls on Sunday → observed Monday.
 */
function observedDate(year, month, day) {
  const d = new Date(year, month, day);
  const dow = d.getDay();
  if (dow === 6) return new Date(year, month, day - 1); // Sat → Fri
  if (dow === 0) return new Date(year, month, day + 1); // Sun → Mon
  return d;
}

/** Format a Date as "YYYY-MM-DD" */
function fmt(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─────────────────────────────────────────────────────────────
//  JEWISH HIGH HOLIDAYS  (Rosh Hashanah + Yom Kippur)
//
//  These follow the Hebrew lunisolar calendar so dates vary each year.
//  Weekend observance matches US federal holiday rules:
//    Saturday holiday → observed on Friday
//    Sunday  holiday → observed on Monday
//
//  Lookup: [month (1-based), day] of Rosh Hashanah Day 1 for each year.
//  Yom Kippur is always exactly 9 calendar days after Rosh Hashanah Day 1.
// ─────────────────────────────────────────────────────────────
const _ROSH_HASHANAH = {
  2024: [10,  2], // Oct 2  (Wed)
  2025: [ 9, 22], // Sep 22 (Mon)
  2026: [ 9, 11], // Sep 11 (Fri)
  2027: [10,  1], // Oct 1  (Fri)
  2028: [ 9, 20], // Sep 20 (Wed)
  2029: [ 9,  9], // Sep 9  (Sun)
  2030: [ 9, 28], // Sep 28 (Sat)
  2031: [ 9, 18], // Sep 18 (Thu)
  2032: [ 9,  6], // Sep 6  (Mon)
  2033: [ 9, 25], // Sep 25 (Sun)
  2034: [ 9, 14], // Sep 14 (Thu)
  2035: [10,  4], // Oct 4  (Thu)
};

/**
 * Build an array of { date: "YYYY-MM-DD", name: string } for a given year.
 * Includes US Federal holidays + common observed days.
 */
function buildHolidaysForYear(year) {
  const holidays = [];

  function add(dateObj, name) {
    if (dateObj) holidays.push({ date: fmt(dateObj), name });
  }

  // 1. New Year's Day — Jan 1 (observed)
  add(observedDate(year, 0, 1), "New Year's Day");

  // 2. Martin Luther King Jr. Day — 3rd Monday of January
  add(nthWeekdayOfMonth(year, 0, 1, 3), "Martin Luther King Jr. Day");

  // 3. Presidents' Day (Washington's Birthday) — 3rd Monday of February
  add(nthWeekdayOfMonth(year, 1, 1, 3), "Presidents' Day");

  // 4. Memorial Day — Last Monday of May
  add(nthWeekdayOfMonth(year, 4, 1, -1), "Memorial Day");

  // 5. Juneteenth — June 19 (observed) [established 2021]
  if (year >= 2021) add(observedDate(year, 5, 19), "Juneteenth");

  // 6. Independence Day — July 4 (observed)
  add(observedDate(year, 6, 4), "Independence Day");

  // 7. Labor Day — 1st Monday of September
  add(nthWeekdayOfMonth(year, 8, 1, 1), "Labor Day");

  // 8. Columbus Day — 2nd Monday of October
  add(nthWeekdayOfMonth(year, 9, 1, 2), "Columbus Day");

  // 9. Veterans Day — November 11 (observed)
  add(observedDate(year, 10, 11), "Veterans Day");

  // 10. Thanksgiving Day — 4th Thursday of November
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4);
  add(thanksgiving, "Thanksgiving Day");

  // 11. Day After Thanksgiving (Black Friday) — observed day
  if (thanksgiving) {
    const dayAfter = new Date(thanksgiving);
    dayAfter.setDate(dayAfter.getDate() + 1);
    add(dayAfter, "Day After Thanksgiving");
  }

  // 12. Christmas Eve — December 24 (observed if falls on weekend)
  add(observedDate(year, 11, 24), "Christmas Eve");

  // 13. Christmas Day — December 25 (observed)
  add(observedDate(year, 11, 25), "Christmas Day");

  // ── Jewish High Holidays ─────────────────────────────
  // Sat → Fri, Sun → Mon (same observance rule as above).
  // JS Date constructor auto-normalises month/day overflow, so
  // e.g. new Date(2030, 8, 37) correctly resolves to Oct 7.
  const rh = _ROSH_HASHANAH[year];
  if (rh) {
    const [rhM, rhD] = rh;

    // Rosh Hashanah Day 1 (observed)
    const rh1 = observedDate(year, rhM - 1, rhD);
    add(rh1, 'Rosh Hashanah');

    // Rosh Hashanah Day 2 (observed) — skip if it collapses to the same
    // weekday as Day 1 (e.g. Day 2 = Sat observed Fri = same as Day 1 = Fri)
    const rh2 = observedDate(year, rhM - 1, rhD + 1);
    if (fmt(rh2) !== fmt(rh1)) add(rh2, 'Rosh Hashanah (Day 2)');

    // Yom Kippur — 9 calendar days after Rosh Hashanah Day 1 (observed)
    add(observedDate(year, rhM - 1, rhD + 9), 'Yom Kippur');
  }

  // Sort by date
  holidays.sort((a, b) => (a.date > b.date ? 1 : -1));

  return holidays;
}

// ─────────────────────────────────────────────────────────────
//  CACHE: keep generated holiday sets in memory
// ─────────────────────────────────────────────────────────────
const _holidayCache = {};

function getHolidaysForYear(year) {
  if (!_holidayCache[year]) {
    _holidayCache[year] = buildHolidaysForYear(year);
  }
  return _holidayCache[year];
}

/** Returns a Set of "YYYY-MM-DD" holiday strings for quick lookup. */
function getHolidaySet(year) {
  return new Set(getHolidaysForYear(year).map(h => h.date));
}

// ─────────────────────────────────────────────────────────────
//  WORKING-DAY UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Returns true if `date` is a working day
 * (Mon–Fri, not a US federal/observed holiday).
 * @param {Date} date
 */
function isWorkingDay(date) {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return false; // weekend
  const str = fmt(date);
  const year = date.getFullYear();
  return !getHolidaySet(year).has(str);
}

/**
 * Move to the next working day (or stay if already a working day).
 * @param {Date} date
 */
function nextWorkingDay(date) {
  const d = new Date(date);
  while (!isWorkingDay(d)) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Move to the previous working day (or stay if already a working day).
 * @param {Date} date
 */
function prevWorkingDay(date) {
  const d = new Date(date);
  while (!isWorkingDay(d)) d.setDate(d.getDate() - 1);
  return d;
}

/**
 * Add N working days to a date.
 * Positive N = forward; negative N = backward.
 * @param {Date}   startDate
 * @param {number} n   number of working days (can be negative)
 */
function addWorkingDays(startDate, n) {
  const d = new Date(startDate);
  const step = n >= 0 ? 1 : -1;
  let remaining = Math.abs(n);
  while (remaining > 0) {
    d.setDate(d.getDate() + step);
    if (isWorkingDay(d)) remaining--;
  }
  return d;
}

/**
 * Given a step's start date and its duration in working days,
 * return the step's end date (the last working day of the step).
 * Duration of 1 = starts and ends on the same day.
 * @param {Date}   startDate
 * @param {number} workingDays
 */
function calcEndDate(startDate, workingDays) {
  if (workingDays <= 0) return new Date(startDate);
  return addWorkingDays(startDate, workingDays - 1);
}

/**
 * Given a step's end date and its duration in working days,
 * return the step's start date (backward calculation).
 * @param {Date}   endDate
 * @param {number} workingDays
 */
function calcStartDateFromEnd(endDate, workingDays) {
  if (workingDays <= 0) return new Date(endDate);
  return addWorkingDays(endDate, -(workingDays - 1));
}

/**
 * Add N calendar weeks to a date.
 * @param {Date}   date
 * @param {number} weeks  (can be negative)
 */
function addCalendarWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/**
 * Count working days between two dates (inclusive of both endpoints
 * if they are working days).
 * @param {Date} startDate
 * @param {Date} endDate
 */
function countWorkingDays(startDate, endDate) {
  let count = 0;
  const d = new Date(startDate);
  // ensure we go in the right direction
  const end = new Date(endDate);
  if (d > end) return 0;
  while (d <= end) {
    if (isWorkingDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/**
 * Parse a "YYYY-MM-DD" string into a local Date (no timezone shift).
 * @param {string} str
 */
function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a Date for display: "Mon, Jun 2" style.
 * @param {Date} date
 */
function fmtDisplay(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric'
  });
}

/**
 * Format a Date for display with year: "Jun 2, 2026"
 * @param {Date} date
 */
function fmtDisplayFull(date) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

// ─────────────────────────────────────────────────────────────
//  FIRST WEEKDAY UTILITIES (for anchor descriptions)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the first Monday of a given month/year.
 * @param {number} year
 * @param {number} month  0-based
 */
function firstMondayOfMonth(year, month) {
  return nthWeekdayOfMonth(year, month, 1, 1);
}

// Expose everything on a global namespace for other scripts
window.Holidays = {
  getHolidaysForYear,
  getHolidaySet,
  isWorkingDay,
  nextWorkingDay,
  prevWorkingDay,
  addWorkingDays,
  addCalendarWeeks,
  calcEndDate,
  calcStartDateFromEnd,
  countWorkingDays,
  parseDate,
  fmt,
  fmtDisplay,
  fmtDisplayFull,
  firstMondayOfMonth,
};
