"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

/**
 * Every screen fades in when you arrive, so changing tabs never feels like a
 * hard cut. Opacity only: a transform here would break fixed-position UI
 * (sheets, the chat composer) inside the page.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
