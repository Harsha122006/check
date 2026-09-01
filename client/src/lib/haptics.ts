export type HapticLevel = "light" | "medium" | "success";

export function hapticPattern(level: HapticLevel) {
  return level === "success" ? [18, 12, 28] : level === "medium" ? 18 : 8;
}

export function triggerHaptic(level: HapticLevel) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    return navigator.vibrate(hapticPattern(level));
  } catch {
    return false;
  }
}
