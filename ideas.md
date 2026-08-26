# FitCheck Design Brainstorm

## Approach 1 — Light Table Editorial
**Very Brief Intro:** A cool paper-and-ink fitting-room interface shaped by photo contact sheets, editorial crop marks, and grease-pencil annotations. It feels tactile, observant, and quietly opinionated rather than like a generic AI dashboard.

**Probability:** 0.03

## Approach 2 — Locker Room Signal
**Very Brief Intro:** A sporty, high-contrast utility interface inspired by varsity locker labels, garment tags, and post-game scoreboards. It would feel energetic, social, and slightly competitive.

**Probability:** 0.07

## Approach 3 — After-Hours Mirror
**Very Brief Intro:** A cinematic, low-light mirror-check experience with charcoal surfaces, reflective cards, and restrained amber indicators. It would feel intimate and nightlife-oriented.

**Probability:** 0.02

# Chosen Direction — Light Table Editorial

## Design Movement
Contemporary editorial systems design blended with analog photography process artifacts: contact sheets, light tables, crop marks, film edge codes, and hand-marked selections.

## Core Principles
1. **Mark, do not decorate:** every line, label, and annotation should feel like it helps inspect a fit.
2. **Quiet field, loud decision:** the interface stays disciplined so the score reveal and primary action can carry the drama.
3. **Asymmetric composition:** layouts should feel pinned, cropped, and offset like a working image board rather than centered like a SaaS dashboard.
4. **Specific over flattering:** copy names visible garments, colors, proportions, and occasion signals; it never hides behind generic praise.

## Color Philosophy
FitCheck uses cool paper as its light-table surface, ink for editorial authority, contact-sheet gray for measurement and structure, grease-pencil red for the single decisive mark, and darkroom green as a rare confidence signal. The red is intentionally scarce so the score circle and the main action read as the same moment of judgment.

## Layout Paradigm
A pinned-frame canvas replaces the typical card stack. Home is a workbench with the current frame offset against a diagonal evidence rail; upload is a framed capture station; results are a single developed contact-sheet frame with margin notes running vertically beside the image; history is a strip of developed frames with a thin score trace crossing through them.

## Signature Elements
- An irregular grease-pencil red circle that draws around the score like an editor's pick.
- Small crop marks and frame-number edge codes that identify each developed fit.
- Contact-sheet thumbnails with offset borders and tiny red registration dots.

## Interaction Philosophy
Interactions should feel like handling a print: press states compress slightly, frames lift a few pixels, and selected images snap into a precise crop. The app should reward decisive, low-friction actions and make every transition explain what has happened to the frame.

## Animation
Use spring-based motion for frame entrances, score counting, button press feedback, and image settling. Results should orchestrate in one sequence: photo settles, crop marks snap in, grease-pencil circle draws over roughly 700ms, score counts into place, then category bars and margin notes arrive with 80ms staggered offsets. Avoid ambient looping animation. Gate non-essential motion behind `prefers-reduced-motion`.

## Typography System
- **Display:** `Archivo Black` for the main score, page titles, and major result labels only.
- **Body:** `Public Sans` for instructions, feedback, buttons, and supporting content.
- **Utility mono:** `IBM Plex Mono` for frame numbers, timestamps, category labels, and technical hints.

Display type should feel stamped and compact. Body type should be calm and highly legible. Utility mono should be used sparingly as a measurement layer, never for long paragraphs.

## Brand Essence
FitCheck is a visual outfit check for people who want a sharper read before they step out — specific, fast, and more useful than a thumbs-up.

**Personality:** observant, direct, tactile.

## Brand Voice
Headlines and CTAs use active verbs with a slight editorial edge. Microcopy is concise, concrete, and never apologetic. Avoid generic filler and empty praise.

Example lines:
- “Develop the frame you are about to wear.”
- “Good structure. Let the shirt breathe.”

## Wordmark & Logo
The mark is a bold outlined `F` built from two offset crop brackets, with the inner counter shaped like a registration target. The wordmark should be set in a condensed heavy grotesk with the `C` slightly opened, as if it were a crop tool, rather than typed in a default sans.

## Signature Brand Color
**Grease-pencil red — `#E14F2A`.** It is the ownable signal of judgment: warm enough to feel human and physical, sharp enough to guide attention on the cool paper field.

## Style Decisions
- Results use one dominant image frame, not repeated cards.
- Grease-pencil red is reserved for score marks, primary CTAs, and tiny registration details.
- No purple gradients, generic dark AI dashboard styling, or excessive rounded cards.
- All major page files should include a local style reminder comment at the top.
