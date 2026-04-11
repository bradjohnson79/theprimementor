import { motion, useReducedMotion } from "framer-motion";

export default function AuroraLayer() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className="hero-aurora-layer"
      initial={{ opacity: 0.48, x: "-8%", y: "-3%", rotate: -2, scale: 1.03 }}
      animate={
        prefersReducedMotion
          ? { opacity: 0.44, x: 0, y: 0, rotate: 0, scale: 1 }
          : {
              opacity: [0.44, 0.62, 0.5, 0.58, 0.44],
              x: ["-8%", "6%", "-4%", "3%", "-8%"],
              y: ["-3%", "4%", "0%", "-2%", "-3%"],
              rotate: [-2, 2, -1, 1.5, -2],
              scale: [1.03, 1.08, 1.01, 1.06, 1.03],
            }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 32, repeat: Infinity, ease: "easeInOut" }
      }
    />
  );
}
