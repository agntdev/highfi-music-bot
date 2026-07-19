import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { mainMenuKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { getUser, saveUser, addUserToIndex, now } from "../store.js";

registerMainMenuItem({ label: "🔍 Search", data: "menu:search", order: 10 });
registerMainMenuItem({ label: "🎵 Library", data: "library:curated", order: 20 });
registerMainMenuItem({ label: "👤 Profile", data: "menu:profile", order: 30 });

const composer = new Composer<Ctx>();

const WELCOME = "👋 Welcome! Tap a button below to get started.";

composer.command("start", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId) {
    const existing = await getUser(userId);
    if (!existing) {
      await saveUser({
        telegramId: userId,
        registeredAt: now(),
        preferences: { quality: "flac", language: "en" },
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
