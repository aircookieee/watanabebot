import { SpotifyTrack } from '../types';
export declare function getPlaylistTracks(playlistId?: string): Promise<SpotifyTrack[]>;
export declare function getRandomTrack(tracks: SpotifyTrack[]): SpotifyTrack | null;
export declare function formatTrackForEmbed(track: SpotifyTrack): {
    fullName: string;
    appleMusicUrl: string;
    youtubeMusicUrl: string;
};
//# sourceMappingURL=spotify.d.ts.map