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
} from "../store.js";

registerMainMenuItem({ label: "🔍 Search", data: "menu:search", order: 10 });

const composer = new Composer<Ctx>();

composer.command("search", async (ctx) => {
  const query = ctx.message?.text?.replace(/^\/search\s*/, "").trim();
  if (query) {
    const results = await searchTracks(query);
    if (results.length === 0) {
      await ctx.reply(`No tracks found for "${query}". Try a different search.`, {
        reply_markup: inlineKeyboard([
          [inlineButton("⬅️ Back to menu", "menu:main")],
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
    buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
    await ctx.reply(`Found ${results.length} track${results.length > 1 ? "s" : ""}:\n\n${lines.join("\n")}`, {
      reply_markup: inlineKeyboard(buttons),
    });
  } else {
    ctx.session.step = "awaiting_search";
    await ctx.reply("Type a track name, artist, or album to search.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
  }
});

composer.callbackQuery("menu:search", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_search";
  await ctx.editMessageText("Type a track name, artist, or album to search.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_search") return next();
  const query = ctx.message.text.trim();
  ctx.session.step = undefined;
  const results = await searchTracks(query);
  if (results.length === 0) {
    await ctx.reply(`No tracks found for "${query}". Try a different search.`, {
      reply_markup: inlineKeyboard([
        [inlineButton("🔍 Search again", "menu:search")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
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
  buttons.push([inlineButton("🔍 Search again", "menu:search")]);
  buttons.push([inlineButton("⬅️ Back to menu", "menu:main")]);
  await ctx.reply(`Found ${results.length} track${results.length > 1 ? "s" : ""}:\n\n${lines.join("\n")}`, {
    reply_markup: inlineKeyboard(buttons),
  });
});

composer.callbackQuery(/^track:play:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  if (!track) {
    await ctx.editMessageText("Track not found. It may have been removed.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  const formatButtons = track.formats.map((f) => [
    inlineButton(`▶️ Stream ${f.toUpperCase()}`, `track:stream:${trackId}:${f}`),
  ]);
  formatButtons.push([
    inlineButton("⬅️ Back to menu", "menu:main"),
  ]);
  await ctx.editMessageText(
    `Now playing:\n\n${track.artist} — ${track.title}\nAlbum: ${track.album}\n\nChoose a format:`,
    { reply_markup: inlineKeyboard(formatButtons) },
  );
  const userId = ctx.from?.id;
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
  await ctx.answerCallbackQuery("Starting stream…");
  const trackId = ctx.match[1];
  const format = ctx.match[2];
  const track = await getTrack(trackId);
  if (!track) {
    await ctx.editMessageText("Track not found.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  await ctx.editMessageText(
    `▶️ Streaming: ${track.artist} — ${track.title}\nFormat: ${format.toUpperCase()}\n\nUse the controls below.`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("⏸ Pause", `track:pause:${trackId}`),
          inlineButton("⏹ Stop", `track:stop:${trackId}`),
        ],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^track:pause:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Paused");
  const trackId = ctx.match[1];
  await ctx.editMessageText(
    "⏸ Paused.\n\nTap Resume to continue or Stop to end.",
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("▶️ Resume", `track:resume:${trackId}`),
          inlineButton("⏹ Stop", `track:stop:${trackId}`),
        ],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^track:resume:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Resuming…");
  const trackId = ctx.match[1];
  const track = await getTrack(trackId);
  const title = track ? `${track.artist} — ${track.title}` : "Track";
  await ctx.editMessageText(
    `▶️ Resumed: ${title}\n\nUse the controls below.`,
    {
      reply_markup: inlineKeyboard([
        [
          inlineButton("⏸ Pause", `track:pause:${trackId}`),
          inlineButton("⏹ Stop", `track:stop:${trackId}`),
        ],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

composer.callbackQuery(/^track:stop:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery("Stopped");
  await ctx.editMessageText("⏹ Playback stopped.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
    ]),
  });
});

export default composer;
