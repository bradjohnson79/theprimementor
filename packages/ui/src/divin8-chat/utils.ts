import type { CSSProperties } from "react";

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export const darkChatStyles = {
  panel: {
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.03)",
  } satisfies CSSProperties,
  panelAlt: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
  } satisfies CSSProperties,
  panelElevated: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(10,15,30,0.70)",
  } satisfies CSSProperties,
  header: {
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(8,12,22,0.92)",
  } satisfies CSSProperties,
  footer: {
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(8,12,22,0.95)",
  } satisfies CSSProperties,
  bubble: {
    borderColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(255,255,255,0.04)",
  } satisfies CSSProperties,
  bubbleSoft: {
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
  } satisfies CSSProperties,
} as const;
