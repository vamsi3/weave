// scripts/clean.ts
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { logger } from "./logger"

// Resolve paths from the project root, which is one level up from `scripts`
const projectRoot = resolve(import.meta.dir, "..")
const distDir = resolve(projectRoot, "dist")
const tsBuildInfoDir = resolve(projectRoot, ".tsbuildinfo")

logger.info("Starting cleanup...")

try {
  await Promise.all([
    rm(distDir, { recursive: true, force: true }),
    rm(tsBuildInfoDir, { recursive: true, force: true }),
  ])
  logger.success("Successfully removed the following directories:")
  logger.info("  - dist")
  logger.info("  - .tsbuildinfo")
} catch (error) {
  logger.error("Error during cleanup:", error)
  process.exit(1)
}

logger.success("Cleanup complete.")
