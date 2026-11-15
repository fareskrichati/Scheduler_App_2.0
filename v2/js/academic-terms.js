(function (root) {
  function hasDates(term) {
    return Boolean(term?.start && term?.end && term.start <= term.end);
  }

  function savedTerms(settings) {
    if (Array.isArray(settings?.academicCalendars)) return settings.academicCalendars;
    const legacy = settings?.academicCalendar;
    return hasDates(legacy) ? [{ ...legacy, id: legacy.id || legacy.start }] : [];
  }

  function contains(term, date, end = term.end) {
    return date >= term.start && date <= end;
  }

  function isClassDay(term, date) {
    return (!hasDates(term) || contains(term, date))
      && !(term?.breaks || []).some((range) => contains(range, date));
  }

  function allowsClassDate(settings, date) {
    const terms = savedTerms(settings);
    return terms.length ? terms.some((term) => isClassDay(term, date)) : isClassDay(settings?.academicCalendar, date);
  }

  function saveTerm(settings, term) {
    const saved = savedTerms(settings);
    const calendar = {
      ...term,
      breaks: (term.breaks || []).filter((range) => range.end >= term.start && range.start <= (term.finalsEnd || term.end)),
    };
    return {
      ...settings,
      academicCalendar: calendar,
      academicCalendars: [...saved.filter((entry) => entry.id !== term.id), calendar].sort((a, b) => a.start.localeCompare(b.start)),
    };
  }

  function meetingKey(item) {
    return JSON.stringify([item.title.trim().toLowerCase(), item.date, item.start, item.end]);
  }

  function isActiveTerm(term, date) {
    return !term || contains(term, date, term.finalsEnd || term.end);
  }

  const api = { savedTerms, contains, isClassDay, allowsClassDate, saveTerm, meetingKey, isActiveTerm };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.UniPlanTerms = api;
})(globalThis);
