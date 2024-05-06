<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/johnnyshankman/hihat">
    <img src="assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">hihat</h3>

  <p align="center">
    A minimalist offline music player for audiophiles on OSX
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

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#setting-your-library">Setting Your Library</a></li>
        <li><a href="#adding-more-songs">Adding More Songs</a></li>
        <li><a href="#refreshing-your-library">Refreshing Your Library</a></li>
      </ul>
    </li>
    <li><a href="#feature-roadmap">Feature Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

*hihat* is the best way play your music library offline on OSX, similar to iTunes or Windows Media Player circa 2002.

*hihat* has no socials, no lag, and no ads.

a music player without the distractions.

[![hihat desktop preview][product-screenshot]](https://whitelights.co)

<img width="555" alt="Screenshot 2024-05-05 at 10 14 04 PM" src="https://github.com/johnnyshankman/hihat/assets/6632701/5487ffb6-0676-460e-8613-1c44880223df">

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Core Features

*hihat* has the following core features:
* 100% offline
* always dark mode
* responsive design
* audiophile fidelity (supports all file types)
* mix 'n match file types (mp3, m4a, flac, etc)
* limitless library size
* compact UX
* song shuffle
* song repeat
* Media Keys support
* Bluetooth headphone play/pause/skip support
* OSX menu bar integration
* downloadable album art
* quick search
* fast import
* sort by song, artist, album, date added or playcount
* iTunes-like sorting for artist [artist -> album -> track num]
* nested folder/library support (ie. legacy iTunes structure)
* Spotify and Apple Music share links for every song

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

This project was built with the following technologies:

* [![Electron][Electron.js]][Electron-url]
* [![React][React.js]][React-url]
* [![Electron React Boilerplate][ElectronReactBoilerplate.js]][ElectronReactBoilerplate-url]
* [![Typescript][Typescript.js]][Typescript-url]
* [![Google Material UI][MaterialUI.js]][MaterialUI-url]
* [![zustand][zustand.js]][zustand-url]
* [![Tailwind][Tailwind.js]][Tailwind-url]
* [![Music Metadata][MusicMetadata.js]][MusicMetadata-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>


### Supported Audio and Metadata Formats

Almost every format under the sun is supported, and they can all be mixed together into the same library seamlessly.

Just to name a few:
* MP3
* MP4
* Ogg
* WebM
* WAV
* FLAC
* Opus
* PCM
* Vorbis
* AAC

If you'd like to see more detailed information, check out:
* [The Chromium Project](https://www.chromium.org/audio-video/) for info on supported audio formats.
* [Music Metadata](https://github.com/borewit/music-metadata#features) library for supported metadata formats.

Don't know where to download files of your favorite albums and tracks? I suggest:
* [tidal-media-downloader](https://github.com/yaronzz/Tidal-Media-Downloader) (Works with Tidal)
* [spotify-downloader](https://github.com/spotDL/spotify-downloader) (Works with Spotify and Youtube Music)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

### Setting Your Library

_Hit the "Import Library" icon in the top right (or in the `hihat` menu)._

_Then select your library's directory and wait for the import process to finish. This process takes about 1min per 10,000 songs imported._

<img width="331" alt="Screenshot 2023-12-17 at 10 56 38 PM" src="https://github.com/johnnyshankman/hihat/assets/6632701/a4d9d343-66e0-43af-9a23-36a7d0998f9c">

### Adding More Songs

_Hit the "Add Songs" icon in the top right (or in the `hihat` menu)._

<img width="326" alt="Screenshot 2024-05-05 at 1 18 04 AM" src="https://github.com/johnnyshankman/hihat/assets/6632701/399013e3-0b60-45c9-93ff-93535f8c7ce3">

### Refreshing Your Library

_If you make manual changes to your library's directory in Finder, you will want to reimport your library. Simply hit `import library` under the `hihat` menu and reselec your existing library directory._

<img width="289" alt="Screenshot 2024-05-05 at 1 17 42 AM" src="https://github.com/johnnyshankman/hihat/assets/6632701/bcf30959-01f1-4847-96bd-85c4bfbd9734">

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
- [x] Support keyboard previous/next
- [x] Fix the player UX on thin windows (400px)
- [x] OSX song info in the menu bar tray thing
- [x] Copy album art for sharing
- [x] Download album art for sharing
- [x] Ability to "open in finder" so you can see the song file
- [x] Redo player UX on small screens, it's function over fashion atm
- [x] Ability to insert new songs or albums without updating the whole library
- [x] Click on song info to scroll back to it
- [x] Generative shareable Spotify search links
- [x] Generative shareable Apple Music search links
- [x] Sort by date added
- [x] Playcount tracking and sort by playcount
- [ ] Playlists (TBD if I'll ever do this, a ton of work is required)
- [ ] Ability to "hide" songs you don't want to see, without deleting their file
- [ ] Edit song file metadata
- [ ] Show some fun stats about your library somewhere, like gb and # of songs
- [ ] Hide and show columns in the viewer
- [ ] iTunes like "browser" for going seeing scrollabe list of artists/albums


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

This is an example of how to list things you need to use the software and how to install them.
* npm
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



