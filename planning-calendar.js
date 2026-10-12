/* Calendario único de semanas de planeación 2026-2027. */
(function (root, factory) {
  const calendar = factory();
  root.CARPETA_PLANNING_CALENDAR = calendar;
  if (typeof module === 'object' && module.exports) module.exports = calendar;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const TIME_ZONE = 'America/Cancun';
  const WEEKS = [
    ['2026-08-31', '2026-09-04'], ['2026-09-07', '2026-09-11'],
    ['2026-09-14', '2026-09-18'], ['2026-09-21', '2026-09-25'],
    ['2026-09-28', '2026-10-02'], ['2026-10-05', '2026-10-09'],
    ['2026-10-12', '2026-10-16'], ['2026-10-19', '2026-10-23'],
    ['2026-10-26', '2026-10-30'], ['2026-11-02', '2026-11-06'],
    ['2026-11-09', '2026-11-13'], ['2026-11-16', '2026-11-20'],
    ['2026-11-23', '2026-11-27'], ['2026-11-30', '2026-12-04'],
    ['2026-12-07', '2026-12-11'], ['2026-12-14', '2026-12-18'],
    ['2027-01-04', '2027-01-08', '2027-01-07'], ['2027-01-11', '2027-01-15'],
    ['2027-01-18', '2027-01-22'], ['2027-01-25', '2027-01-29'],
    ['2027-02-01', '2027-02-05'], ['2027-02-08', '2027-02-12'],
    ['2027-02-15', '2027-02-19'], ['2027-02-22', '2027-02-26'],
    ['2027-03-01', '2027-03-05'], ['2027-03-08', '2027-03-12'],
    ['2027-03-15', '2027-03-19'], ['2027-04-05', '2027-04-09'],
    ['2027-04-12', '2027-04-16'], ['2027-04-19', '2027-04-23'],
    ['2027-04-26', '2027-04-30'], ['2027-05-03', '2027-05-07'],
    ['2027-05-10', '2027-05-14'], ['2027-05-17', '2027-05-21'],
    ['2027-05-24', '2027-05-28'], ['2027-05-31', '2027-06-04'],
    ['2027-06-07', '2027-06-11'], ['2027-06-14', '2027-06-18'],
    ['2027-06-21', '2027-06-25'], ['2027-06-28', '2027-06-30']
  ].map(function (row, index) {
    return { number: index + 1, start: row[0], end: row[1], activeStart: row[2] || row[0] };
  });

  const VACATIONS = [
    { start: '2026-12-21', end: '2027-01-05' },
    { start: '2027-03-22', end: '2027-04-04' }
  ];

  function parseDate(value) {
    const parts = String(value || '').split('-').map(Number);
    return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1, 12, 0, 0, 0);
  }

  function isoDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function today() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).reduce(function (map, part) {
      map[part.type] = part.value; return map;
    }, {});
    return parts.year + '-' + parts.month + '-' + parts.day;
  }

  function inRange(value, start, end) {
    return value >= start && value <= end;
  }

  function normalizeWeekend(value) {
    const date = parseDate(value);
    const day = date.getDay();
    if (day === 6) date.setDate(date.getDate() - 1);
    if (day === 0) date.setDate(date.getDate() - 2);
    return isoDate(date);
  }

  function formatDay(value) {
    return parseDate(value).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  function formatRange(start, end) {
    const first = parseDate(start), last = parseDate(end);
    if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
      return 'Del ' + first.getDate() + ' al ' + last.getDate() + ' de ' +
        last.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    }
    if (first.getFullYear() === last.getFullYear()) {
      return 'Del ' + first.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' }) +
        ' al ' + last.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return 'Del ' + formatDay(start) + ' al ' + formatDay(end);
  }

  function resolve(dateValue) {
    const selected = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || '')) ? String(dateValue) : today();
    const vacation = VACATIONS.find(function (period) { return inRange(selected, period.start, period.end); });
    if (vacation) return { type: 'vacation', selected: selected, start: vacation.start, end: vacation.end, title: 'Periodo vacacional', rangeLabel: formatRange(vacation.start, vacation.end) };
    if (selected < '2026-08-31') return { type: 'before', selected: selected, title: 'El periodo de planeación aún no inicia', rangeLabel: 'Inicia el 31 de agosto de 2026' };
    if (selected > '2027-06-30') return { type: 'after', selected: selected, title: 'Periodo de planeación finalizado', rangeLabel: 'Finalizó el 30 de junio de 2027' };
    if (selected === '2027-01-06') {
      const week = WEEKS[16];
      return Object.assign({}, week, { type: 'suspension', selected: selected, anchor: selected, title: 'Suspensión de clases · Semana 17', rangeLabel: formatRange(week.start, week.end) });
    }
    const anchor = normalizeWeekend(selected);
    const week = WEEKS.find(function (item) {
      return anchor >= item.activeStart && anchor <= item.end;
    });
    if (!week) return { type: 'gap', selected: selected, anchor: anchor, title: 'Sin semana de planeación', rangeLabel: formatDay(selected) };
    return Object.assign({}, week, {
      type: 'week', selected: selected, anchor: anchor,
      title: 'Semana ' + week.number,
      rangeLabel: formatRange(week.start, week.end)
    });
  }

  function daysFor(info) {
    if (!info || !info.start || !info.number) return [];
    const start = parseDate(info.start);
    const labels = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'];
    return labels.map(function (label, index) {
      const date = new Date(start); date.setDate(start.getDate() + index);
      return { label: label, day: date.getDate(), date: isoDate(date), selected: isoDate(date) === info.anchor };
    });
  }

  return {
    timeZone: TIME_ZONE,
    weeks: WEEKS,
    vacations: VACATIONS,
    today: today,
    resolve: resolve,
    daysFor: daysFor,
    formatDay: formatDay,
    formatRange: formatRange
  };
});
