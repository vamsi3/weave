// scripts/clean.ts
import { rm } from "node:fs/promises"
import { resolve } from "node:path"
import { Glob } from "bun"
import { logger } from "./logger"

const projectRoot = resolve(import.meta.dir, "..")
const distDir = resolve(projectRoot, "dist")
const tsBuildInfoDir = resolve(projectRoot, ".tsbuildinfo")

logger.info("Starting cleanup...")

try {
  // Find all zip files matching the pattern in the root directory.
  const glob = new Glob("weave-*.zip")
  const zipFilesToDelete = []
  for await (const file of glob.scan(projectRoot)) {
    zipFilesToDelete.push(resolve(projectRoot, file))
  }

  // Combine all deletion operations into a single array of promises.
  const operations = [
    rm(distDir, { recursive: true, force: true }),
    rm(tsBuildInfoDir, { recursive: true, force: true }),
    ...zipFilesToDelete.map((file) => rm(file, { force: true })),
  ]

  await Promise.all(operations)

  logger.success("Successfully removed the following:")
  logger.info("  - dist/")
  logger.info("  - .tsbuildinfo/")
  if (zipFilesToDelete.length > 0) {
    logger.info("  - weave-*.zip")
  }
} catch (error) {
  logger.error("Error during cleanup:", error)
  process.exit(1)
}

logger.success("Cleanup complete.")
