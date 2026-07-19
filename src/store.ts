import { createRequire } from "node:module";

export interface User {
  telegramId: number;
  email?: string;
  registeredAt: string;
  preferences: {
    quality: "flac" | "alac" | "mp3" | "aac";
    language: string;
  };
  listeningHistory: string[];
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  formats: ("flac" | "alac" | "mp3" | "aac")[];
  sourceType: "owner" | "licensed";
  licenseStatus: "active" | "pending" | "expired";
  uploadedBy: number;
  uploadedAt: string;
  duration?: number;
  coverUrl?: string;
}

export interface CuratedPlaylist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
}

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
  keys(pattern: string): Promise<string[]>;
}

class MemoryStore {
  private data = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }
  async del(key: string): Promise<void> {
    this.data.delete(key);
  }
  async keys(_pattern: string): Promise<string[]> {
    return [...this.data.keys()];
  }
}

function resolveClient(): RedisLike {
  const url = process.env.REDIS_URL;
  if (url) {
    try {
      const require = createRequire(import.meta.url);
      const ioredis: any = require("ioredis");
      const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
      return new Redis(url, {
        maxRetriesPerRequest: null,
        lazyConnect: false,
      }) as RedisLike;
    } catch {
      // fall through to memory
    }
  }
  return new MemoryStore();
}

const client = resolveClient();
const PREFIX = "store:";

function k(ns: string, id: string): string {
  return `${PREFIX}${ns}:${id}`;
}

// --- Users ---

export async function getUser(telegramId: number): Promise<User | null> {
  const raw = await client.get(k("user", String(telegramId)));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function saveUser(user: User): Promise<void> {
  await client.set(k("user", String(user.telegramId)), JSON.stringify(user));
}

export async function isUserRegistered(telegramId: number): Promise<boolean> {
  return (await getUser(telegramId)) !== null;
}

// --- Tracks ---

export async function getTrack(id: string): Promise<Track | null> {
  const raw = await client.get(k("track", id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Track;
  } catch {
    return null;
  }
}

export async function saveTrack(track: Track): Promise<void> {
  await client.set(k("track", track.id), JSON.stringify(track));
  await addTrackToIndex(track.id);
}

export async function deleteTrack(id: string): Promise<void> {
  await client.del(k("track", id));
  await removeTrackFromIndex(id);
}

export async function searchTracks(query: string): Promise<Track[]> {
  const ids = await getTrackIds();
  const results: Track[] = [];
  const q = query.toLowerCase();
  for (const id of ids) {
    const track = await getTrack(id);
    if (!track) continue;
    if (
      track.title.toLowerCase().includes(q) ||
      track.artist.toLowerCase().includes(q) ||
      track.album.toLowerCase().includes(q)
    ) {
      results.push(track);
    }
  }
  return results;
}

export async function getAllTracks(): Promise<Track[]> {
  const ids = await getTrackIds();
  const tracks: Track[] = [];
  for (const id of ids) {
    const track = await getTrack(id);
    if (track) tracks.push(track);
  }
  return tracks;
}

// --- Curated Playlists ---

export async function getCuratedPlaylists(): Promise<CuratedPlaylist[]> {
  const raw = await client.get(`${PREFIX}playlists`);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CuratedPlaylist[];
  } catch {
    return [];
  }
}

export async function saveCuratedPlaylists(
  playlists: CuratedPlaylist[],
): Promise<void> {
  await client.set(`${PREFIX}playlists`, JSON.stringify(playlists));
}

// --- Admin ---

const ADMIN_IDS_KEY = `${PREFIX}admin_ids`;

export async function getAdminIds(): Promise<number[]> {
  const raw = await client.get(ADMIN_IDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

export async function isAdmin(telegramId: number): Promise<boolean> {
  const admins = await getAdminIds();
  return admins.includes(telegramId);
}

export async function addAdmin(telegramId: number): Promise<void> {
  const admins = await getAdminIds();
  if (!admins.includes(telegramId)) {
    admins.push(telegramId);
    await client.set(ADMIN_IDS_KEY, JSON.stringify(admins));
  }
}

// --- Index records ---

const USER_INDEX_KEY = `${PREFIX}index:users`;
const TRACK_INDEX_KEY = `${PREFIX}index:tracks`;

export async function getUserIds(): Promise<number[]> {
  const raw = await client.get(USER_INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as number[];
  } catch {
    return [];
  }
}

export async function addUserToIndex(telegramId: number): Promise<void> {
  const ids = await getUserIds();
  if (!ids.includes(telegramId)) {
    ids.push(telegramId);
    await client.set(USER_INDEX_KEY, JSON.stringify(ids));
  }
}

export async function getTrackIds(): Promise<string[]> {
  const raw = await client.get(TRACK_INDEX_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function addTrackToIndex(id: string): Promise<void> {
  const ids = await getTrackIds();
  if (!ids.includes(id)) {
    ids.push(id);
    await client.set(TRACK_INDEX_KEY, JSON.stringify(ids));
  }
}

export async function removeTrackFromIndex(id: string): Promise<void> {
  const ids = await getTrackIds();
  const filtered = ids.filter((i) => i !== id);
  await client.set(TRACK_INDEX_KEY, JSON.stringify(filtered));
}

// --- Injectable clock ---

export function now(): string {
  return new Date().toISOString();
}
