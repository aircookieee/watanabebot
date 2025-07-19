import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const ANILIST_API = "https://graphql.anilist.co";
const MAP_FILE = path.join(__dirname, "discordAniListMap.json");
const DATA_FILE = path.join(__dirname, "anilist_data.json");
const FAVS_FILE = path.join(__dirname, "anilist_favorites.json");

export type UserListEntry = {
  media: {
    id: number;
    title: {
      romaji: string;
      english: string;
      native: string;
    };
    description: string;
    status: string;
  };
  status: string;
  score: number;
  progress: number;
  repeat: number;
};

export type AnimeMatch = {
  discordId: string;
  aniUsername: string;
  listName: string;
  score: number;
  progress: number;
  status: string;
  repeat: number;
  isFavorite: boolean;
};

export async function registerUser(
  discordId: string,
  aniListUsername: string,
): Promise<void> {
  let map: Record<string, string> = {};
  if (fs.existsSync(MAP_FILE)) {
    map = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));
  }
  map[discordId] = aniListUsername;
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));

  // Fetch user's data immediately
  try {
    const lists = await fetchAniListLists(aniListUsername);
    const data: Record<string, any> = fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
      : {};

    data[discordId] = {
      aniUsername: aniListUsername,
      lastUpdated: new Date().toISOString(),
      lists,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`Registered and fetched AniList data for ${aniListUsername}`);
  } catch (e) {
    console.error(
      `Could not fetch data for ${aniListUsername} on registration:`,
      e,
    );
  }
}

export function unregisterUser(discordId: string): boolean {
  if (!fs.existsSync(MAP_FILE)) return false;
  const map = JSON.parse(fs.readFileSync(MAP_FILE, "utf-8"));
  if (!map[discordId]) return false;
  delete map[discordId];
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2));
  return true;
}

// Update AniList data
async function fetchAniListLists(username: string) {
  const query = `
      query ($username: String) {
        MediaListCollection(userName: $username, type: ANIME) {
          lists {
            name
            isCustomList
            isSplitCompletedList
            entries {
              media {
                id
                title {
                  romaji
                  english
                  native
                }
                status
              }
              status
              score(format: POINT_100)
              progress
              repeat
            }
          }
        }
      }
    `;

  let response;
  const maxRetries = 2;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      response = await fetch(ANILIST_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables: { username } }),
      });
      if (response) break;
    } catch (e) {
      console.error(`Failed to fetch lists for ${username} (attempt ${attempt + 1}):`, e);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    attempt++;
  }
  if (!response) {
    throw new Error(`Unable to fetch lists for ${username} after ${maxRetries} attempts.`);
  }

  type AniListResponse = {
    data: {
      MediaListCollection: {
        lists: {
          name: string;
          entries: UserListEntry[];
        }[];
      };
    };
  };

  const json = (await response!.json()) as AniListResponse;
  return json.data.MediaListCollection.lists;
}

async function fetchUserFavorites(username: string) {
  const query = `
    query ($username: String) {
      User(name: $username) {
        favourites {
          anime {
            nodes {
              id
              title {
                romaji
                english
                native
              }
            }
          }
        }
      }
    }`;

  let response;
  const maxRetries = 2;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      response = await fetch(ANILIST_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ query, variables: { username } }),
      });
      if (response) break;
    } catch (e) {
      console.error(`Failed to fetch favorites for ${username} (attempt ${attempt + 1}):`, e);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    attempt++;
  }
  if (!response) {
    throw new Error(`Unable to fetch favorites for ${username} after ${maxRetries} attempts.`);
  }

  type AniListResponse = {
    data: {
      User: {
        favourites: {
          anime: {
            nodes: {
              id: number;
              title: {
                romaji: string;
                english: string;
                native: string;
              };
            }[];
          };
        };
      };
    };
  };

  const json = (await response.json()) as AniListResponse;
  const favorites = json.data.User.favourites.anime.nodes.map((node) => ({
    id: node.id,
    title: node.title,
  }));
  return favorites;
}

