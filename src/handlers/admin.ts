import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
} from "../toolkit/index.js";
import { isAdmin, getTrack, saveTrack, deleteTrack, getAllTracks } from "../store.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("admin:tracks", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.editMessageText("Akses admin diperlukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const tracks = await getAllTracks();
  if (tracks.length === 0) {
    await ctx.editMessageText("Belum ada track. Upload track baru terlebih dahulu.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const rows: ReturnType<typeof inlineButton>[][] = [];
  for (const track of tracks.slice(0, 10)) {
    rows.push([
      inlineButton(`✏️ ${track.artist} — ${track.title}`, `admin:edittrack:${track.id}`),
      inlineButton("🗑", `admin:deletetrack:${track.id}`),
    ]);
  }
  if (tracks.length > 10) {
    rows.push([inlineButton(`dan ${tracks.length - 10} lainnya`, "admin:tracks")]);
  }
  rows.push([inlineButton("⬅️ Kembali ke menu", "menu:main")]);
  await ctx.editMessageText(`Kelola track (${tracks.length} total):`, {
    reply_markup: inlineKeyboard(rows),
  });
});

composer.callbackQuery(/^admin:edittrack:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.editMessageText("Akses admin diperlukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  if (!track) {
    await ctx.editMessageText("Track tidak ditemukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.step = "admin_edit_title";
  ctx.session.editTrackId = trackId;
  ctx.session.uploadData = {
    title: track.title,
    artist: track.artist,
    album: track.album,
    sourceType: track.sourceType,
  };
  await ctx.editMessageText(
    `Mengedit: ${track.artist} — ${track.title}\n\nJudul baru (atau ketik "-" untuk tetap):`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("Batal", "admin:editcancel")],
      ]),
    },
  );
});

composer.callbackQuery(/^admin:deletetrack:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.editMessageText("Akses admin diperlukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  if (!track) {
    await ctx.editMessageText("Track tidak ditemukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  await ctx.editMessageText(
    `Hapus track?\n\n${track.artist} — ${track.title}`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🗑 Ya, hapus", `admin:confirmdelete:${trackId}`)],
        [inlineButton("Batal", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^admin:confirmdelete:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.editMessageText("Akses admin diperlukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  const trackName = track ? `${track.artist} — ${track.title}` : "Track";
  await deleteTrack(trackId);
  await ctx.editMessageText(`✅ Track dihapus: ${trackName}`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("admin:editcancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.editTrackId = undefined;
  await ctx.editMessageText("Edit dibatalkan.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  if (!step?.startsWith("admin_edit_")) return next();

  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    ctx.session.step = undefined;
    ctx.session.editTrackId = undefined;
    await ctx.reply("Akses admin diperlukan.");
    return;
  }

  const trackId = ctx.session.editTrackId;
  if (!trackId) return next();

  if (!ctx.session.uploadData) {
    ctx.session.uploadData = {};
  }

  switch (step) {
    case "admin_edit_title": {
      const val = ctx.message.text.trim();
      if (val !== "-") ctx.session.uploadData.title = val;
      ctx.session.step = "admin_edit_artist";
      await ctx.reply("Nama artis baru (atau ketik \"-\" untuk tetap):", {
        reply_markup: inlineKeyboard([
          [inlineButton("Batal", "admin:editcancel")],
        ]),
      });
      break;
    }
    case "admin_edit_artist": {
      const val = ctx.message.text.trim();
      if (val !== "-") ctx.session.uploadData.artist = val;
      ctx.session.step = "admin_edit_album";
      await ctx.reply("Nama album baru (atau ketik \"-\" untuk tetap):", {
        reply_markup: inlineKeyboard([
          [inlineButton("Batal", "admin:editcancel")],
        ]),
      });
      break;
    }
    case "admin_edit_album": {
      const val = ctx.message.text.trim();
      if (val !== "-") ctx.session.uploadData.album = val;

      const existing = await getTrack(trackId);
      if (!existing) {
        ctx.session.step = undefined;
        ctx.session.editTrackId = undefined;
        await ctx.reply("Track tidak ditemukan.", {
          reply_markup: inlineKeyboard([
            [inlineButton("⬅️ Kembali ke menu", "menu:main")],
          ]),
        });
        return;
      }

      const d = ctx.session.uploadData;
      const updatedTrack = {
        ...existing,
        title: d.title ?? existing.title,
        artist: d.artist ?? existing.artist,
        album: d.album ?? existing.album,
      };
      await saveTrack(updatedTrack);

      ctx.session.step = undefined;
      ctx.session.editTrackId = undefined;
      ctx.session.uploadData = undefined;

      await ctx.reply(
        `✅ Track diperbarui!\n\n${updatedTrack.artist} — ${updatedTrack.title}`,
        {
          reply_markup: inlineKeyboard([
            [inlineButton("⬅️ Kembali ke menu", "menu:main")],
          ]),
        },
      );
      break;
    }
    default:
      return next();
  }
});

export default composer;
