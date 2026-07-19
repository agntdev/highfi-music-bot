import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  inlineButton,
  inlineKeyboard,
  registerMainMenuItem,
} from "../toolkit/index.js";
import { isAdmin, saveTrack, getTrackIds, addTrackToIndex, now } from "../store.js";

registerMainMenuItem({ label: "📤 Upload", data: "menu:upload", order: 40, });

const composer = new Composer<Ctx>();

composer.command("upload", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.reply("Admin access required. Contact the bot owner for permissions.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.step = "upload_title";
  ctx.session.uploadData = {};
  await ctx.reply("📤 New track upload\n\nWhat's the track title?", {
    reply_markup: inlineKeyboard([
      [inlineButton("Cancel", "upload:cancel")],
    ]),
  });
});

composer.callbackQuery("menu:upload", async (ctx) => {
  await ctx.answerCallbackQuery();
  const userId = ctx.from?.id;
  if (!userId || !(await isAdmin(userId))) {
    await ctx.editMessageText("Admin access required.", {
      reply_markup: inlineKeyboard([
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    });
    return;
  }
  ctx.session.step = "upload_title";
  ctx.session.uploadData = {};
  await ctx.editMessageText("📤 New track upload\n\nWhat's the track title?", {
    reply_markup: inlineKeyboard([
      [inlineButton("Cancel", "upload:cancel")],
    ]),
  });
});

composer.callbackQuery("upload:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = undefined;
  ctx.session.uploadData = undefined;
  await ctx.editMessageText("Upload cancelled.", {
    reply_markup: inlineKeyboard([
      [inlineButton("⬅️ Back to menu", "menu:main")],
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
    await ctx.reply("Admin access required.");
    return;
  }

  if (!ctx.session.uploadData) {
    ctx.session.uploadData = {};
  }

  switch (step) {
    case "upload_title": {
      ctx.session.uploadData.title = ctx.message.text.trim();
      ctx.session.step = "upload_artist";
      await ctx.reply("Artist name?", {
        reply_markup: inlineKeyboard([
          [inlineButton("Cancel", "upload:cancel")],
        ]),
      });
      break;
    }
    case "upload_artist": {
      ctx.session.uploadData.artist = ctx.message.text.trim();
      ctx.session.step = "upload_album";
      await ctx.reply("Album name?", {
        reply_markup: inlineKeyboard([
          [inlineButton("Cancel", "upload:cancel")],
        ]),
      });
      break;
    }
    case "upload_album": {
      ctx.session.uploadData.album = ctx.message.text.trim();
      ctx.session.step = "upload_source";
      await ctx.reply(
        "Source type?\n\n• owner — You uploaded this track\n• licensed — Licensed from a third party",
        {
          reply_markup: inlineKeyboard([
            [inlineButton("Owner", "upload:setsource:owner")],
            [inlineButton("Licensed", "upload:setsource:licensed")],
            [inlineButton("Cancel", "upload:cancel")],
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
    "📋 Upload summary:\n",
    `Title: ${d.title}`,
    `Artist: ${d.artist}`,
    `Album: ${d.album}`,
    `Source: ${d.sourceType}`,
    "\nConfirm upload?",
  ];

  await ctx.editMessageText(lines.join("\n"), {
    reply_markup: inlineKeyboard([
      [inlineButton("✅ Confirm", "upload:confirm")],
      [inlineButton("Cancel", "upload:cancel")],
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
    title: d.title ?? "Untitled",
    artist: d.artist ?? "Unknown",
    album: d.album ?? "Unknown",
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
    `✅ Track uploaded successfully!\n\n${d.artist} — ${d.title}\n\nThe track is now available in the library.`,
    {
      reply_markup: inlineKeyboard([
        [inlineButton("🎵 View library", "library:curated")],
        [inlineButton("⬅️ Back to menu", "menu:main")],
      ]),
    },
  );
});

export default composer;
