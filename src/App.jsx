import { useEffect, useRef, useState } from "react";
import {
  connectSpotify,
  handleSpotifyCallback,
  isConnected,
  spotifyRequest
} from "./spotify";
import "./App.css";

const DEFAULT_COLORS = {
  light: "#d1a6ae",
  middle: "#ac7c94",
  dark: "#381d36"
};

function formatTime(milliseconds = 0) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

// A tiny colour palette extractor. No ColorThief dependency needed.
function extractAlbumColors(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0, 48, 48);
  const pixels = ctx.getImageData(0, 0, 48, 48).data;
  const buckets = new Map();

  for (let i = 0; i < pixels.length; i += 16) {
    const [r, g, b, a] = pixels.slice(i, i + 4);
    if (a < 200) continue;
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    if (brightness < 18 || brightness > 242) continue;
    // Group similar pixels so a single unusual pixel doesn't dominate.
    const key = [r, g, b].map(v => Math.min(255, Math.round(v / 32) * 32)).join(",");
    const item = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    item.count++;
    item.r += r;
    item.g += g;
    item.b += b;
    buckets.set(key, item);
  }

  const palette = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 14)
    .map(item => [item.r / item.count, item.g / item.count, item.b / item.count]);
  if (!palette.length) return null;

  const brightness = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const sorted = [...palette].sort((a, b) => brightness(b) - brightness(a));
  const hex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
  return {
    light: hex(sorted[0]),
    middle: hex(sorted[Math.floor(sorted.length / 2)]),
    dark: hex(sorted[sorted.length - 1])
  };
}

