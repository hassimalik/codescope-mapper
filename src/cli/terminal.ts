export type ColorMode = "auto" | "always" | "never";

interface TerminalStream {
  isTTY?: boolean;
}

const ansi = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  cyan: "\u001B[36m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  red: "\u001B[31m",
} as const;

export type Style = keyof Omit<typeof ansi, "reset">;

/**
 * Small, dependency-free terminal formatter. Its behavior follows common CLI
 * conventions: colors are used for TTYs, NO_COLOR disables them, and
 * FORCE_COLOR enables them for redirected output.
 */
export class Terminal {
  readonly colorEnabled: boolean;

  constructor(mode: ColorMode, stream: TerminalStream) {
    const noColor = process.env.NO_COLOR !== undefined;
    const forceColor =
      process.env.FORCE_COLOR !== undefined && process.env.FORCE_COLOR !== "0";

    this.colorEnabled =
      mode === "always" ||
      (mode === "auto" && !noColor && (forceColor || Boolean(stream.isTTY)));
  }

  format(text: string, ...styles: readonly Style[]): string {
    if (!this.colorEnabled || styles.length === 0) {
      return text;
    }

    return `${styles.map((style) => ansi[style]).join("")}${text}${ansi.reset}`;
  }

  heading(text: string): string {
    return this.format(text, "bold", "cyan");
  }

  label(text: string): string {
    return this.format(text, "bold");
  }

  success(text: string): string {
    return this.format(text, "green");
  }

  warning(text: string): string {
    return this.format(text, "yellow");
  }

  error(text: string): string {
    return this.format(text, "bold", "red");
  }

  muted(text: string): string {
    return this.format(text, "dim");
  }
}
