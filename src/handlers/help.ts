import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const HELP =
  "ℹ️ High-Res Music Streamer\n\n" +
  "Streaming dan download track FLAC/ALAC dari koleksi kurasi.\n\n" +
  "Ketuk /start untuk membuka menu, lalu pilih yang kamu inginkan.\n\n" +
  "Semua fitur bisa diakses dengan mengetuk tombol.";

const backToMenu = inlineKeyboard([[inlineButton("⬅️ Kembali ke menu", "menu:main")]]);

composer.command("help", async (ctx) => {
  await ctx.reply(HELP);
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(HELP, { reply_markup: backToMenu });
});

export default composer;
