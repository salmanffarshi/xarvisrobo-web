"use client";

import type * as React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Deviation from stock shadcn source: the upstream component reads the
 * active theme from `next-themes`. This app is deliberately light-only
 * (B.1 design brief), so we hardcode `theme="light"` instead of adding
 * a theming dependency we would never use.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
