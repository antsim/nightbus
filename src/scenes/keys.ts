export const SceneKeys = {
  Boot: 'Boot',
  Title: 'Title',
  Bus: 'Bus',
  Result: 'Result',
  Debug: 'Debug',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
