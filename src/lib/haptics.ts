// Tiny vibration patterns for moments that matter. Android browsers support
// this; iPhone web apps don't (the call is simply ignored there).

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* not supported */
  }
}

export const haptics = {
  /** A light tick for taps: tabs, quick-add, the check-in button. */
  tap: () => buzz(10),
  /** Something worked: a check-in confirmed, a set logged. */
  success: () => buzz([18, 40, 70]),
  /** A milestone: 5/5, a streak record. */
  milestone: () => buzz([20, 40, 30, 40, 90]),
};
