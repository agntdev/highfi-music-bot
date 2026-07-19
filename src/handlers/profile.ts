import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { getUser, getTrack, saveUser } from "../store.js";

registerMainMenuItem({ label: "👤 Profile", data: "menu:profile", order: 30 });

const composer = new Composer<Ctx>();

function profileText(user: { preferences: { quality: string; language: string }; listeningHistory: string[]; email?: string }): string {
  const lines = [
    "👤 Your profile\n",
    `Quality: ${user.preferences.quality.toUpperCase()}`,
    `Language: ${user.preferences.language}`,
    `Tracks played: ${user.listeningHistory.length}`,
  ];
  return lines.join("\n");
}

composer.command("profile", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Couldn't load your profile. Try /start first.");
    return;
  }
  const user = await getUser(userId);
  if (!user) {
    await ctx.reply("You're not registered yet. Tap /start to get started.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  await ctx.reply(profileText(user), {
    reply_markup: inlineKeyboard([
      [inlineButton("⚙️ Settings", "profile:settings")],
      [inlineButton("📜 Listening history", "profile:history")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.callbackQuery("menu:profile", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.editMessageText("Couldn't load your profile.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  const user = await getUser(userId);
  if (!user) {
    await ctx.editMessageText("You're not registered yet. Tap /start to get started.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  await ctx.editMessageText(profileText(user), {
    reply_markup: inlineKeyboard([
      [inlineButton("⚙️ Settings", "profile:settings")],
      [inlineButton("📜 Listening history", "profile:history")],
      [inlineButton("⬅️ Back to menu", "menu:main")],
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
    `⚙️ Settings\n\nCurrent quality: ${user.preferences.quality.toUpperCase()}`,
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
        [inlineButton("⬅️ Back to profile", "menu:profile")],
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
  await ctx.editMessageText(`Quality set to ${quality.toUpperCase()}.`, {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to profile", "menu:profile")],
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
    await ctx.editMessageText("No listening history yet. Start playing some tracks!", {
      reply_markup: inlineKeyboard([
        [inlineButton("🔍 Search", "menu:search")],
        [inlineButton("⬅️ Back to profile", "menu:profile")],
      ]),
    });
    return;
  }

  const recent = user.listeningHistory.slice(-10).reverse();
  const lines: string[] = ["📜 Recent plays:\n"];
  const rows: ReturnType<typeof inlineButton>[][] = [];

  for (const trackId of recent) {
    const track = await getTrack(trackId);
    if (!track) continue;
    lines.push(`• ${track.artist} — ${track.title}`);
    rows.push([
      inlineButton(`▶️ ${track.artist} — ${track.title}`, `track:play:${track.id}`),
    ]);
  }

  rows.push([inlineButton("⬅️ Back to profile", "menu:profile")]);

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard(rows),
  });
});

export default composer;
