import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { getUser, getTrack, saveUser } from "../store.js";

registerMainMenuItem({ label: "👤 Profil", data: "menu:profile", order: 30 });

const composer = new Composer<Ctx>();

function profileText(user: { preferences: { quality: string; language: string }; listeningHistory: string[]; email?: string }): string {
  const lines = [
    "👤 Profilmu\n",
    `Kualitas: ${user.preferences.quality.toUpperCase()}`,
    `Bahasa: ${user.preferences.language}`,
    `Track diputar: ${user.listeningHistory.length}`,
  ];
  return lines.join("\n");
}

composer.command("profile", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Tidak bisa memuat profil. Ketuk /start terlebih dahulu.");
    return;
  }
  const user = await getUser(userId);
  if (!user) {
    await ctx.reply("Kamu belum terdaftar. Ketuk /start untuk memulai.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  await ctx.reply(profileText(user), {
    reply_markup: inlineKeyboard([
      [inlineButton("⚙️ Pengaturan", "profile:settings")],
      [inlineButton("📜 Riwayat putar", "profile:history")],
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("menu:profile", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.editMessageText("Tidak bisa memuat profil.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  const user = await getUser(userId);
  if (!user) {
    await ctx.editMessageText("Kamu belum terdaftar. Ketuk /start untuk memulai.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Kembali ke menu", "menu:main")],
      ]),
    });
    return;
  }
  await ctx.editMessageText(profileText(user), {
    reply_markup: inlineKeyboard([
      [inlineButton("⚙️ Pengaturan", "profile:settings")],
      [inlineButton("📜 Riwayat putar", "profile:history")],
      [inlineButton("⬅️ Kembali ke menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("profile:settings", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) return;
  await ctx.editMessageText(
    `⚙️ Pengaturan\n\nKualitas saat ini: ${user.preferences.quality.toUpperCase()}\nBahasa: ${user.preferences.language === "id" ? "Indonesia" : "English"}`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("FLAC", "profile:setquality:flac"),
          inlineButton("ALAC", "profile:setquality:alac"),
        ],
        [
          inlineButton("MP3", "profile:setquality:mp3"),
          inlineButton("AAC", "profile:setquality:aac"),
        ],
        [inlineButton("Bahasa: Indonesia", "profile:setlang:id")],
        [inlineButton("⬅️ Kembali ke profil", "menu:profile")],
      ]),
    },
  );
});

composer.callbackQuery(/^profile:setquality:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const quality = ctx.match[1] as "flac" | "alac" | "mp3" | "aac";
  const userId = ctx.from?.id;
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) return;
  user.preferences.quality = quality;
  await saveUser(user);
  await ctx.editMessageText(`Kualitas diatur ke ${quality.toUpperCase()}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke profil", "menu:profile")],
    ]),
  });
});

composer.callbackQuery(/^profile:setlang:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const lang = ctx.match[1];
  const userId = ctx.from?.id;
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) return;
  user.preferences.language = lang;
  await saveUser(user);
  const langName = lang === "id" ? "Indonesia" : "English";
  await ctx.editMessageText(`Bahasa diatur ke ${langName}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Kembali ke profil", "menu:profile")],
    ]),
  });
});

composer.callbackQuery("profile:history", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) return;
  const user = await getUser(userId);
  if (!user) return;

  if (user.listeningHistory.length === 0) {
    await ctx.editMessageText("Belum ada riwayat putar. Mulai putar beberapa track!", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔍 Cari", "menu:search")],
        [inlineButton("⬅️ Kembali ke profil", "menu:profile")],
      ]),
    });
    return;
  }

  const recent = user.listeningHistory.slice(-10).reverse();
  const lines: string[] = ["📜 Putar terakhir:\n"];
  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const trackId of recent) {
    const track = await getTrack(trackId);
    if (!track) continue;
    lines.push(`• ${track.artist} — ${track.title}`);
    rows.push([
      inlineButton(`▶️ ${track.artist} — ${track.title}`, `track:play:${track.id}`),
    ]);
  }

  rows.push([inlineButton("⬅️ Kembali ke profil", "menu:profile")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(rows),
  });
});

export default composer;
