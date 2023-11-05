<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/johnnyshankman/hihat">
    <img src="assets/icon.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">hihat</h3>

  <p align="center">
    A minimalist music library player for desktop, built on Electron, React, and Material UI.
    <br />
    <br />
    <a href="https://github.com/johnnyshankman/hihat/issues">Report Bug</a>
    ·
    <a href="https://github.com/johnnyshankman/hihat/issues">Request Feature</a>
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

[![hihat Screen Shot][product-screenshot]](https://whitelights.co)

hihat is a simple a way to play your music library, similar to the way you would play your library with iTunes or Windows Media Player in the early 2000s.

As a music file hoarder I've found myself extremely disappointed with the UX of modern media players like VLC (no album art display) and Spotify (shows very few songs in the window), so I built this. 

It's fully responsive, dark mode by default (as we all know music lovers are night owls), and supports essentially every filetype and library folder structure.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Built With

This project was built with the following technologies:

* [![Electron][Electron.js]][Electron-url]
* [![React][React.js]][React-url]
* [![Typescript][Typescript.js]][Typescript-url]
* [![Google Material UI][MaterialUI.js]][MaterialUI-url]
* [![Tailwind][Tailwind.js]][Tailwind-url]
* [![Music Metadata][MusicMetadata.js]][MusicMetadata-url]

<p align="right">(<a href="#readme-top">back to top</a>)</p>


### Supported Audio Formats and Metadata Formats

Almost every format under the sun should be supported, and can be mixed and matched in the same folder. The app does not currently support displaying songs from more than one folder at a time yet.

* See [The Chromium Project](https://www.chromium.org/audio-video/) for information on supported audio formats.
* See [Music Metadata](https://github.com/borewit/music-metadata#features) library for supported metadata formats.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->
## Getting Started

To get a local copy up and running follow these steps.

### Prerequisites

This is an example of how to list things you need to use the software and how to install them.
* npm
  ```sh
  npm install npm@latest -g
  ```
* yarn
  ```sh
  npm install --global yarn
  ```

### Installation

_Follow the steps below to install the local development environment and serve the development application locally._

1. Clone the repo
   ```sh
   git clone https://github.com/johnnyshankman/hihat.git
   ```
3. Install NPM packages with Yarn
   ```sh
   yarn install
   ```
4. Run the app in development with hot reloading
   ```sh
   yarn dev
   ```

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- USAGE EXAMPLES -->
## Usage

This is a very bare bones app meant for use with a gigantic folder of music files, such as something you might end up with if you are an avid user of SpotDL. It is not meant to be a replacement for Spotify or Apple Music, but rather a way to play your music files in a simple, elegant way, similar to the way you would use iTunes or Windows Media Player.

_Simply hit the icon in the top right, select a folder, wait for the import proces to finish, and use as you would any other media player._

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- ROADMAP -->
## Roadmap

- [x] Autoplay
- [x] Virtualized Lists for opitmal rendering
- [x] Cache imported songs from previous session
- [ ] Minimalist search/find solution for larger librarys
- [x] Recursive file finding for itunes-like libraries with nested folders
- [ ] Multiple playlists
- [ ] Shuffle
- [ ] Fix the player UX on really really thin windows (under 300px)
- [ ] OSX song info in the menu bar tray (not sure the name of this thing)

![Screenshot 2023-11-04 at 10 50 26 PM](https://github.com/johnnyshankman/hihat/assets/6632701/c0c2e249-08bd-46d0-9487-3e89be56ff4f)

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
[product-screenshot]: readme-images/hihat.png
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Electron.js]: https://img.shields.io/badge/Electron-20232A?style=for-the-badge&logo=electron&logoColor=61DAFB
[Electron-url]: https://www.electronjs.org/
[Tailwind.js]: https://img.shields.io/badge/Tailwind-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[Tailwind-url]: https://tailwindcss.com/
[ElectronReactBoilerplate]: https://img.shields.io/badge/Electron-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[ElectronReactBoilerplate-url]: https://electron-react-boilerplate.js.org/
[MusicMetadata.js]: https://img.shields.io/badge/MusicMetadata-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[MusicMetadata-url]: https://github.com/borewit/music-metadata
[MaterialUI.js]: https://img.shields.io/badge/MaterialUI-20232A?style=for-the-badge&logo=javascript&logoColor=61DAFB
[MaterialUI-url]: https://mui.com/material-ui/
[Typescript.js]: https://img.shields.io/badge/Typescript-20232A?style=for-the-badge&logo=typescript&logoColor=007ACC
[Typescript-url]: https://typescriptlang.org



