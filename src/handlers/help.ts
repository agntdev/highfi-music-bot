import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const HELP =
  "ℹ️ High-Res Music Streamer\n\n" +
  "Stream and download FLAC/ALAC tracks from a curated library.\n\n" +
  "Tap /start to open the menu, then pick what you want from the buttons.\n\n" +
  "Everything is reachable by tapping — no commands to remember.";

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Back to menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP);
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { reply_markup: backToMenu });
});

export default composer;
