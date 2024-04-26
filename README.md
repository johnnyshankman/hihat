<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/johnnyshankman/hihat">
    <img src="assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">hihat</h3>

  <p align="center">
    A minimalist offline music player for OSX
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
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

*hihat* is a free way to elegantly play your music offline, similar to iTunes or Windows Media Player in the early 2000s.

*hihat* has no socials, no lag, no ads, no bulls***.

*hihat* is just music without the distractions.

[![hihat desktop preview][product-screenshot]](https://whitelights.co)

<img src="/readme-images/hihat-preview-small.png" alt="small preview" width="220"> <img width="328" alt="Screenshot 2024-04-16 at 12 18 52 PM" src="https://github.com/johnnyshankman/hihat/assets/6632701/e174c03e-0ccb-4379-91eb-5c16dd201f36"> <img width="335" alt="Screenshot 2024-04-14 at 1 47 23 PM" src="https://github.com/johnnyshankman/hihat/assets/6632701/b7a4a047-57fc-4c6f-b55e-a86ee352ec9a">

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Core Features

*hihat* has the following core features:
* 100% offline
* always dark mode
* responsively designed
* mix 'n match music file types
* compact song list
* OSX menu bar integration
* Media Keys support
* Bluetooth headphone play/pause/skip support
* bigger album art than spotify etc
* fast search
* fast import
* iTunes-like sort by default [artist -> album -> track #]
* sort by song, artist, or album
* shuffle
* song repeat
* limitless library size
* nested folder/library support (ie. legacy iTunes structure)
* generates Spotify and Apple Music links for sharing songs

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

Almost every format under the sun is supported, and they can all be mixed together into the same library seamlessly (mp3, m4a, aac, ogg, flac, wav, etc.).

* See [The Chromium Project](https://www.chromium.org/audio-video/) for detailed info on supported audio formats.
* See [Music Metadata](https://github.com/borewit/music-metadata#features) library for supported metadata formats.

Don't know where to get MP3/FLAC of your favorite albums and tracks? I suggest:
* [tidal-media-downloader](https://github.com/yaronzz/Tidal-Media-Downloader) (Works with Tidal)
* [spotify-downloader](https://github.com/spotDL/spotify-downloader) (Works with Spotify and Youtube Music)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

_To get started, hit the Import Library icon in the top right. Select your library's directory and wait for the import process to finish (1 min/10,000 songs). You can now use hihat as you would any other media player!_

<img width="331" alt="Screenshot 2023-12-17 at 10 56 38 PM" src="https://github.com/johnnyshankman/hihat/assets/6632701/a4d9d343-66e0-43af-9a23-36a7d0998f9c">

If you ever need to update your library, hit the other icon in the top right labeled Add Songs To Library. Select the files you'd like to import into your library and wait for the import process to finish. That's it!

<img width="298" alt="Screenshot 2023-12-17 at 10 56 43 PM" src="https://github.com/johnnyshankman/hihat/assets/6632701/ffade75b-0185-4392-82a9-a41c65fb8c66">

To refresh your library after making manual changes to the directory in Finder (as those are not picked up by hihat automatically), simply reimport your music folder (the same one you were using before). This will remove songs no longer there, and add any new songs you manually imported. Should be a super safe operation!

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap of Features

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
- [ ] Playlists (TBD if I'll ever do this, a ton of work is required)
- [ ] OBS extension for showing Now Playing
- [ ] Ability to "hide" songs you don't want to see, without deleting them
- [ ] Sort by date added
- [ ] Edit song metadata within hihat
- [ ] "Refresh" library button when songs are manually removed/added to library directory folder
- [ ] Playcount tracking and sort by playcount
- [ ] Show some fun stats about your library somewhere, like gb and # of songs


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



