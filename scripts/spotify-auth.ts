// One-time helper to get a Spotify refresh token for /api/now-playing.
// Usage: put SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET in .env, then `bun scripts/spotify-auth.ts`
// Bun loads .env automatically.

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PORT = 8888;
// Must match a Redirect URI in the Spotify app settings (Spotify rejects "localhost")
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = "user-read-currently-playing user-read-recently-played";

if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env");
    process.exit(1);
}

const state = crypto.randomUUID();
const authorizeUrl =
    "https://accounts.spotify.com/authorize?" +
    new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state,
    });

const server = Bun.serve({
    port: PORT,
    hostname: "127.0.0.1",
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname !== "/callback") return new Response("Not found", { status: 404 });

        const code = url.searchParams.get("code");
        if (!code || url.searchParams.get("state") !== state) {
            return new Response(`Authorization failed: ${url.searchParams.get("error") ?? "bad state"}`, { status: 400 });
        }

        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI }),
        });
        const data = await res.json();

        if (!res.ok || !data.refresh_token) {
            console.error("Token exchange failed:", data);
            setTimeout(() => server.stop(), 100);
            return new Response("Token exchange failed — check terminal.", { status: 500 });
        }

        console.log("\nAdd this to .env and to Vercel env vars:\n");
        console.log(`SPOTIFY_REFRESH_TOKEN=${data.refresh_token}\n`);
        setTimeout(() => server.stop(), 100);
        return new Response("Done — refresh token printed in your terminal. You can close this tab.");
    },
});

console.log(`Open this URL and approve access:\n\n${authorizeUrl}\n`);
