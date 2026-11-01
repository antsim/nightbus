import type { ReportLine } from '../core/report';

// Humorous receipt lines. Every matching line is a candidate; up to three are picked per run.
export const REPORT_LINES: readonly ReportLine[] = [
  { when: (r) => r.outcome.kind === 'terminus', text: 'Kuski herätti. Kuski ei ollut vaikuttunut.' },
  { when: (r) => r.outcome.kind === 'terminus', text: 'Päätepysäkki on myös pysäkki. Teknisesti.' },
  { when: (r) => r.outcome.kind === 'home' && r.microsleeps === 0, text: 'Hereillä koko matkan. Epäilyttävää.' },
  { when: (r) => r.outcome.kind === 'home', text: 'Avain löytyi ensimmäisestä taskusta. Ihme.' },
  { when: (r) => r.outcome.kind === 'home' && r.microsleeps > 0, text: 'Torkuit, mutta heräsit oikeaan aikaan. Ammattilainen.' },
  { when: (r) => r.stopsMissed >= 5, text: 'Kävit katsomassa naapurikunnan.' },
  { when: (r) => r.stopsMissed >= 1 && r.stopsMissed < 5, text: (r) => `${r.stopsMissed} pysäkkiä meni unessa. Ei niitä kukaan kaipaa.` },
  { when: (r) => r.outcome.kind === 'tooEarly' && r.wrongStops >= 5, text: 'Ulkoilu tekee hyvää. Toivottavasti.' },
  { when: (r) => r.outcome.kind === 'tooEarly', text: 'Hyppäsit pois innokkaasti. Liian innokkaasti.' },
  { when: (r) => r.outcome.kind === 'overshot', text: 'Kotipysäkki vilkutti ikkunan takaa.' },
  { when: (r) => r.outcome.kind === 'overshot' && r.wrongStops === 1, text: 'Vain yksi pysäkki ohi. Melkein.' },
  { when: (r) => r.longestMicrosleepMin >= 4, text: (r) => `Pisin torkku ${r.longestMicrosleepMin.toFixed(1).replace('.', ',')} min. Virkistävää.` },
  { when: (r) => r.microsleeps >= 3, text: 'Silmäluomet voittivat erät 1–3.' },
  { when: (r) => r.score >= 1200, text: 'Ennätyskelpoista yöliikkumista.' },
  { when: (r) => r.outcome.kind === 'sick', text: 'Bussin lattia selvisi. Juuri ja juuri.' },
  { when: (r) => r.outcome.kind === 'sick' && r.outcome.early, text: 'Raitis ilma ennen kotia. Kävely tekee hyvää. Kai.' },
  { when: (r) => r.outcome.kind === 'sick' && !r.outcome.early, text: 'Kotipysäkki meni, mutta niin meni muukin.' },
  { when: (r) => r.outcome.kind === 'home' && r.nauseaCritical, text: 'Pakkopoistuminen osui kotipysäkille. Tätä kutsutaan tuuriksi.' },
  { when: (r) => r.longestEyesShutSec >= 8, text: 'Lepuutit silmiä. Maisema ei karannut mihinkään.' },
  { when: () => true, text: 'Matkalippu oli voimassa. Luultavasti.' },
];
