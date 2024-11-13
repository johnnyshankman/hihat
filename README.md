<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/johnnyshankman/hihat">
    <img src="assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">hihat</h3>

  <p align="center">
    The minimalist offline music player for audiophiles on OSX
    <br />
    <br />
    <a href="https://github.com/johnnyshankman/hihat/issues">Report Bug</a>
    ·
    <a href="https://github.com/johnnyshankman/hihat/issues">Request Feature</a>
    ·
    <a href="https://github.com/johnnyshankman/hihat/releases/latest">Downloads</a>
  </p>
  <p align="center">
    <img src="https://github.com/johnnyshankman/hihat/actions/workflows/build.yml/badge.svg" alt="Badge" width="105" height="20">
  </p>
</div>

## Table of Contents

1. [About The Project](#about-the-project)
    - [Core Features](#core-features)
    - [Supported Audio and Metadata Formats](#supported-audio-and-metadata-formats)
2. [Usage](#usage)
    - [Installing hihat](#installing-hihat)
    - [First Time Setup](#first-time-setup)
    - [Playing Songs](#playing-songs)
    - [Importing Songs](#importing-songs)
    - [Rescanning Your Library](#rescanning-your-library)
    - [Filtering Your Library](#filtering-your-library)
    - [Sorting Your Library](#sorting-your-library)
    - [Tips](#tips)
3. [Updating hihat to latest version](#updating-hihat-to-latest-version)
4. [Feature Roadmap](#feature-roadmap)
5. [Contributing](#contributing)
6. [License](#license)
7. [Contact](#contact)

<!-- ABOUT THE PROJECT -->
## About The Project

*hihat* was born out of frustration with the lackluster offline music players available for OSX today.

Ever tried Evermusic, Cog, Pine, Swinsian, Plexamp, or VLC? They just don't have the sleek & lagless vibes of iTunes back in 2002. Plus most aren't even freeware anymore!

That's why I decided to create *hihat* - a free, open-source music player that ditches ads, respects your privacy, and works perfectly without an internet connection.

All wrapped up in a minimalist dark-mode design that's easy on the eyes during late night listening sessions.

<a href="https://whitelights.rip" target="_blank">
<img width="1608" alt="hihat-preview" src="https://github.com/user-attachments/assets/39784fc5-ce3e-4b9a-8e45-dc35b0dcce38">
</a>
<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Core Features

*hihat* core features:
* 100% offline
* freeware
* always dark mode
* audiophile fidelity (supports all codecs)
* mix 'n match file types in one library
* limitless library size
* responsive design
* iTunes-like Browser and Library Explorer
* smart sorting by song, artist, and album
* fast library import (faster than Cog, Evermusic, etc)
* song shuffle
* song repeat
* media key/keyboard support
* OSX menu bar integration
* playcount tracking
* quick library search
* library stats
* simple album art download
* smart library deduplicator
* nested folder support (finds all music files)
* legacy iTunes library importing
* Apple Music and Spotify song lookup in one click
* sync your library to a backup drive or device running [Rockbox](https://www.rockbox.org/) in one click

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Supported Audio and Metadata Formats

Almost every format under the sun is supported, and they can all be mixed together into the same library seamlessly.

Just to name a few:
* MP3
* MP4/M4A
* AAC
* WAV
* FLAC
* ALAC
* Opus
* Ogg Vorbis
* PCM

Audio files which cannot contain album art metadata will not display album art (such as WAV). Video files and AAX audiobooks are not supported.

If you'd like to see more detailed information, check out:
* [The Chromium Project](https://www.chromium.org/audio-video/) for info on supported audio formats.
* [Music Metadata](https://github.com/borewit/music-metadata#features) library for supported metadata formats.

Don't know where to download files of your favorite albums and tracks? I suggest:
* [tidal-media-downloader](https://github.com/yaronzz/Tidal-Media-Downloader) (Works with Tidal)
* [spotify-downloader](https://github.com/spotDL/spotify-downloader) (Works with Spotify and Youtube Music)



<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

### Installing hihat

1. Download the `.dmg` file of your choosing from our [Latest Release](https://github.com/johnnyshankman/hihat/releases/tag/latest)
2. Double click it to open the contents, then drag the *hihat* application into your Apps folder

You are now all set.

**Warning: The first time you open hihat OSX will warn you that it's from an unidentified developer and ask you to confirm you want to open *hihat*. Confirm. This warning is why the application is free, I do not pay for a BS Apple Developer License just to remove this dialog.**

### First Time Setup

1. Click the "Select Library Folder" button.
2. Choose the folder on your computer where you store your music library.
3. Wait for the import process to complete (about 1 minute per 10,000 songs).
4. You're all set! Your music library is now ready to use.

<img width="700" alt="Screenshot 2024-11-07 at 5 41 45 PM" src="https://github.com/user-attachments/assets/3a66aabb-43e8-4ba8-b6ce-3340c102dad7">


### Playing Songs

* Double click on a song to play it
* Use the playback controls at the bottom of the app to pause, skip, adjust volume, shuffle, or enable song-repeat.

<img width="700" alt="Screenshot 2024-09-15 at 8 39 53 PM" src="https://github.com/user-attachments/assets/1d21bf27-d808-49fb-b5ba-7108454c0dcc">

### Importing Songs

1. Click the "+" icon in the top right corner of hihat.
2. Select the songs or folders of songs you want to add.
3. hihat will copy these files into your library folder (and intelligently ignore all non-music files)

<img width="700" alt="Screenshot 2024-09-15 at 8 40 37 PM" src="https://github.com/user-attachments/assets/eb899b57-99a5-4110-8873-83bec7f6970a">

<img width="700" alt="Screenshot 2024-09-15 at 8 37 54 PM" src="https://github.com/user-attachments/assets/5ac58659-bf89-420a-a69f-0f1d04aefb38">

### Rescanning Your Library

If you've added songs to your library manually, hihat will not see them. To scan them in:
1. Go to the hihat menu.
2. Select "Rescan Library Folder".
3. hihat will update its database with any new songs while preserving play counts and dates for existing tracks.

<img width="700" alt="Screenshot 2024-09-15 at 8 37 54 PM" src="https://github.com/user-attachments/assets/5ac58659-bf89-420a-a69f-0f1d04aefb38">

### Filtering Your Library

There is a search bar in the top right for searching through your library.

<img width="700" alt="Screenshot_2024-10-27_at_9_48_50 PM" src="https://github.com/user-attachments/assets/dd01f664-7d8e-42bd-85d0-69ac721c14ce">

### Sorting Your Library

By clicking on the table headers of your library, you can sort by:
* Song
* Album Artist
* Album
* Duration
* Date Added
* Playcount

<img width="700" alt="Screenshot_2024-10-27_at_9_49_32 PM" src="https://github.com/user-attachments/assets/f2b3db65-0572-4e0f-ac6a-e0f9c099c9ea">

### Tips

* Right-click on a song for more options, like lookup on Spotify and Delete
* Right-click on the album art for more options, like Download or Copy to Clipboard
* Explore the hihat menu for features like backing up your library or deduplicating your library
* Click on the song name in the player to scroll back to the current song
* Click on the album art to scroll back to the current song
* Try resizing the window, it fits all sorts of sizes!

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Updating hihat to latest version

Updating *hihat* is simple and ensures that you keep your library and all your settings intact. Follow these steps to update *hihat*:

1. **Download the Latest Version:**
   - Visit our [Releases](https://github.com/johnnyshankman/hihat/releases/latest) page and download the latest version of the `.dmg` file for *hihat*.

2. **Mount the DMG File:**
   - Double-click the downloaded `.dmg` file to open it. This will mount the disk image on your Mac.

3. **Replace the Existing App:**
   - In the opened window, drag and drop the *hihat* icon into the `/Applications` folder. If prompted, confirm to replace the existing application.

4. **Launch the Updated App:**
   - Go to your `/Applications` folder and run *hihat*. Your settings and configurations from previous versions will remain intact.

### Important Note
- **Preserved Settings:** Your library and all your settings are stored in a separate directory from the application itself, and therefore will not be affected by the update process!

If you encounter any issues during the update process, please refer to our [Issues](https://github.com/johnnyshankman/hihat/issues) page for assistance.

## Built With

This project was built with the following technologies:

* [![Electron][Electron.js]][Electron-url]
* [![React][React.js]][React-url]
* [![Electron React Boilerplate][ElectronReactBoilerplate.js]][ElectronReactBoilerplate-url]
* [![Typescript][Typescript.js]][Typescript-url]
* [![Google Material UI][MaterialUI.js]][MaterialUI-url]
* [![zustand][zustand.js]][zustand-url]
* [![Tailwind][Tailwind.js]][Tailwind-url]
* [![Music Metadata][MusicMetadata.js]][MusicMetadata-url]
* [![Gapless 5][Gapless5.js]][Gapless5-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Feature Roadmap

- [x] Autoplay Next Song
- [x] Virtualized Lists for opitmal rendering
- [x] Cache imported songs from previous session
- [x] Minimalist search/filter solution
- [x] Recursive file finding for itunes-like libraries with nested folders
- [x] Update/import skips pre-existing files
- [x] On reboot, scroll to last played song, queue it up as well
- [x] Shuffle songs
- [x] Repeat song
- [x] Resort by column
- [x] When deleting/hiding a song don't lose user's place
- [x] Support keyboard previous/next
- [x] Fix the player UX on thin windows (400px)
- [x] OSX song info in the menu bar tray thing
- [x] Copy album art for sharing
- [x] Download album art for sharing
- [x] Ability to "open in finder" so you can see the song file
- [x] Redo player UX on small screens, it's function over fashion atm
- [x] Insert new songs or albums without reimporting the whole library
- [x] Click on song info to scroll back to it
- [x] Shareable Spotify search links
- [x] Shareable Apple Music search links
- [x] Sort by date added
- [x] Playcount tracking and sort by playcount
- [x] Ability to "hide" songs you don't want to see, with or without deleting their file in filesystem
- [x] Ability to deduplicate identical songs in library easily
- [x] Ability to delete entire albums of songs from library and filestystem
- [x] Adjustable column widths for songname, artist, and album
- [x] Sort by albumartist not the plain old artist, pretty much only used by rap albums with features (2Pac - All Eyez On Me)
- [x] Adjustable album art size
- [x] Shuffle "history" for hitting previous
- [x] Mute and max buttons
- [x] Show stats about your library somewhere, like GB and # of songs
- [x] iTunes-like browser with list of artist and album filters
- [x] Quiet mode creating bg music to a video/audiobook/podcast in another app
- [ ] True gapless playback
- [ ] Edit song metadata
- [ ] Hide/show columns in the Library List
- [ ] Queue a next-up song
- [ ] Smart playlists (Top 50, Recently Played, Recently Added)
- [ ] User defined playlists


See the [open issues](https://github.com/johnnyshankman/hihat/issues) for a full list of proposed features (and known issues).

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTRIBUTING -->
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

<!-- GETTING STARTED -->
## Getting Started As A Contributor

_Follow the steps below to install the local development environment and serve the development application locally._

### Prerequisites

* node v20
  ```sh
  brew install nvm
  nvm install v20
  nvm use v20
  ```

* npm v10 or higher
  ```sh
  npm install npm@latest -g
  ```

### Installation

1. Clone the repo
   ```sh
   git clone https://github.com/johnnyshankman/hihat.git
   ```
3. Install NPM packages
   ```sh
   npm install
   ```

### Running Local App

1. Run the app in development with hot reloading
   ```sh
   npm run start
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- LICENSE -->
## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- CONTACT -->
## Contact

Johnny aka White Lights - [@iamwhitelights](https://twitter.com/iamwhitelights)

Project Link: [https://github.com/johnnyshankman/hihat](https://github.com/johnnyshankman/hihat)

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/johnnyshankman/hihat.svg?style=for-the-badge
[contributors-url]: https://github.com/johnnyshankman/hihat/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/johnnyshankman/hihat.svg?style=for-the-badge
[forks-url]: https://github.com/johnnyshankman/hihat/network/members
[stars-shield]: https://img.shields.io/github/stars/johnnyshankman/hihat.svg?style=for-the-badge
[stars-url]: https://github.com/johnnyshankman/hihat/stargazers
[issues-shield]: https://img.shields.io/github/issues/johnnyshankman/hihat.svg?style=for-the-badge
[issues-url]: https://github.com/johnnyshankman/hihat/issues
[license-shield]: https://img.shields.io/github/license/johnnyshankman/hihat.svg?style=for-the-badge
[license-url]: https://github.com/johnnyshankman/hihat/blob/master/LICENSE.txt
[product-screenshot]: readme-images/hihat-preview.png
[product-screenshot-small]: readme-images/hihat-preview-small.png
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Electron.js]: https://img.shields.io/badge/Electron-20232A?style=for-the-badge&logo=electron&logoColor=61DAFB
[Electron-url]: https://www.electronjs.org/
[Tailwind.js]: https://img.shields.io/badge/Tailwind-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[Tailwind-url]: https://tailwindcss.com/
[ElectronReactBoilerplate.js]: https://img.shields.io/badge/ElectronReactBoilerplate-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[ElectronReactBoilerplate-url]: https://electron-react-boilerplate.js.org/
[MusicMetadata.js]: https://img.shields.io/badge/MusicMetadata-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[MusicMetadata-url]: https://github.com/borewit/music-metadata
[MaterialUI.js]: https://img.shields.io/badge/MaterialUI-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[MaterialUI-url]: https://mui.com/material-ui/
[Typescript.js]: https://img.shields.io/badge/Typescript-20232A?style=for-the-badge&logo=typescript&logoColor=007ACC
[Typescript-url]: https://typescriptlang.org
[zustand.js]: https://img.shields.io/badge/Zustand-20232A?style=for-the-badge&logo=javascript&logoColor=007ACC
[zustand-url]: [https://typescriptlang.org](https://github.com/pmndrs/zustand)https://github.com/pmndrs/zustand
[Gapless5.js]: https://img.shields.io/badge/Gapless5-20232A?style=for-the-badge&logo=javascript&logoColor=007ACC
[Gapless5-url]: https://github.com/regosen/Gapless-5



