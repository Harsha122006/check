# FitCheck Visual Refresh

## Design direction

FitCheck now uses a brighter fashion-tech editorial direction: warm paper, soft mint atmosphere, coral action color, and electric blue information accents. The goal is to feel energetic and memorable without becoming neon, childish, or visually dense.

## Selected colors

| Role | Hex | Usage |
| --- | --- | --- |
| Warm paper | `#F7F3EE` | Primary page background and browser theme color |
| Surface white | `#FFFDFC` | Elevated sections and layered backgrounds |
| Ink | `#18232A` | Headlines, primary text, and high-contrast controls |
| Muted ink | `#53636B` | Supporting copy and secondary metadata |
| Line | `#DCE4E2` | Hairline borders, tracks, and dividers |
| Coral | `#FF6257` | Primary CTA, active emphasis, scan line, and editorial highlight |
| Electric blue | `#4868FF` | Scores, icons, progress bars, and interactive focus |
| Soft mint | `#D8F0EC` | Secondary surfaces and level-up/supporting cards |
| Butter yellow | `#F4C95D` | Decorative sneaker accent |
| Success green | `#3F9D72` | Saved-state feedback |

The color system maintains readable text contrast by using dark ink for important copy and reserving coral and blue for large, legible UI elements, score emphasis, and controls.

## Typography

The interface uses **DM Sans** for readable body copy, controls, metadata, and buttons. **Instrument Serif** supplies the high-contrast editorial display treatment for hero headlines and large result numbers. **Manrope** remains available for compact utility labels and the existing mono-style metadata treatment.

## Clothing-inspired animations

The home screen now includes three original CSS-built fashion silhouettes rather than pasted emoji: a floating coral tee, a slow-swaying blue denim shape, and a compact butter-yellow sneaker. They sit behind the main copy, use `pointer-events: none`, and are reduced in scale and opacity on narrow screens so the CTA remains dominant.

## Animation technique

Motion uses the existing **Framer Motion** layer for stage transitions, analysis scanning, score reveals, and progress bars. CSS handles lightweight decorative movement and entrance animation using GPU-friendly `opacity`, `transform`, and `translate` properties. The motion language uses short cubic-bezier ease-out transitions, slight scale feedback, 100ms-style staggered entrances, and `prefers-reduced-motion` fallbacks. No AI, scoring, persistence, authentication, upload, or navigation logic was changed.

## Screens changed

The home/workbench screen received the largest visual change: new palette, display typography, entrance staging, elevated CTA treatment, richer photo controls, and clothing accents. The upload screen received the refreshed palette, readable hierarchy, selected-state polish, and elevated source cards. The AI analysis screen received the updated scan-line treatment, progress track, and new four-step copy: Scanning fit, Checking colors, Analyzing style, and Finalizing score. The results screen keeps the existing real scores and the prior count-up/progress-bar behavior while adopting the new palette, stronger result hierarchy, and refined transition. The archive screen inherits the refreshed type, surface, border, hover, and card treatments.

## Validation notes

The project passed the existing 24 Vitest tests, TypeScript validation, and production build after the refresh. Desktop and narrow mobile home renders were checked for hierarchy, contrast, CTA prominence, and decorative-accent containment. The existing live Manus deployment remains the active deployment target; external provider migration remains deferred.
