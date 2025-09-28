// scripts/build.ts
import { cp, rm } from "node:fs/promises"
import { resolve } from "node:path"
import { logger } from "./logger"

// Determine the build environment.
const isProduction = Bun.env.NODE_ENV === "production"
logger.info(
  `Running build in ${isProduction ? "production" : "development"} mode...`,
)

// Resolve paths from the project root.
const projectRoot = resolve(import.meta.dir, "..")
const distDir = resolve(projectRoot, "dist")
const srcDir = resolve(projectRoot, "src")
const tsBuildInfoDir = resolve(projectRoot, ".tsbuildinfo")

logger.info("Cleaning previous build artifacts...")
try {
  await Promise.all([
    rm(distDir, { recursive: true, force: true }),
    rm(tsBuildInfoDir, { recursive: true, force: true }),
  ])
} catch (error) {
  logger.error("Error during cleanup:", error)
  process.exit(1)
}

logger.info("Starting new build process...")

const buildResult = await Bun.build({
  entrypoints: [
    `${srcDir}/background/index.ts`,
    `${srcDir}/content/index.ts`,
    `${srcDir}/options/index.ts`,
    `${srcDir}/viewer/index.ts`,
  ],
  outdir: distDir,
  target: "browser",
  // Preserve the directory structure from `src` in the `dist` output.
  naming: "[dir]/[name].[ext]",
  minify: isProduction,
  sourcemap: isProduction ? "none" : "inline",
})

if (!buildResult.success) {
  logger.error("Bun build failed:")
  for (const log of buildResult.logs) {
    logger.error(log)
  }
  process.exit(1)
}

logger.success("TypeScript files built successfully.")
for (const output of buildResult.outputs) {
  // Make paths relative for cleaner logs.
  const relativePath = output.path.replace(`${projectRoot}/`, "")
  logger.info(`  - Emitted: ${relativePath}`)
}

logger.info("Copying static assets...")
try {
  const copyOperations = [
    // Copy manifest, locales, and shared assets.
    cp(resolve(srcDir, "manifest.json"), resolve(distDir, "manifest.json")),
    cp(resolve(srcDir, "_locales"), resolve(distDir, "_locales"), {
      recursive: true,
    }),
    cp(resolve(srcDir, "assets"), resolve(distDir, "assets"), {
      recursive: true,
    }),
    // Copy HTML files.
    cp(
      resolve(srcDir, "options/index.html"),
      resolve(distDir, "options/index.html"),
    ),
    cp(
      resolve(srcDir, "viewer/index.html"),
      resolve(distDir, "viewer/index.html"),
    ),
  ]
  await Promise.all(copyOperations)
  logger.success("Static assets copied successfully.")
} catch (error) {
  logger.error("Error copying static assets:", error)
  process.exit(1)
}

logger.success(
  "\nBuild complete! The extension is ready in the `dist` directory.",
)
