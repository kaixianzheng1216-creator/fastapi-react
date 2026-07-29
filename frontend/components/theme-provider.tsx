"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider(
  properties: ComponentProps<typeof NextThemesProvider>,
) {
  return <NextThemesProvider {...properties} />;
}
