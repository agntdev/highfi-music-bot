import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getUser, saveUser, addUserToIndex, now } from "../store.js";

registerMainMenuItem({ label: "🔍 Cari", data: "menu:search", order: 10 });
registerMainMenuItem({ label: "🎵 Koleksi", data: "library:curated", order: 20 });
registerMainMenuItem({ label: "👤 Profil", data: "menu:profile", order: 30 });

const composer = new Composer<Ctx>();

const WELCOME = "👋 Selamat datang! Ketuk tombol di bawah untuk mulai.";

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    const existing = await getUser(userId);
    if (!existing) {
      await saveUser({
        telegramId: userId,
        registeredAt: now(),
        preferences: { quality: "flac", language: "id" },
        listeningHistory: [],
      });
      await addUserToIndex(userId);
    }
  }
  await ctx.reply(WELCOME, { reply_markup: mainMenuKeyboard() });
});

composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(WELCOME, { reply_markup: mainMenuKeyboard() });
});

export default composer;
