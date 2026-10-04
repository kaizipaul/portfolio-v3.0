import type { APIRoute } from "astro";
import {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
} from "astro:env/server";

// Runs on demand (Vercel function); rest of the site stays static
export const prerender = false;

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const NOW_PLAYING_URL = "https://api.spotify.com/v1/me/player/currently-playing";
const RECENTLY_PLAYED_URL = "https://api.spotify.com/v1/me/player/recently-played?limit=1";

interface SpotifyImage {
    url: string;
    width: number | null;
    height: number | null;
}

interface SpotifyTrack {
    type: "track";
    name: string;
    duration_ms: number;
    external_urls: { spotify: string };
    artists: { name: string }[];
    album: { name: string; images: SpotifyImage[] };
}

export interface NowPlaying {
    isPlaying: boolean;
    title: string;
    artist: string;
    album: string;
    albumArt: string | null;
    url: string;
    progressMs: number;
    durationMs: number;
    playedAt: string | null;
}

// Reused across invocations while the function instance stays warm
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

    const res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: SPOTIFY_REFRESH_TOKEN!,
        }),
    });

    if (!res.ok) throw new Error(`Spotify token refresh failed: ${res.status}`);

    const data: { access_token: string; expires_in: number } = await res.json();
    // Refresh a minute early to avoid using a token right as it expires
    cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return cachedToken.value;
}

// Smallest image that still looks sharp at 48px (2x density)
function pickAlbumArt(images: SpotifyImage[]): string | null {
    const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    return (sorted.find((img) => (img.width ?? 0) >= 96) ?? sorted.at(-1))?.url ?? null;
}

function toNowPlaying(
    track: SpotifyTrack,
    extra: Pick<NowPlaying, "isPlaying" | "progressMs" | "playedAt">,
): NowPlaying {
    return {
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.album.name,
        albumArt: pickAlbumArt(track.album.images),
        url: track.external_urls.spotify,
        durationMs: track.duration_ms,
        ...extra,
    };
}

async function fetchNowPlaying(token: string): Promise<NowPlaying | null> {
    const headers = { Authorization: `Bearer ${token}` };

    const current = await fetch(NOW_PLAYING_URL, { headers });
    if (current.status === 200) {
        const data: { is_playing: boolean; progress_ms: number | null; item: SpotifyTrack | null } =
            await current.json();
        // Podcasts/ads have no track item; fall through to recently played
        if (data.is_playing && data.item?.type === "track") {
            return toNowPlaying(data.item, {
                isPlaying: true,
                progressMs: data.progress_ms ?? 0,
                playedAt: null,
            });
        }
    } else if (current.status !== 204) {
        throw new Error(`Spotify currently-playing failed: ${current.status}`);
    }

    const recent = await fetch(RECENTLY_PLAYED_URL, { headers });
    if (!recent.ok) throw new Error(`Spotify recently-played failed: ${recent.status}`);

    const data: { items: { track: SpotifyTrack; played_at: string }[] } = await recent.json();
    const last = data.items[0];
    if (!last) return null;

    return toNowPlaying(last.track, { isPlaying: false, progressMs: 0, playedAt: last.played_at });
}

function json(body: unknown, status = 200, cache = true) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            // Let Vercel's CDN absorb traffic so we stay well under Spotify rate limits
            "Cache-Control": cache
                ? "public, max-age=0, s-maxage=30, stale-while-revalidate=60"
                : "no-store",
        },
    });
}

export const GET: APIRoute = async () => {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
        return json({ error: "not_configured" }, 503, false);
    }

    try {
        const token = await getAccessToken();
        const track = await fetchNowPlaying(token);
        return track ? json(track) : json({ error: "no_data" }, 404);
    } catch (err) {
        console.error(err);
        cachedToken = null;
        return json({ error: "upstream" }, 502, false);
    }
};
