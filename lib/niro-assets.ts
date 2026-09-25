import type { NiroExpression } from "./niro";

// Final-art hook for Niro. Today every entry is null, so components render
// the in-house vector art (components/niro/NiroCharacter.tsx). When
// commissioned illustrations arrive, put them in /public/niro/ (transparent
// WebP; see public/niro/README.md for sizes) and set the path here — every
// NiroCharacter / NiroAvatar in the app switches over with no other change.
export const NIRO_ASSETS: Record<NiroExpression | "avatar", string | null> = {
  normal: null, // "/niro/niro-normal.webp"
  explaining: null, // "/niro/niro-explaining.webp"
  challenge: null, // "/niro/niro-challenge.webp"
  shocked: null, // "/niro/niro-shocked.webp"
  laughing: null, // "/niro/niro-laughing.webp"
  victory: null, // "/niro/niro-victory.webp"
  fired: null, // "/niro/niro-fired.webp"
  sleepy: null, // "/niro/niro-sleepy.webp"
  avatar: null, // "/niro/niro-avatar.webp"
};

export function niroAssetFor(key: NiroExpression | "avatar"): string | null {
  return NIRO_ASSETS[key];
}
