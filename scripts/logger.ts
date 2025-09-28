// scripts/logger.ts
import pc from "picocolors"

/**
 * A simple and elegant logger utility that adds color and a consistent
 * prefix to console messages, making build script outputs easy to read.
 */
const prefix = pc.bold(pc.magenta("[Weave]"))

export const logger = {
  /**
   * Logs a standard informational message.
   * @param args - Arguments to log, similar to `console.log`.
   */
  info: (...args: unknown[]) => {
    console.log(prefix, pc.cyan("→"), ...args)
  },

  /**
   * Logs a success message, typically after a process completes successfully.
   * @param args - Arguments to log.
   */
  success: (...args: unknown[]) => {
    console.log(prefix, pc.green("✓"), ...args)
  },

  /**
   * Logs a warning message.
   * @param args - Arguments to log.
   */
  warn: (...args: unknown[]) => {
    console.warn(prefix, pc.yellow("!"), ...args)
  },

  /**
   * Logs an error message. If an argument is an Error object, its message
   * will be formatted correctly.
   * @param args - Arguments to log.
   */
  error: (...args: unknown[]) => {
    const formattedArgs = args.map((arg) => {
      if (arg instanceof Error) {
        return `\n${pc.red(arg.stack ?? arg.message)}`
      }
      return arg
    })
    console.error(prefix, pc.red("✗"), ...formattedArgs)
  },
}
