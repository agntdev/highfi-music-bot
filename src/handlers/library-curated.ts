import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { getCuratedPlaylists, getTrack, getAllTracks } from "../store.js";

registerMainMenuItem({ label: "🎵 Koleksi", data: "library:curated", order: 20 });

const composer = new Composer<Ctx>();

composer.callbackQuery("library:curated", async (ctx) => {
  await ctx.answerCallbackQuery();
  const playlists = await getCuratedPlaylists();
  const allTracks = await getAllTracks();

  if (playlists.length === 0 && allTracks.length === 0) {
    await ctx.editMessageText(
      "Koleksi kosong. Cek lagi nanti — track baru ditambahkan secara berkala.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Kembali ke menu", "menu:main")],
        ]),
      },
    );
    return;
  }

  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const pl of playlists) {
    rows.push([
      inlineButton(
        `🎶 ${pl.name} (${pl.trackIds.length} track)`,
        `playlist:view:${pl.id}`,
      ),
    ]);
  }

  if (allTracks.length > 0) {
    rows.push([
      inlineButton(`📀 Semua Track (${allTracks.length})`, "library:alltracks"),
    ]);
  }

  rows.push([inlineButton("⬅️ Kembali ke menu", "menu:main")]);

  await ctx.editMessageText("Jelajahi playlist kurasi dan koleksi yang diunggah:", {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^playlist:view:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const playlists = await getCuratedPlaylists();
  const playlist = playlists.find((p) => p.id === ctx.match[1]);
  if (!playlist) {
    await ctx.editMessageText("Playlist tidak ditemukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke koleksi", "library:curated")],
      ]),
    });
    return;
  }

  if (playlist.trackIds.length === 0) {
    await ctx.editMessageText(`"${playlist.name}" kosong.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke koleksi", "library:curated")],
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
    lines.push(`\ndan ${playlist.trackIds.length - 10} lainnya`);
  }

  rows.push([inlineButton("⬅️ Kembali ke koleksi", "library:curated")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery("library:alltracks", async (ctx) => {
  await ctx.answerCallbackQuery();
  const tracks = await getAllTracks();

  if (tracks.length === 0) {
    await ctx.editMessageText("Belum ada track tersedia.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke koleksi", "library:curated")],
      ]),
    });
    return;
  }

  const lines: string[] = ["📀 Semua Track:\n"];
  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const track of tracks.slice(0, 10)) {
    lines.push(`• ${track.artist} — ${track.title}`);
    rows.push([
      inlineButton(`▶️ ${track.artist} — ${track.title}`, `track:play:${track.id}`),
    ]);
  }

  if (tracks.length > 10) {
    lines.push(`\ndan ${tracks.length - 10} lainnya`);
  }

  rows.push([inlineButton("⬅️ Kembali ke koleksi", "library:curated")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(rows),
  });
});

export default composer;
