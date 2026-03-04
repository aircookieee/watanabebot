"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlaylistTracks = getPlaylistTracks;
exports.getRandomTrack = getRandomTrack;
exports.formatTrackForEmbed = formatTrackForEmbed;
const spotify_web_api_node_1 = __importDefault(require("spotify-web-api-node"));
const config_1 = __importDefault(require("../config/config"));
const spotifyApi = new spotify_web_api_node_1.default({
    clientId: config_1.default.spotify.clientId,
    clientSecret: config_1.default.spotify.clientSecret,
});
let accessToken = null;
let tokenExpiry = 0;
async function authenticate() {
    if (accessToken && Date.now() < tokenExpiry)
        return;
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        accessToken = data.body['access_token'];
        tokenExpiry = Date.now() + (data.body['expires_in'] - 60) * 1000;
        spotifyApi.setAccessToken(accessToken);
        console.log('Spotify access token retrieved');
    }
    catch (error) {
        console.error('Failed to authenticate with Spotify:', error);
        throw error;
    }
}
async function getPlaylistTracks(playlistId) {
    await authenticate();
    const id = playlistId || config_1.default.spotify.playlistId;
    let trackData = [];
    let offset = 0;
    const limit = 100;
    try {
        let response;
        do {
            response = await spotifyApi.getPlaylistTracks(id, {
                offset,
                limit,
                fields: 'items.track.name,items.track.uri,items.track.external_urls.spotify,items.track.album.images,items.track.artists,total',
            });
            const tracks = response.body.items
                .filter((item) => item.track !== null)
                .map((item) => ({
                title: item.track.name,
                link: item.track.external_urls.spotify,
                uri: item.track.uri,
                albumCover: item.track.album.images[0]?.url || '',
                artists: item.track.artists.map((artist) => artist.name).join(', '),
            }));
            trackData.push(...tracks);
            offset += limit;
        } while (trackData.length < response.body.total);
    }
    catch (error) {
        console.error('Failed to fetch tracks from Spotify:', error);
    }
    return trackData;
}
function getRandomTrack(tracks) {
    if (tracks.length === 0)
        return null;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    return shuffled[0];
}
function formatTrackForEmbed(track) {
    const fullName = `${track.artists} - ${track.title}`;
    const appleMusicUrl = fullName.replace(/ /gm, '%20');
    const youtubeMusicUrl = fullName.replace(/ /gm, '+');
    return {
        fullName,
        appleMusicUrl,
        youtubeMusicUrl,
    };
}
//# sourceMappingURL=spotify.js.map