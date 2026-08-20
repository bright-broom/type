import type { ComponentPropsWithoutRef } from "react";
import styles from "./PageShell.module.css";

export type PageShellWidth = "wide" | "default" | "reading" | "assessment" | "session" | "game" | "compact";
export type PageShellSpacing = "standard" | "compact" | "none";

type PageShellProps = ComponentPropsWithoutRef<"main"> & {
  width: PageShellWidth;
  spacing?: PageShellSpacing;
  centered?: boolean;
};

const WIDTH_CLASSES: Record<PageShellWidth, string> = {
  wide: styles.wide,
  default: styles.default,
  reading: styles.reading,
  assessment: styles.assessment,
  session: styles.session,
  game: styles.game,
  compact: styles.compact,
};

const SPACING_CLASSES: Record<PageShellSpacing, string> = {
  standard: "",
  compact: styles.compactSpacing,
  none: styles.noSpacing,
};

export function PageShell({ width, spacing = "standard", centered = false, className, ...props }: PageShellProps) {
  const classes = [styles.root, WIDTH_CLASSES[width], SPACING_CLASSES[spacing], centered && styles.centered, className]
    .filter(Boolean)
    .join(" ");

  return <main {...props} className={classes} data-layout-shell={width} />;
}
