# Changelog

All notable changes to Weave are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-08-22

### Fixed

- **Stitching correctness**: segments are now positioned by the scroll offset
  they were *actually* captured at, instead of assuming perfect
  viewport-height steps. Pages using scroll-snap, sticky layouts that clamp
  scrolling, or fractional browser zoom no longer produce duplicated or
  shifted bands in the output.
- **1px seams at fractional zoom**: sub-pixel rounding gaps between segments
  are snapped closed instead of leaving hairline blank lines.
- **Rate-limit failures on long pages**: captures are paced to stay under
  Chrome's `captureVisibleTab` quota (2 calls/second), which previously could
  abort long captures with an opaque error.
- **Extremely long pages**: output is clamped to the maximum canvas dimension
  (32,767px) instead of silently producing a blank image.

### Changed

- Capture geometry is now a pure, unit-tested module (`bun test`) with
  branded `CssPx`/`DevicePx` types making unit confusion a compile error.
- The message protocol between content, background, options and viewer is
  typed end-to-end: response types are inferred from each message, and
  capture responses are a discriminated success/failure union.
- Settings read from `chrome.storage` are runtime-validated with per-field
  fallbacks to defaults instead of blind type casts.
- Downloads are awaited and failures logged; settings load failures fall
  back to defaults instead of breaking capture.

### Internal

- Toolchain updated to 2026 latest: TypeScript 7, Biome 2.5, Bun 1.3,
  `@types/chrome` 0.2, with `typecheck` and `test` scripts added.
- Biome's new HTML linter enabled; genuine a11y fixes applied
  (explicit `type="button"`, image `alt` placeholder).

## [1.0.1] - 2025-09

- Initial Chrome Web Store release line.
