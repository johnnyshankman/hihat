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
        <li><a href="#core-features">Core Features</a></li>
        <li><a href="#supported-audio-and-metadata-formats">Supported Audio and Metadata Formats</a></li>
      </ul>
    </li>
    <li>
      <a href="#usage">Usage</a>
      <ul>
        <li><a href="#initializing-your-library">Setting Your Library</a></li>
        <li><a href="#adding-new-songs">Adding More Songs</a></li>
        <li><a href="#rescanning-your-library">Refreshing Your Library</a></li>
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

[![hihat desktop preview][product-screenshot]](https://whitelights.rip)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Core Features

*hihat* core features:
* 100% offline
* always dark mode
* audiophile fidelity (supports all file types)
* mix 'n match file types (mp3, m4a, flac, etc)
* limitless library size
* responsive design
* song shuffle
* song repeat
* media key support
* OSX menu bar integration
* downloadable album art
* quick search
* quick import
* intelligent sorting by song, artist, album
* nested folder support for libraries and new imports
* Spotify and Apple Music one-click search
* sync your library to a backup drive, phone, or retro device running [Rockbox](https://www.rockbox.org/)

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

### Getting Started

Upon initial boot of the app you'll see a button that allows you to select your library folder.

Click it and then select a directory from you computer containing your music library. 

After hitting confirm simply wait for the import process to finish, it takes about 1 minute for every 10,000 songs.

Once that is complete you're ready to go! When new songs are added hihat from any other place on your computer, they'll be copied into this library directory.

### Adding New Songs

Click the "import new songs" icon in the top right of hihat (or  `hihat -> import new songs` from the menu). 

Then select individual songs or folders of songs to import. 

hihat will copy them from their existing directory into your hihat library's folder for longterm safekeeping.

<img width="686" alt="Screenshot_2024-08-05_at_7_32_23 PM" src="https://github.com/user-attachments/assets/ce8cfe19-a918-49aa-9d55-ebc27ae8d53d">

### Rescanning Your Library

If you've used Finder to add songs to your library's folder instead of using hihat's "import new songs" feature you'll need to rescan your library so that hihat is aware of the new songs.

Click  `hihat -> rescan library folder` from the menu. 

This operation will keep the Playcount and Date Added of every existing song in tact while importing any new songs found in your library folder.

<img width="673" alt="Screenshot 2024-08-05 at 8 51 45 PM" src="https://github.com/user-attachments/assets/bfb904a1-dee6-4199-9bfb-ca9515ef9d88">

<p align="right">(<a href="#readme-top">back to top</a>)</p>

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
- [ ] Adjustable explorer height which makes album art smaller/bigger
- [ ] Sort by albumartist not the plain old artist, pretty much only used by rap albums with features (2Pac - All Eyez On Me)
- [ ] Edit song metadata
- [ ] Show stats about your library somewhere, like GB and # of songs
- [ ] Hide and show columns in the explorer
- [ ] iTunes-1.0-like "browser" for seeing scrollable list of artists or albums
- [ ] Playlists (TBD if I'll ever do this, lots of work required)
- [ ] Queue songs (TBD if I'll ever do this, lots of work required)


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



