# 💿 Orbit — Music In Motion

**Your music, in motion.**

Orbit is a digital record player that connects to Spotify and transforms your currently playing music into an interactive vinyl-inspired experience. The album artwork becomes a spinning record, surrounded by a dynamic interface designed to make digital music feel a little more physical.

---

## ✨ Features

- 💿 **Spinning Digital Record**  
  The current song's album artwork is transformed into a vinyl-style record that spins while the song is playing.

- 🎨 **Album-Based Background**  
  Orbit extracts colours from the current album artwork and uses them to create a dynamic gradient background.

- 🎵 **Live Spotify Information**  
  Displays the currently playing:
  - Song title
  - Artist
  - Album artwork
  - Song duration
  - Current playback position

- ⏯️ **Playback Controls**  
  Control Spotify directly through Orbit with:
  - Previous track
  - Play / Pause
  - Next track
  - Seekable progress bar

- 🔄 **Automatic Updates**  
  Orbit periodically checks Spotify for playback changes and updates the interface when a new song begins.

- 🖥️ **Full-Screen Interface**  
  Designed as a clean, desktop-style music display with the record on the left and song information and controls on the right.

---

## 🛠️ Built With

**Frontend**
- React
- Vite
- JavaScript
- HTML
- CSS

**Spotify Integration**
- Spotify Web API
- OAuth 2.0 with PKCE authentication

**Additional Libraries**
- ColorThief — extracts colours from album artwork for the dynamic background

---

## 🎧 How It Works

Orbit connects to your Spotify account using Spotify's OAuth PKCE authentication flow.

Once connected, Orbit retrieves information about your current Spotify playback and displays the album artwork as a digital vinyl record.

While music is playing, the record rotates continuously. Pausing the song stops the rotation, while changing songs replaces the artwork and updates the background colours, track information, progress, and playback state.

Playback controls communicate directly with Spotify so you can control your music without leaving Orbit.

---

## 🚀 Running Orbit Locally

### 1. Clone the Project

```bash
git clone <your-repository-url>
cd orbit
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Install ColorThief

```bash
npm install colorthief
```

### 4. Start the Development Server

```bash
npm run dev
```

Vite will display the local address for Orbit in the terminal.

---

## 🔐 Spotify Setup

Orbit requires a Spotify Developer application in order to access Spotify playback information.

Create an application through the Spotify Developer Dashboard and obtain your **Client ID**.

Your Spotify application must also contain the same redirect URI used by Orbit.

Orbit requests the following Spotify permissions:

```text
user-read-currently-playing
user-read-playback-state
user-modify-playback-state
```

These permissions allow Orbit to read the currently playing song and control playback.

---

## 📁 Project Structure

```text
orbit/
│
├── src/
│   ├── App.jsx
│   ├── App.css
│   ├── spotify.js
│   └── main.jsx
│
├── public/
│
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### `App.jsx`

Contains the main Orbit interface and playback logic, including song information, progress tracking, record animation, playback controls, and dynamic background handling.

### `App.css`

Contains Orbit's visual design, including the full-screen layout, vinyl record styling, animations, controls, responsive layout, and background effects.

### `spotify.js`

Handles communication with Spotify, including authentication, PKCE authorization, access tokens, and Spotify Web API requests.

---

## 🎨 Design Concept

Orbit was designed around the idea of combining the personality of physical music with the convenience of streaming.

Instead of displaying album artwork as a traditional square image, Orbit turns it into the record itself.

The interface responds visually to each song through:

**Album Artwork → Colour Extraction → Dynamic Gradient → Spinning Record**

This gives every song its own visual atmosphere while keeping the interface simple and focused on the music.

---

## 🔮 Future Improvements

Potential additions to Orbit include:

- Smoother colour transitions between songs
- Improved album colour extraction
- Vinyl rotation that maintains its position when paused
- Volume controls
- Queue display
- Device selection
- Expanded mobile support
- Additional vinyl and turntable visual effects
- Custom themes
- Full-screen display mode
- Performance and Spotify polling improvements

---

## 💿 Orbit

### Music In Motion

A digital record player for Spotify that brings album artwork, colour, movement, and playback together in one interface.

**Built with React, Vite, and the Spotify Web API.**
