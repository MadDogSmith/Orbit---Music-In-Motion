const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = "http://127.0.0.1:5174/";

const SCOPES = [
    "user-read-currently-playing",
    "user-read-playback-state",
    "user-modify-playback-state"
];

function generateRandomString(length) {
    const characters =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    return Array.from(
        crypto.getRandomValues(new Uint8Array(length)),
        value => characters[value % characters.length]
    ).join("");
}

async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);

    return btoa(
        String.fromCharCode(...new Uint8Array(digest))
    )
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

export async function connectSpotify() {
    if (!CLIENT_ID) {
        throw new Error("Add your Spotify Client ID to .env");
    }
    console.log("here 1");

    const verifier = generateRandomString(64);
    const challenge = await generateCodeChallenge(verifier);
    const state = generateRandomString(24);
    console.log("here 2");
    sessionStorage.setItem("spotify_verifier", verifier);
    sessionStorage.setItem("spotify_state", state);
    console.log("here 3");
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: "code",
        redirect_uri: REDIRECT_URI,
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
        scope: SCOPES.join(" ")
    });
    console.log("here 4");
    window.location.href =
        `https://accounts.spotify.com/authorize?${params}`;
    console.log("here 5");
}

export async function handleSpotifyCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (params.get("error")) {
        throw new Error(params.get("error"));
    }

    if (!code) return false;

    const state = sessionStorage.getItem("spotify_state");
    const verifier = sessionStorage.getItem("spotify_verifier");

    if (!state || !verifier || params.get("state") !== state) {
        throw new Error("Spotify login verification failed.");
    }

    // Prevent exchanging the same authorization code twice.
    window.history.replaceState({}, "", REDIRECT_URI);
    sessionStorage.removeItem("spotify_state");
    sessionStorage.removeItem("spotify_verifier");

    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                grant_type: "authorization_code",
                code,
                redirect_uri: REDIRECT_URI,
                code_verifier: verifier
            })
        }
    );

    if (!response.ok) {
        throw new Error("Spotify login failed. Please reconnect.");
    }

    saveTokens(await response.json());
    return true;
}

function saveTokens(data) {
    let previous = {};

    try {
        previous = JSON.parse(
            sessionStorage.getItem("spotify_tokens") || "{}"
        );
    } catch {
        sessionStorage.removeItem("spotify_tokens");
    }

    sessionStorage.setItem(
        "spotify_tokens",
        JSON.stringify({
            ...previous,
            ...data,
            expires_at: Date.now() + data.expires_in * 1000
        })
    );
}

export function isConnected() {
    return Boolean(sessionStorage.getItem("spotify_tokens"));
}

async function getAccessToken() {
    let tokens;

    try {
        tokens = JSON.parse(
            sessionStorage.getItem("spotify_tokens") || "{}"
        );
    } catch {
        sessionStorage.removeItem("spotify_tokens");
        throw new Error(
            "Spotify session is invalid. Please reconnect."
        );
    }

    if (!tokens.access_token) {
        throw new Error("Please connect your Spotify account.");
    }

    if (Date.now() < tokens.expires_at - 60000) {
        return tokens.access_token;
    }

    const response = await fetch(
        "https://accounts.spotify.com/api/token",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: tokens.refresh_token,
                client_id: CLIENT_ID
            })
        }
    );

    if (!response.ok) {
        sessionStorage.removeItem("spotify_tokens");
        throw new Error("Your session expired. Reconnect Spotify.");
    }

    const updated = await response.json();
    saveTokens(updated);

    return updated.access_token;
}

export async function spotifyRequest(path, options = {}) {
    const token = await getAccessToken();

    const response = await fetch(
        `https://api.spotify.com/v1${path}`,
        {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                ...options.headers
            }
        }
    );

    // Read the response only once.
    const text = await response.text();

    if (!response.ok) {
        console.error("Spotify API error:", {
            path,
            status: response.status,
            body: text
        });

        throw new Error(
            `Spotify error ${response.status}`
        );
    }

    // All playback controls return no useful response body.
    // Never try to parse them as JSON.
    if (
        path.startsWith("/me/player/next") ||
        path.startsWith("/me/player/previous") ||
        path.startsWith("/me/player/pause") ||
        path.startsWith("/me/player/play") ||
        path.startsWith("/me/player/seek")
    ) {
        return null;
    }

    // Handle empty responses.
    if (!text.trim()) {
        return null;
    }

    // Only parse responses that actually contain JSON.
    const contentType =
        response.headers.get("content-type") || "";

    if (!contentType.includes("json")) {
        console.warn("Non-JSON Spotify response:", path);
        return null;
    }

    return JSON.parse(text);
}