export default function App() {
  const [connected, setConnected] = useState(isConnected());
  const [song, setSong] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [albumColors, setAlbumColors] = useState(DEFAULT_COLORS);

  const refreshing = useRef(false);
  const commanding = useRef(false);
  const songRef = useRef(null);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const draggingRef = useRef(false);
  const refreshRef = useRef(null);

  songRef.current = song;
  playingRef.current = playing;
  refreshRef.current = refreshSong;

  useEffect(() => {
    handleSpotifyCallback()
      .then(result => { if (result) setConnected(true); })
      .catch(err => setError(err.message));
  }, []);

  async function refreshSong() {
    if (refreshing.current || commanding.current) return;
    refreshing.current = true;
    try {
      const data = await spotifyRequest("/me/player");
      if (commanding.current) return;
      if (!data?.item) {
        setSong(null);
        setPlaying(false);
        return;
      }
      const next = {
        id: data.item.id,
        title: data.item.name,
        artist: (data.item.artists || []).map(artist => artist.name).join(", "),
        cover: data.item.album?.images?.[0]?.url,
        duration: data.item.duration_ms ?? 0
      };
      const changed = songRef.current?.id !== next.id;
      songRef.current = next;
      setSong(previous =>
        previous?.id === next.id &&
        previous?.cover === next.cover &&
        previous?.title === next.title &&
        previous?.artist === next.artist &&
        previous?.duration === next.duration
          ? previous : next
      );
      playingRef.current = Boolean(data.is_playing);
      setPlaying(playingRef.current);
      if (!draggingRef.current || changed) {
        progressRef.current = data.progress_ms ?? 0;
        setProgress(progressRef.current);
      }
      setError("");
    } catch (err) {
      console.error("Spotify refresh:", err);
      setError(err.message);
    } finally {
      refreshing.current = false;
    }
  }

  useEffect(() => {
    if (!connected) return;
    let stopped = false;
    let timer;
    async function poll() {
      if (stopped) return;
      if (document.visibilityState === "visible") await refreshRef.current?.();
      if (stopped) return;
      const current = songRef.current;
      const remaining = current ? current.duration - progressRef.current : Infinity;
      timer = setTimeout(poll, playingRef.current && remaining <= 10000 ? 1000 : 3000);
    }
    function visible() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        poll();
      }
    }
    poll();
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [connected]);

  useEffect(() => {
    if (!playing || !song) return;
    const timer = setInterval(() => {
      if (draggingRef.current) return;
      progressRef.current = Math.min(progressRef.current + 1000, song.duration);
      setProgress(progressRef.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, song?.id, song?.duration]);

  // Extract colours when the artwork URL changes, not every progress tick.
  useEffect(() => {
    if (!song?.cover) {
      setAlbumColors(DEFAULT_COLORS);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (cancelled) return;
      try {
        const colors = extractAlbumColors(image);
        if (colors) setAlbumColors(colors);
      } catch (err) {
        // Spotify artwork must allow cross-origin canvas access.
        console.warn("Could not read album colours:", err);
      }
    };
    image.onerror = () => console.warn("Could not load album artwork for colours.");
    image.src = song.cover;
    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [song?.cover]);

  async function playback(path, method = "POST") {
    if (commanding.current) return;
    commanding.current = true;
    setBusy(true);
    setError("");
    try {
      await spotifyRequest(path, { method });
    } catch (err) {
      setError(err.message);
    } finally {
      commanding.current = false;
      setBusy(false);
      setTimeout(() => refreshRef.current?.(), 350);
      setTimeout(() => refreshRef.current?.(), 1200);
    }
  }

  function togglePlayback() {
    if (commanding.current) return;
    const wasPlaying = playingRef.current;
    playingRef.current = !wasPlaying;
    setPlaying(!wasPlaying);
    playback(wasPlaying ? "/me/player/pause" : "/me/player/play", "PUT");
  }

  async function seek(position) {
    const next = Math.round(position);
    progressRef.current = next;
    setProgress(next);
    try {
      await spotifyRequest(`/me/player/seek?position_ms=${next}`, { method: "PUT" });
    } catch (err) {
      setError(err.message);
    }
  }

  function finishDragging() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    seek(progressRef.current);
  }

  if (!connected) {
    return (
      <main className="player">
        <div className="login">
          <h1>Orbit</h1>
          <p>Your music, in motion.</p>
          <button onClick={() => connectSpotify().catch(err => setError(err.message))}>
            Connect Spotify
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main
      className="player"
      style={{
        "--album-light": albumColors.light,
        "--album-middle": albumColors.middle,
        "--album-dark": albumColors.dark
      }}
    >
      {song ? (
        <div className="player-layout">
          <div className="record-container">
            <div className={`record ${playing ? "spinning" : ""}`}>
              <img src={song.cover} alt={`${song.title} album cover`} />
              <div className="record-hole" />
            </div>
          </div>

          <div className="music-details">
            <div className="song-info">
              <h1>{song.title}</h1>
              <p>{song.artist}</p>
            </div>
            <div className="progress-section">
              <input
                type="range"
                min="0"
                max={song.duration}
                value={progress}
                onPointerDown={() => { draggingRef.current = true; }}
                onPointerUp={finishDragging}
                onPointerCancel={finishDragging}
                onChange={event => {
                  progressRef.current = Number(event.target.value);
                  setProgress(progressRef.current);
                }}
                onKeyUp={event => {
                  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                    seek(progressRef.current);
                  }
                }}
                aria-label="Song progress"
              />
              <div className="timestamps">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(song.duration)}</span>
              </div>
            </div>
            <div className="controls">
              <button disabled={busy} aria-label="Previous song" onClick={() => playback("/me/player/previous")}>⏮</button>
              <button disabled={busy} className="play-button" aria-label={playing ? "Pause" : "Play"} onClick={togglePlayback}>
                {playing ? "Ⅱ" : "▶"}
              </button>
              <button disabled={busy} aria-label="Next song" onClick={() => playback("/me/player/next")}>⏭</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="song-info">
          <h1>Nothing playing</h1>
          <p>Start a song on Spotify to see it here.</p>
        </div>
      )}
      {error && <p className="error-message" role="alert">{error}</p>}
    </main>
  );
}
