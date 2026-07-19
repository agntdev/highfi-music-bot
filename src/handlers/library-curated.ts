import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { getCuratedPlaylists, getTrack, getAllTracks } from "../store.js";

registerMainMenuItem({ label: "🎵 Library", data: "library:curated", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("library:curated", async (ctx) => {
  await ctx.answerCallbackQuery();
  const playlists = await getCuratedPlaylists();
  const allTracks = await getAllTracks();

  if (playlists.length === 0 && allTracks.length === 0) {
    await ctx.editMessageText(
      "The library is empty. Check back soon — new tracks are added regularly.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const pl of playlists) {
    rows.push([
      inlineButton(
        `🎶 ${pl.name} (${pl.trackIds.length} tracks)`,
        `playlist:view:${pl.id}`,
      ),
    ]);
  }

  if (allTracks.length > 0) {
    rows.push([
      inlineButton(`📀 All Tracks (${allTracks.length})`, "library:alltracks"),
    ]);
  }

  rows.push([inlineButton("⬅️ Back to menu", "menu:main")]);

  await ctx.editMessageText("Browse curated playlists and owner-uploaded collections:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^playlist:view:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const playlists = await getCuratedPlaylists();
  const playlist = playlists.find((p) => p.id === ctx.match[1]);
  if (!playlist) {
    await ctx.editMessageText("Playlist not found.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to library", "library:curated")],
      ]),
    });
    return;
  }

  if (playlist.trackIds.length === 0) {
    await ctx.editMessageText(`"${playlist.name}" is empty.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to library", "library:curated")],
      ]),
    });
    return;
  }

  const lines: string[] = [`🎶 ${playlist.name}\n${playlist.description}\n`];
  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const trackId of playlist.trackIds.slice(0, 10)) {
    const track = await getTrack(trackId);
    if (!track) continue;
    lines.push(`• ${track.artist} — ${track.title}`);
    rows.push([
      inlineButton(`▶️ ${track.artist} — ${track.title}`, `track:play:${track.id}`),
    ]);
  }

  if (playlist.trackIds.length > 10) {
    lines.push(`\n…and ${playlist.trackIds.length - 10} more`);
  }

  rows.push([inlineButton("⬅️ Back to library", "library:curated")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery("library:alltracks", async (ctx) => {
  await ctx.answerCallbackQuery();
  const tracks = await getAllTracks();

  if (tracks.length === 0) {
    await ctx.editMessageText("No tracks available yet.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to library", "library:curated")],
      ]),
    });
    return;
  }

  const lines: string[] = ["📀 All Tracks:\n"];
  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const track of tracks.slice(0, 10)) {
    lines.push(`• ${track.artist} — ${track.title}`);
    rows.push([
      inlineButton(`▶️ ${track.artist} — ${track.title}`, `track:play:${track.id}`),
    ]);
  }

  if (tracks.length > 10) {
    lines.push(`\n…and ${tracks.length - 10} more`);
  }

  rows.push([inlineButton("⬅️ Back to library", "library:curated")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(rows),
  });
});

export default composer;
