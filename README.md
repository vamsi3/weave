<h1 align="center">
  <p align="center">
    <img src="assets/README Icon (96x96).png" alt="Weave Logo" width="30em" style="vertical-align: middle; margin-right: 15px;">
    Weave
  </p>
</h1>

<p align="center">
  Seamlessly capture and stitch full-page screenshots with a single click.
  <br />
  <br />
  <a href="#about-the-project"><strong>Explore the features »</strong></a>
  <br />
  <br />
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/chrome-v120%2B-brightgreen.svg" alt="Chrome Version">
  <a href="https://github.com/sponsors/vamsi3" target="_blank">
    <img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="Sponsor on GitHub" />
  </a>
</p>

---

<p align="center">
  <img src="assets/README Banner (1440x800).png" alt="Weave promotional thumbnail showing a long screenshot of a webpage being captured and displayed in the viewer.">
</p>

## About The Project

**Weave** is a powerful and intuitive Chrome extension designed to make full-page screen captures effortless and accurate. Gone are the days of manually scrolling, taking multiple screenshots, and painstakingly stitching them together. Weave automates the entire process, intelligently scrolling through a webpage, capturing every section, and weaving them into a single, pixel-perfect image.

Built with modern web technologies, Weave is lightweight, fast, and privacy-focused. It runs entirely in your browser, ensuring your captured data remains secure. Whether you're a designer saving inspiration, a developer debugging a layout, or anyone needing to archive a full webpage, Weave is the perfect tool for the job.

## ✨ Key Features

*   **📜 True Full-Page Capture:** Weave automatically scrolls the entire page, capturing and stitching each visible section to create one continuous, high-resolution image.

*   **🧠 Smart Element Handling:** Intelligently detects and handles sticky headers, footers, and other fixed-position elements to prevent them from appearing multiple times in your final screenshot.

*   **🚀 Flexible Workflow Actions:** Choose what happens the moment your screenshot is ready. Configure your default action in the settings for a workflow that fits your needs.
    *   **Open in Viewer:** Instantly preview your screenshot in a clean, dedicated viewer tab.
    *   **Direct Download:** Save the image directly to your downloads folder.
    *   **Copy to Clipboard:** Copy the screenshot to your clipboard for immediate pasting.

*   **🖼️ Instant Preview & Action Hub**
    The beautiful built-in viewer lets you inspect your capture and decide what to do next. The interface is clean, responsive, and supports both light and dark modes.

    <p align="center">
      <img src="./assets/weave-screenshot-preview.png" alt="Weave's screenshot viewer page, showing a captured webpage and buttons to 'Copy' and 'Download'." width="700">
    </p>

*   **⚙️ Customizable Settings**
    Tailor Weave to your liking. The settings page allows you to set your preferred one-click action and decide whether you want to be prompted to choose a file name and location for every download.

    <p align="center">
      <img src="./assets/weave-settings.png" alt="Weave's settings page, showcasing the segmented button for 'Default Action' and the toggle for 'Ask where to save'." width="700">
    </p>

*   **🌍 Multi-Language Support:** The UI is available in dozens of languages thanks to internationalization support.

*   **🎨 Light & Dark Mode:** The extension's UI (settings and viewer) automatically adapts to your system's preferred color scheme for a comfortable viewing experience.

## 🚀 Getting Started

### For Users

The easiest way to install Weave is through the Chrome Web Store.

[**Install Weave from the Chrome Web Store**](https://chromewebstore.google.com/detail/ibeaikmdlelfijnemegcagglbbcmlkie)

### For Developers

To get a local copy up and running for development or testing, follow these simple steps.

#### Prerequisites

*   Node.js and pnpm
    ```sh
    npm install -g pnpm
    ```

#### Installation & Building

1.  **Clone the repo**
    ```sh
    git clone https://github.com/your-username/weave.git
    cd weave
    ```
2.  **Install dependencies**
    ```sh
    pnpm install
    ```
3.  **Build the extension**
    This command will compile the TypeScript files and copy all static assets into the `dist` directory.
    ```sh
    pnpm run build
    ```
4.  **Load the extension in Chrome**
    *   Open Chrome and navigate to `chrome://extensions`.
    *   Enable "Developer mode" using the toggle in the top-right corner.
    *   Click the "Load unpacked" button.
    *   Select the `dist` folder that was created in your project directory.

## 🛠️ Technical Snapshot

Weave is built with a modern, efficient, and framework-free stack:

*   **Manifest V3:** Adhering to the latest Chrome extension standards for enhanced security and performance.
*   **TypeScript:** Ensuring type safety and maintainable code across the project.
*   **Service Worker:** The extension's background logic runs in a non-persistent service worker for optimal resource management.
*   **Offscreen API:** Used for reliably copying images to the clipboard, a requirement under Manifest V3.
*   **Plain HTML, CSS, & JS:** For a lightweight, fast, and dependency-free user interface.

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

Please feel free to fork the repo, create a feature branch, and submit a pull request. You can also open an issue with the "bug" or "enhancement" tag.

## ❤️ Support This Project

Weave is an open-source project I develop and maintain in my spare time. If you find this extension useful and would like to support its continued development, you can do so through GitHub Sponsors. Your support helps me dedicate more time to new features, improvements, and bug fixes.

<a href="https://github.com/sponsors/vamsi3" target="_blank">
  <img src="https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86" alt="Sponsor on GitHub" />
</a>

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
