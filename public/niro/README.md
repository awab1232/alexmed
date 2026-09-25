# Niro — character assets

Niro is NiroLearn's AI learning companion. He is an original, anime-style character:
- black / very dark navy messy hair with **one cyan strand**
- electric-blue / cyan eyes
- a deep-navy oversized hoodie with cyan drawstrings and the **Niro Spark** on the chest

## Current state (v1)

All expressions are rendered by **in-house vector art** in `components/niro/NiroCharacter.tsx`. That's a single SVG character, and each expression changes only the brows, eyes, mouth, tilt and a small pose detail. It's production-usable, but it is **not** final commissioned illustration.

No raster files ship yet. `lib/niro-assets.ts` maps every expression to `null`.

## Replacing with final artwork

Commission these (transparent **WebP**, plus a PNG master), all as the *same* character:

| File | Pose / use | Suggested size |
|---|---|---|
| `niro-normal.webp` | relaxed, hand in hoodie pocket — default | 600×660 |
| `niro-explaining.webp` | one hand raised/pointing, Spark at the hand — explanations, PDF, answers | 600×660 |
| `niro-challenge.webp` | confident side smile — quizzes, games, "almost there" | 600×660 |
| `niro-victory.webp` | ✌️ victory — correct answers, completed levels | 600×660 |
| `niro-fired.webp` | determined, energy — hard challenges, streaks | 600×660 |
| `niro-shocked.webp` | surprised (use rarely) | 600×660 |
| `niro-laughing.webp` | eyes closed, genuine laugh (use rarely) | 600×660 |
| `niro-sleepy.webp` | sleepy (use very rarely) | 600×660 |
| `niro-avatar.webp` | head-and-shoulders, readable at 20–40 px | 256×256 |

Frame each bust like the vector version: head in the upper half, shoulders cut at the bottom, and transparent background.

To switch over, put each file in this folder and set its path in `lib/niro-assets.ts`, for example `explaining: "/niro/niro-explaining.webp"`. Every `NiroCharacter` / `NiroAvatar` uses it automatically.

## Rules

- Niro is a companion, not decoration: avatar for everyday AI, the bigger character only for meaningful moments. See `lib/niro.ts` for expression usage and his voice.
- Never show AI model or provider names in Niro's experience.
