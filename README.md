<a name="readme-top"></a>

<br />
<div align="center">
  <a href="https://github.com/johnnyshankman/hihat">
    <img src="assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">hihat</h3>

  <p align="center">
    The minimalist offline music player for macOS
    <br />
    <br />
    <a href="https://github.com/johnnyshankman/hihat/releases/latest">Download</a>
    ·
    <a href="https://github.com/johnnyshankman/hihat/issues">Report Bug</a>
    ·
    <a href="https://github.com/johnnyshankman/hihat/issues">Request Feature</a>
  </p>
  <p align="center">
    <img src="https://github.com/johnnyshankman/hihat/actions/workflows/build.yml/badge.svg" alt="Build status" width="105" height="20">
    <img src="https://img.shields.io/github/v/release/johnnyshankman/hihat?label=release&color=success" alt="Latest release" height="20">
    <img src="https://img.shields.io/github/downloads/johnnyshankman/hihat/total?label=downloads&color=blue" alt="Total downloads" height="20">
    <img src="https://img.shields.io/github/license/johnnyshankman/hihat?color=lightgrey" alt="License" height="20">
  </p>
</div>

![hihat main window showing dark-themed music library with sidebar, track list, and player bar](screenshots/hero-main-window.png)

## Table of Contents

1. [About The Project](#about-the-project)
2. [Getting Started](#getting-started)
    - [Installing hihat](#installing-hihat)
    - [First Time Setup](#first-time-setup)
    - [Updating hihat](#updating-hihat)
3. [Features](#features)
4. [Supported Audio Formats](#supported-audio-formats)
5. [User Guide](#user-guide)
6. [Roadmap](#roadmap)
7. [Built With](#built-with)
8. [Contributing](#contributing)
9. [Getting Started as a Contributor](#getting-started-as-a-contributor)
10. [License](#license)
11. [Contact](#contact)

## About The Project

**hihat** is a free, minimalist, open-source music player for macOS. It plays every major audio format with true gapless playback, manages libraries of any size, and comes with a sleek responsive interface.

No ads, no accounts, no internet — just your music.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started

### Installing hihat

1. Download the `.dmg` file from the [Latest Release](https://github.com/johnnyshankman/hihat/releases/latest)
2. Double-click the `.dmg` to open it, then drag **hihat** into your Applications folder

That's it — hihat is now installed and ready to use.

> **Note:** The first time you open hihat, macOS will warn you it's from an unidentified developer and ask you to confirm. This is expected — hihat is free and does not pay for an Apple Developer License to suppress this dialog.

### First Time Setup

1. Open hihat
2. Click the **Settings** icon (gear) in the top-right corner of the sidebar
3. Under **Music Folder**, click the folder icon to select the folder where you store your music
4. Confirm you want to scan the folder
5. Wait for the import to complete (about 1 minute per 10,000 songs)
6. Your library is ready — start playing!

![hihat first-time setup showing the Settings drawer with Library Location folder picker](screenshots/setup-library-location.png)

### Updating hihat

To check whether a newer version is available, open the **hihat** menu in the macOS menu bar and choose **check for updates**. hihat will tell you if you're already on the latest version or point you to the new release.

To install an update:

1. Download the latest `.dmg` from the [Releases](https://github.com/johnnyshankman/hihat/releases/latest) page
2. Drag the new **hihat** into your Applications folder and confirm the replacement
3. Open hihat — your library, playlists, play counts, and settings are all preserved

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Features

**Library Management**
* Import any folder structure — hihat finds all music files recursively
* Smart deduplication on import (prefers higher-quality files)
* Fast library scanning (~1 minute per 10,000 songs)
* Edit metadata for any track — changes are written back to the audio file tags
* Library stats: total songs, size in GB, total plays, and total hours (via the hihat menu)
* Incremental library backup to any external drive

**Playback**
* True gapless playback
* Shuffle with navigable history (up to 100 tracks)
* Repeat modes: off, single track, or all
* Play count tracking with duration-based threshold
* Last Played date tracking

**Organization**
* User-created playlists — create, rename, delete, and add or remove tracks
* Smart playlists: Recently Added, Recently Played, and Most Played (top 50 each, updated automatically)
* Browser panel for filtering by album artist and album
* Sort by any column
* Quick search bar — filter by title, artist, album, or genre
* Customizable column visibility — right-click any column header
* Drag-and-drop column reordering
* Drag and drop tracks to sidebar playlists
* Per-view search filters preserved across navigation
* Persistent sorting preferences per playlist
* Persistent column widths

**Interface**
* Dark and Light themes
* Mini Player mode — a floating window with album art
* Frameless macOS-native window with traffic light controls
* Collapsible sidebar navigation
* Multi-select with bulk operations (Cmd+Click, Shift+Click)
* Scrolling marquee for long track and artist names
* Responsive design down to 540px

**Integration**
* macOS media keys, keyboard, and Bluetooth headphone support
* macOS menu bar with playback controls and keyboard shortcuts
* macOS Now Playing widget integration
* Find on Spotify, Apple Music, and Tidal in one click
* Download album art from any track
* Show any track's file in Finder

![hihat in light theme with Browser panel open at the top](screenshots/features-light-theme-artist-browser.png)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Supported Audio Formats

Almost every format under the sun is supported, and they can all be mixed together in the same library:

* MP3
* MP4/M4A
* AAC
* WAV
* FLAC
* ALAC
* Opus
* Ogg Vorbis
* PCM

For detailed format information, see:
* [The Chromium Project](https://www.chromium.org/audio-video/) for supported audio formats
* [Music Metadata](https://github.com/borewit/music-metadata#features) for supported metadata formats

#### Limitations
* hihat does not play online streams
* hihat does not play protected content (M4P, AAX)
* hihat does not display album art for formats that do not embed it (WAV)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## User Guide

A full walkthrough of hihat's features — playback, playlists, browsing and search, the Mini Player, metadata editing, right-click actions, settings, keyboard shortcuts, and tips — lives in a separate document so this README stays focused on getting you up and running.

**See the [hihat User Guide](USER_GUIDE.md)** for everything you can do once the app is open.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Edit song metadata
- [ ] Queue a next-up song
- [ ] Ability to Change Audio Outputs

See the [open issues](https://github.com/johnnyshankman/hihat/issues) for a full list of proposed features and known issues.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built With

* [![Electron][Electron.js]][Electron-url]
* [![React][React.js]][React-url]
* [![Typescript][Typescript.js]][Typescript-url]
* [![Google Material UI][MaterialUI.js]][MaterialUI-url]
* [![zustand][zustand.js]][zustand-url]
* [![TanStack Query][TanStackQuery.js]][TanStackQuery-url]
* [![TanStack Table][TanStackTable.js]][TanStackTable-url]
* [![SQLite][SQLite.js]][SQLite-url]
* [![Music Metadata][MusicMetadata.js]][MusicMetadata-url]
* [![Gapless 5][Gapless5.js]][Gapless5-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting Started as a Contributor

### Prerequisites

* Node v22+
  ```sh
  brew install nvm
  nvm install 22
  nvm use 22
  ```

* npm v10+
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/johnnyshankman/hihat.git
   ```
2. Install dependencies
   ```sh
   npm install
   ```

### Available Scripts

```sh
npm run start          # Dev mode with hot reload
npm run build          # Production build (main + renderer)
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run typecheck      # TypeScript type checking
npm run test           # Jest unit tests
npm run test:e2e       # Playwright E2E tests
npm run package        # Build + package Electron app
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Johnny aka White Lights - [@iamwhitelights](https://twitter.com/iamwhitelights)

Project Link: [https://github.com/johnnyshankman/hihat](https://github.com/johnnyshankman/hihat)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/johnnyshankman/hihat.svg?style=for-the-badge
[contributors-url]: https://github.com/johnnyshankman/hihat/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/johnnyshankman/hihat.svg?style=for-the-badge
[forks-url]: https://github.com/johnnyshankman/hihat/network/members
[stars-shield]: https://img.shields.io/github/stars/johnnyshankman/hihat.svg?style=for-the-badge
[stars-url]: https://github.com/johnnyshankman/hihat/stargazers
[issues-shield]: https://img.shields.io/github/issues/johnnyshankman/hihat.svg?style=for-the-badge
[issues-url]: https://github.com/johnnyshankman/hihat/issues
[license-shield]: https://img.shields.io/github/license/johnnyshankman/hihat.svg?style=for-the-badge
[license-url]: https://github.com/johnnyshankman/hihat/blob/master/LICENSE
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Electron.js]: https://img.shields.io/badge/Electron-20232A?style=for-the-badge&logo=electron&logoColor=61DAFB
[Electron-url]: https://www.electronjs.org/
[ElectronReactBoilerplate.js]: https://img.shields.io/badge/ElectronReactBoilerplate-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[ElectronReactBoilerplate-url]: https://electron-react-boilerplate.js.org/
[MusicMetadata.js]: https://img.shields.io/badge/MusicMetadata-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[MusicMetadata-url]: https://github.com/borewit/music-metadata
[MaterialUI.js]: https://img.shields.io/badge/MaterialUI-20232A?style=for-the-badge&logo=mui&logoColor=61DAFB
[MaterialUI-url]: https://mui.com/material-ui/
[Typescript.js]: https://img.shields.io/badge/Typescript-20232A?style=for-the-badge&logo=typescript&logoColor=007ACC
[Typescript-url]: https://typescriptlang.org
[zustand.js]: https://img.shields.io/badge/Zustand-20232A?style=for-the-badge&logo=javascript&logoColor=007ACC
[zustand-url]: https://github.com/pmndrs/zustand
[TanStackQuery.js]: https://img.shields.io/badge/TanStack_Query-20232A?style=for-the-badge&logo=reactquery&logoColor=FF4154
[TanStackQuery-url]: https://tanstack.com/query
[TanStackTable.js]: https://img.shields.io/badge/TanStack_Table-20232A?style=for-the-badge&logo=javascript&logoColor=007ACC
[TanStackTable-url]: https://tanstack.com/table
[Gapless5.js]: https://img.shields.io/badge/Gapless5-20232A?style=for-the-badge&logo=javascript&logoColor=007ACC
[Gapless5-url]: https://github.com/regosen/Gapless-5
[SQLite.js]: https://img.shields.io/badge/SQLite-20232A?style=for-the-badge&logo=sqlite&logoColor=007ACC
[SQLite-url]: https://sql.js.org