export async function updateAniListData() {
  if (!fs.existsSync(MAP_FILE)) return;
  const map: Record<string, string> = JSON.parse(
    fs.readFileSync(MAP_FILE, "utf-8"),
  );
  const data: Record<string, any> = fs.existsSync(DATA_FILE)
    ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
    : {};

  for (const [discordId, username] of Object.entries(map)) {
    try {
      const sTime = performance.now();
      const lists = await fetchAniListLists(username);
      const eTime = performance.now();
      data[discordId] = {
        aniUsername: username,
        lastUpdated: new Date().toISOString(),
        lists,
      };
      console.log(`Fetched AniList data for ${username}, took ${eTime - sTime}ms`);
    } catch (e) {
      console.error(`Failed to fetch for ${username}:`, e);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // ms delay
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function updateFavoritesData() {
  if (!fs.existsSync(MAP_FILE)) return;
  const map: Record<string, string> = JSON.parse(
    fs.readFileSync(MAP_FILE, "utf-8"),
  );
  const data: Record<string, any> = fs.existsSync(FAVS_FILE)
    ? JSON.parse(fs.readFileSync(FAVS_FILE, "utf-8"))
    : {};

  for (const [discordId, username] of Object.entries(map)) {
    try {
      const sTime = performance.now();
      const favs = await fetchUserFavorites(username);
      const eTime = performance.now();
      data[discordId] = {
        aniUsername: username,
        lastUpdated: new Date().toISOString(),
        favs,
      };
      console.log(`Fetched favorites data for ${username}, took ${eTime - sTime}ms`);
    } catch (e) {
      console.error(`Failed to fetch favorites for ${username}:`, e);
    }
    await new Promise((resolve) => setTimeout(resolve, 2000)); // ms delay
  }
  fs.writeFileSync(FAVS_FILE, JSON.stringify(data, null, 2));
}

export async function updateUserAniList(discordId: string): Promise<void> {
  if (!fs.existsSync(MAP_FILE)) return;
  const map: Record<string, string> = JSON.parse(
    fs.readFileSync(MAP_FILE, "utf-8"),
  );
  const aniListUsername = map[discordId];
  if (!aniListUsername) return;

  try {
    const lists = await fetchAniListLists(aniListUsername);
    const data: Record<string, any> = fs.existsSync(DATA_FILE)
      ? JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"))
      : {};
    data[discordId] = {
      aniUsername: aniListUsername,
      lastUpdated: new Date().toISOString(),
      lists,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`Updated data for ${aniListUsername} on call`);
  } catch (e) {
    console.error(`Failed to update for ${aniListUsername} on call:`, e);
  }
}

export async function getAnimeInfoWithScores(searchInput: string): Promise<{
  resolvedTitle: string;
  description: string;
  anilistURL: string;
  score: number;
  coverImage: string;
  matches: AnimeMatch[];
}> {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      resolvedTitle: searchInput,
      description: "No description available.",
      anilistURL: "https://anilist.co",
      score: 0,
      coverImage: "",
      matches: [],
    };
  }
  const favData: Record<string, any> = fs.existsSync(FAVS_FILE)
    ? JSON.parse(fs.readFileSync(FAVS_FILE, "utf-8"))
    : {};

  const isId = /^\d+$/.test(searchInput);
  let media: any = null;

  if (isId) {
    const idQuery = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          siteUrl
          title { romaji english native }
          description(asHtml: false)
          meanScore
          coverImage { large extraLarge }
        }
      }
    `;

    const variables = { id: parseInt(searchInput, 10) };
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: idQuery, variables }),
    });
    const json = await response.json() as { data?: { Media?: any } };
    media = json.data?.Media;
  } else {
    const searchQuery = `
      query ($search: String) {
        Media(search: $search, type: ANIME) {
          id
          siteUrl
          title { romaji english native }
          description(asHtml: false)
          meanScore
          coverImage { large extraLarge }
        }
      }
    `;

    const variables = { search: searchInput };
    const response = await fetch(ANILIST_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query: searchQuery, variables }),
    });

    const json = await response.json() as { data?: { Media?: any } };
    media = json.data?.Media;
  }

  if (!media) {
    return {
      resolvedTitle: searchInput,
      description: "No matching anime found.",
      anilistURL: "https://anilist.co",
      score: 0,
      coverImage: "",
      matches: [],
    };
  }

  const resolvedTitle = media.title.romaji || media.title.english ||
    media.title.native || searchInput;
  const description = media.description
    ?.replace(/(<br>|\n)+/g, "\n")
    ?.replace(/<b>(.*?)<\/b>/gi, "**$1**")
    ?.replace(/<i>(.*?)<\/i>/gi, "*$1*")
    ?.replace(/<\/?b>/gi, "")
    ?.replace(/<\/?i>/gi, "") || "No description available.";

  const coverImage = media.coverImage.extraLarge || media.coverImage.large ||
    "";
  const anilistURL = media.siteUrl || "https://anilist.co";
  const score = media.meanScore || 0;
  const data: Record<string, any> = JSON.parse(
    fs.readFileSync(DATA_FILE, "utf-8"),
  );
  const mapFile: Record<string, any> = JSON.parse(
    fs.readFileSync(MAP_FILE, "utf-8"),
  );
  const matches: AnimeMatch[] = [];

  for (const [discordId, userData] of Object.entries(data)) {
    const { aniUsername, lists } = userData;
    if (!Object.values(mapFile).includes(aniUsername)) continue;
    for (const list of lists) {
      for (const entry of list.entries) {
        if (entry.media.id === media.id) {
          matches.push({
            discordId,
            aniUsername,
            listName: list.name,
            score: entry.score,
            progress: entry.progress,
            status: entry.status,
            repeat: entry.repeat,
            isFavorite: favData[discordId]?.favs?.some((fav: any) => fav.id === media.id) || false,
          });
        }
      }
    }
  }

  const seen = new Set();
  const uniqueMatches = matches.filter((match) => {
    const key =
      `${match.discordId}-${match.aniUsername}-${match.score}-${match.progress}-${match.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    resolvedTitle,
    anilistURL,
    description,
    score,
    coverImage,
    matches: uniqueMatches,
  };
}
