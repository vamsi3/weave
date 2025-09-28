// scripts/build.ts
import { cp, readFile, rm } from "node:fs/promises"
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

// --- Version Synchronization Check ---
const packageJsonPath = resolve(projectRoot, "package.json")
const manifestJsonPath = resolve(srcDir, "manifest.json")

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf-8"))
const manifestJson = JSON.parse(await readFile(manifestJsonPath, "utf-8"))

const packageVersion = packageJson.version
const manifestVersion = manifestJson.version

if (packageVersion !== manifestVersion) {
  logger.error(
    `Version mismatch! package.json version is "${packageVersion}" while manifest.json version is "${manifestVersion}".`,
  )
  logger.error("Please ensure both versions are in sync before building.")
  process.exit(1)
}

logger.info(`Building extension version: ${packageVersion}`)
const version = packageVersion // Use the verified version for the zip file.
const zipFileName = `weave-${version}.zip`
const zipFilePath = resolve(projectRoot, zipFileName)

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

// --- Create Production Zip ---
if (isProduction) {
  logger.info(`Creating production zip file: ${zipFileName}...`)
  try {
    // Before zipping, remove any existing zip file with the same name.
    await rm(zipFilePath, { force: true })

    // The command needs to be run from within the dist directory
    // to ensure the paths inside the zip are correct (e.g., manifest.json, not dist/manifest.json).
    const zipProcess = Bun.spawnSync({
      cmd: ["zip", "-r", zipFilePath, "."],
      cwd: distDir,
    })

    if (!zipProcess.success) {
      const stderr = new TextDecoder().decode(zipProcess.stderr)
      throw new Error(`Failed to create zip file. Stderr: ${stderr}`)
    }

    logger.success(`Successfully created ${zipFileName}`)
  } catch (error) {
    logger.error("Error creating zip file:", error)
    process.exit(1)
  }
}

logger.success(
  "\nBuild complete! The extension is ready in the `dist` directory.",
)
