// All player-visible text. Scenes must not hard-code strings.
export const STR = {
  boot: {
    loading: 'Ladataan…',
  },
  bus: {
    arriving: 'Bussi tulossa…',
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
  },
} as const;
