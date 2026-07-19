import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import {
  searchTracks,
  getTrack,
  getUser,
  saveUser,
  isAdmin,
} from "../store.js";

registerMainMenuItem({ label: "🔍 Cari", data: "menu:search", order: 10 });

const composer = new Composer<Ctx>();

composer.command("search", async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/search\s*/, "").trim();
  if (query) {
    const results = await searchTracks(query);
    if (results.length === 0) {
      await ctx.reply(`Tidak ada track ditemukan untuk "${query}". Coba kata kunci lain.`, {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Kembali ke menu", "menu:main")],
        ]),
      });
      return;
    }
    const lines = results.slice(0, 5).map(
      (t, i) => `${i + 1}. ${t.artist} — ${t.title}`,
    );
    const buttons = results.slice(0, 5).map((t) => [
      inlineButton(`${t.artist} — ${t.title}`, `track:play:${t.id}`),
    ]);
    buttons.push([inlineButton("⬅️ Kembali ke menu", "menu:main")]);
    await ctx.reply(`Ditemukan ${results.length} track:\n\n${lines.join("\n")}`, {
      reply_markup: inlineKeyboard(buttons),
    });
  } else {
    ctx.session.step = "awaiting_search";
    await ctx.reply("Ketik nama track, artis, atau album untuk mencari.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
  }
});

composer.callbackQuery("menu:search", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_search";
  await ctx.editMessageText("Ketik nama track, artis, atau album untuk mencari.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_search") return next();
  const query = ctx.message.text.trim();
  ctx.session.step = undefined;
  const results = await searchTracks(query);
  if (results.length === 0) {
    await ctx.reply(`Tidak ada track ditemukan untuk "${query}". Coba kata kunci lain.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔍 Cari lagi", "menu:search")],
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const lines = results.slice(0, 5).map(
    (t, i) => `${i + 1}. ${t.artist} — ${t.title}`,
  );
  const buttons = results.slice(0, 5).map((t) => [
    inlineButton(`${t.artist} — ${t.title}`, `track:play:${t.id}`),
  ]);
  buttons.push([inlineButton("🔍 Cari lagi", "menu:search")]);
  buttons.push([inlineButton("⬅️ Kembali ke menu", "menu:main")]);
  await ctx.reply(`Ditemukan ${results.length} track:\n\n${lines.join("\n")}`, {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^track:play:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  if (!track) {
    await ctx.editMessageText("Track tidak ditemukan. Mungkin sudah dihapus.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const formatButtons = track.formats.map((f) => [
    inlineButton(`▶️ Stream ${f.toUpperCase()}`, `track:stream:${trackId}:${f}`),
  ]);
  formatButtons.push([
    inlineButton("⬇️ Download", `track:download:${trackId}`),
  ]);
  const userId = ctx.from?.id;
  if (userId && await isAdmin(userId)) {
    formatButtons.push([
      inlineButton("✏️ Edit", `admin:edittrack:${trackId}`),
      inlineButton("🗑 Hapus", `admin:deletetrack:${trackId}`),
    ]);
  }
  formatButtons.push([
    inlineButton("⬅️ Kembali ke menu", "menu:main"),
  ]);
  await ctx.editMessageText(
    `Sekarang memutar:\n\n${track.artist} — ${track.title}\nAlbum: ${track.album}\n\nGratis untuk semua kualitas — pilih format:`,
    { reply_markup: inlineKeyboard(formatButtons) },
  );
  if (userId) {
    const user = await getUser(userId);
    if (user) {
      user.listeningHistory.push(trackId);
      if (user.listeningHistory.length > 50) {
        user.listeningHistory = user.listeningHistory.slice(-50);
      }
      await saveUser(user);
    }
  }
});

composer.callbackQuery(/^track:stream:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Memulai stream…");
  const trackId = ctx.match[1];
  const format = ctx.match[2];
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
    `▶️ Streaming: ${track.artist} — ${track.title}\nFormat: ${format.toUpperCase()}\n\nGunakan kontrol di bawah.`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("⏸ Jeda", `track:pause:${trackId}`),
          inlineButton("⏹ Berhenti", `track:stop:${trackId}`),
        ],
        [inlineButton("⬇️ Download", `track:download:${trackId}`)],
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^track:pause:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Dijeda");
  const trackId = ctx.match[1];
  await ctx.editMessageText(
    "⏸ Dijeda.\n\nKetuk Lanjutkan untuk melanjutkan atau Berhenti untuk menghentikan.",
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("▶️ Lanjutkan", `track:resume:${trackId}`),
          inlineButton("⏹ Berhenti", `track:stop:${trackId}`),
        ],
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^track:resume:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Melanjutkan…");
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  const title = track ? `${track.artist} — ${track.title}` : "Track";
  await ctx.editMessageText(
    `▶️ Dilanjutkan: ${title}\n\nGunakan kontrol di bawah.`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("⏸ Jeda", `track:pause:${trackId}`),
          inlineButton("⏹ Berhenti", `track:stop:${trackId}`),
        ],
        [inlineButton("⬇️ Download", `track:download:${trackId}`)],
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^track:stop:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Dihentikan");
  await ctx.editMessageText("⏹ Pemutaran dihentikan.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery(/^track:download:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
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
  const formatButtons = track.formats.map((f) => [
    inlineButton(`⬇️ ${f.toUpperCase()}`, `track:sendfile:${trackId}:${f}`),
  ]);
  formatButtons.push([inlineButton("⬅️ Kembali", `track:play:${trackId}`)]);
  await ctx.editMessageText(
    `Pilih format untuk download:\n\n${track.artist} — ${track.title}\n\nSemua format tersedia secara gratis.`,
    { reply_markup: inlineKeyboard(formatButtons) },
  );
});

composer.callbackQuery(/^track:sendfile:(.+):(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Menyiapkan file…");
  const trackId = ctx.match[1];
  const format = ctx.match[2];
  const track = await getTrack(trackId);
  if (!track) {
    await ctx.reply("Track tidak ditemukan.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const caption = `${track.artist} — ${track.title}\nAlbum: ${track.album}\nFormat: ${format.toUpperCase()}`;
  await ctx.reply(caption, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

export default composer;
