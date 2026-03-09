import type { Variants } from "framer-motion";

// Re-export dashboard animations for consistency
export {
  fadeInUp,
  staggerContainer,
  scaleIn,
  slideInLeft,
  slideInRight,
  cardHover,
  cardTap,
} from "@/components/dashboard/dashboard-animations";

export const headerSlideDown: Variants = {
  hidden: { opacity: 0, y: -10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

export const panelSlideIn: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: {
    opacity: 0,
    x: 16,
    transition: { duration: 0.2 },
  },
};

export const sidebarReveal: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 },
  },
};

export const gamePanelReveal: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.2 },
  },
};
