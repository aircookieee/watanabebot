import fs from "fs";
import path from "path";
import fetch from "node-fetch";

const ANILIST_API = "https://graphql.anilist.co";
const MAP_FILE = path.join(__dirname, "discordAniListMap.json");
const DATA_FILE = path.join(__dirname, "anilist_data.json");

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
};

export type AnimeMatch = {
  discordId: string;
  aniUsername: string;
  listName: string;
  score: number;
  progress: number;
  status: string;
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
              description
              status
            }
            status
            score(format: POINT_100)
            progress
          }
        }
      }
    }
  `;

  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables: { username } }),
  });

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

  const json = (await response.json()) as AniListResponse;
  return json.data.MediaListCollection.lists;
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
      const lists = await fetchAniListLists(username);
      data[discordId] = {
        aniUsername: username,
        lastUpdated: new Date().toISOString(),
        lists,
      };
      console.log(`Fetched AniList data for ${username}`);
    } catch (e) {
      console.error(`Failed to fetch for ${username}:`, e);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait 1 second before the next user
  }

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

export async function getAnimeInfoWithScores(searchTitle: string): Promise<{
  resolvedTitle: string;
  description: string;
  anilistURL: string;
  score: number;
  coverImage: string;
  matches: AnimeMatch[];
}> {
  if (!fs.existsSync(DATA_FILE)) {
    return {
      resolvedTitle: searchTitle,
      description: "No description available.",
      anilistURL: "https://anilist.co",
      score: 0,
      coverImage: "",
      matches: [],
    };
  }

  // Fetch AL media data
  const mediaQuery = `
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

  const response = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: mediaQuery,
      variables: { search: searchTitle },
    }),
  });

  const json = await response.json();
  const media = json.data?.Media;

  const resolvedTitle = media?.title?.romaji || media?.title?.english ||
    media?.title?.native || searchTitle;
  const matchingTitles = [
    media?.title?.romaji?.toLowerCase(),
    media?.title?.english?.toLowerCase(),
    media?.title?.native?.toLowerCase(),
  ].filter(Boolean);

  const description = media?.description
  ?.replace(/(<br>|\n)+/g, "\n")
  ?.replace(/<b>(.*?)<\/b>/gi, '**$1**')
  ?.replace(/<i>(.*?)<\/i>/gi, '*$1*')
  ?.replace(/<\/?b>/gi, '')
  ?.replace(/<\/?i>/gi, '') || "No description available.";
  const coverImage = media?.coverImage?.extraLarge ||
    media?.coverImage?.large || "";
  const anilistURL = media?.siteUrl || "https://anilist.co";
  const score = media?.meanScore;

  // User matches
  const data: Record<string, any> = JSON.parse(
    fs.readFileSync(DATA_FILE, "utf-8"),
  );
  const matches: AnimeMatch[] = [];

  for (const [discordId, userData] of Object.entries(data)) {
    const { aniUsername, lists } = userData;
    for (const list of lists) {
      for (const entry of list.entries) {
        const titles = [
          entry.media.title.romaji?.toLowerCase(),
          entry.media.title.english?.toLowerCase(),
          entry.media.title.native?.toLowerCase(),
        ].filter(Boolean);

        if (titles.some((t) => matchingTitles.includes(t))) {
          matches.push({
            discordId,
            aniUsername,
            listName: list.name,
            score: entry.score,
            progress: entry.progress,
            status: entry.status,
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
