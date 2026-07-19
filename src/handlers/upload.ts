import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { isAdmin, saveTrack, getTrackIds, addTrackToIndex, now } from "../store.js";

registerMainMenuItem({ label: "📤 Upload", data: "menu:upload", order: 40 });

const composer = new Composer<Ctx>();

composer.command("upload", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("Akses admin diperlukan. Hubungi pemilik bot untuk izin.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.step = "upload_title";
  ctx.session.uploadData = {};
  await ctx.reply("📤 Upload track baru\n\nJudul track?", {
    reply_markup: inlineKeyboard([
      [inlineButton("Batal", "upload:cancel")],
    ]),
  });
});

composer.callbackQuery("menu:upload", async (ctx) => {
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
  ctx.session.step = "upload_title";
  ctx.session.uploadData = {};
  await ctx.editMessageText("📤 Upload track baru\n\nJudul track?", {
    reply_markup: inlineKeyboard([
      [inlineButton("Batal", "upload:cancel")],
    ]),
  });
});

composer.callbackQuery("upload:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.uploadData = undefined;
  await ctx.editMessageText("Upload dibatalkan.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.step;
  if (!step?.startsWith("upload_")) return next();

  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    ctx.session.step = undefined;
    ctx.session.uploadData = undefined;
    await ctx.reply("Akses admin diperlukan.");
    return;
  }

  if (!ctx.session.uploadData) {
    ctx.session.uploadData = {};
  }

  switch (step) {
    case "upload_title": {
      ctx.session.uploadData.title = ctx.message.text.trim();
      ctx.session.step = "upload_artist";
      await ctx.reply("Nama artis?", {
        reply_markup: inlineKeyboard([
          [inlineButton("Batal", "upload:cancel")],
        ]),
      });
      break;
    }
    case "upload_artist": {
      ctx.session.uploadData.artist = ctx.message.text.trim();
      ctx.session.step = "upload_album";
      await ctx.reply("Nama album?", {
        reply_markup: inlineKeyboard([
          [inlineButton("Batal", "upload:cancel")],
        ]),
      });
      break;
    }
    case "upload_album": {
      ctx.session.uploadData.album = ctx.message.text.trim();
      ctx.session.step = "upload_source";
      await ctx.reply(
        "Tipe sumber?\n\n• owner — Kamu mengunggah track ini\n• licensed — Lisensi dari pihak ketiga",
        {
          reply_markup: inlineKeyboard([
            [inlineButton("Owner", "upload:setsource:owner")],
            [inlineButton("Licensed", "upload:setsource:licensed")],
            [inlineButton("Batal", "upload:cancel")],
          ]),
        },
      );
      break;
    }
    default:
      return next();
  }
});

composer.callbackQuery(/^upload:setsource:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const source = ctx.match[1];
  if (!ctx.session.uploadData) return;
  ctx.session.uploadData.sourceType = source;
  ctx.session.step = "upload_confirm";

  const d = ctx.session.uploadData;
  const lines = [
    "📋 Ringkasan upload:\n",
    `Judul: ${d.title}`,
    `Artis: ${d.artist}`,
    `Album: ${d.album}`,
    `Sumber: ${d.sourceType}`,
    "\nKonfirmasi upload?",
  ];

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("✅ Konfirmasi", "upload:confirm")],
      [inlineButton("Batal", "upload:cancel")],
    ]),
  });
});

composer.callbackQuery("upload:confirm", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !ctx.session.uploadData) return;

  const d = ctx.session.uploadData;
  const trackId = `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await saveTrack({
    id: trackId,
    title: d.title ?? "Tanpa Judul",
    artist: d.artist ?? "Tidak Diketahui",
    album: d.album ?? "Tidak Diketahui",
    formats: ["flac", "alac", "mp3", "aac"],
    sourceType: (d.sourceType as "owner" | "licensed") ?? "owner",
    licenseStatus: d.sourceType === "licensed" ? "pending" : "active",
    uploadedBy: userId,
    uploadedAt: now(),
  });
  await addTrackToIndex(trackId);

  ctx.session.step = undefined;
  ctx.session.uploadData = undefined;

  await ctx.editMessageText(
    `✅ Track berhasil diunggah!\n\n${d.artist} — ${d.title}\n\nTrack sekarang tersedia di koleksi.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🎵 Lihat koleksi", "library:curated")],
        [inlineButton("📤 Upload lagi", "menu:upload")],
        [inlineButton("📋 Kelola track", "admin:tracks")],
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    },
  );
});

export default composer;
