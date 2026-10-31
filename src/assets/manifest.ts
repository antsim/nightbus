// Scenes reference assets only by key. Swapping placeholder art for real
// files only requires changing the urls here.
export interface ImageAsset {
  readonly key: string;
  /** Path relative to `public/`. */
  readonly url: string;
}

export const ASSETS = {} as const satisfies Record<string, ImageAsset>;
