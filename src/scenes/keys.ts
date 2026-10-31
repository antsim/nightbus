export const SceneKeys = {
  Boot: 'Boot',
  Bus: 'Bus',
  Result: 'Result',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
