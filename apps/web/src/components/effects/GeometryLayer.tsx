import { motion, useReducedMotion } from "framer-motion";

const geometryCenters = [
  { x: 120, y: 140 },
  { x: 340, y: 260 },
  { x: 580, y: 160 },
  { x: 780, y: 340 },
  { x: 460, y: 480 },
  { x: 900, y: 180 },
  { x: 220, y: 420 },
];

const petalOffsets = [
  { x: 0, y: 0 },
  { x: 18, y: 0 },
  { x: -18, y: 0 },
  { x: 9, y: 16 },
  { x: -9, y: 16 },
  { x: 9, y: -16 },
  { x: -9, y: -16 },
];

export default function GeometryLayer() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className="hero-geometry-layer"
      animate={
        prefersReducedMotion
          ? { rotate: 0, x: 0, y: 0 }
          : { rotate: [0, 3, 0, -2, 0], x: [0, 14, -10, 8, 0], y: [0, -8, 10, -6, 0] }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 50, repeat: Infinity, ease: "easeInOut" }
      }
    >
      <svg
        viewBox="0 0 1040 640"
        className="h-full w-full text-white"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <g stroke="currentColor" strokeWidth="0.8">
          {geometryCenters.map((center) => (
            <g key={`${center.x}-${center.y}`}>
              {petalOffsets.map((offset, index) => (
                <circle
                  key={`${center.x}-${center.y}-${index}`}
                  cx={center.x + offset.x}
                  cy={center.y + offset.y}
                  r="20"
                />
              ))}
            </g>
          ))}
        </g>
      </svg>
    </motion.div>
  );
}
