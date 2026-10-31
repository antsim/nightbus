// All player-visible text. Scenes must not hard-code strings.
export const STR = {
  boot: {
    loading: 'Ladataan…',
    routeError: 'Reitin lataus epäonnistui.',
  },
  bus: {
    nextStopUnknown: 'Seuraava: ???',
    terminus: 'Päätepysäkki. Kaikki ulos.',
  },
  debug: {
    title: 'DEBUG (F1 piilota, F2 nopeus)',
    clock: 'Kello',
    timeScale: 'Aikakerroin',
    timeScaleUnit: 'min/s',
    seed: 'Siemen',
    intoxication: 'Humala',
    fatigue: 'Väsymys',
    cold: 'Kylmä',
    money: 'Rahat',
    modifiers: 'Modifierit',
    none: '–',
    permanent: 'pysyvä',
    logEntries: 'Lokirivejä',
    route: 'Reitti',
    position: 'offsetSec',
    busPhase: 'Bussi',
    speed: 'nopeus',
    nextStop: 'Seuraava',
    home: 'Koti',
  },
} as const;
