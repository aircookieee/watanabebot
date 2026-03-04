import SpotifyWebApi from 'spotify-web-api-node';
import config from '../config/config';
import { SpotifyTrack } from '../types';

const spotifyApi = new SpotifyWebApi({
    clientId: config.spotify.clientId,
    clientSecret: config.spotify.clientSecret,
});

let accessToken: string | null = null;
let tokenExpiry: number = 0;

async function authenticate(): Promise<void> {
    if (accessToken && Date.now() < tokenExpiry) return;

    try {
        const data = await spotifyApi.clientCredentialsGrant();
        accessToken = data.body['access_token'];
        tokenExpiry = Date.now() + (data.body['expires_in'] - 60) * 1000;
        spotifyApi.setAccessToken(accessToken);
        console.log('Spotify access token retrieved');
    } catch (error) {
        console.error('Failed to authenticate with Spotify:', error);
        throw error;
    }
}

export async function getPlaylistTracks(playlistId?: string): Promise<SpotifyTrack[]> {
    await authenticate();

    const id = playlistId || config.spotify.playlistId;
    let trackData: SpotifyTrack[] = [];
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
                    title: item.track!.name,
                    link: item.track!.external_urls.spotify,
                    uri: item.track!.uri,
                    albumCover: item.track!.album.images[0]?.url || '',
                    artists: item.track!.artists.map((artist) => artist.name).join(', '),
                }));

            trackData.push(...tracks);
            offset += limit;
        } while (trackData.length < response.body.total);
    } catch (error) {
        console.error('Failed to fetch tracks from Spotify:', error);
    }

    return trackData;
}

export function getRandomTrack(tracks: SpotifyTrack[]): SpotifyTrack | null {
    if (tracks.length === 0) return null;

    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    return shuffled[0];
}

export function formatTrackForEmbed(track: SpotifyTrack): {
    fullName: string;
    appleMusicUrl: string;
    youtubeMusicUrl: string;
} {
    const fullName = `${track.artists} - ${track.title}`;
    const appleMusicUrl = fullName.replace(/ /gm, '%20');
    const youtubeMusicUrl = fullName.replace(/ /gm, '+');

    return {
        fullName,
        appleMusicUrl,
        youtubeMusicUrl,
    };
}
