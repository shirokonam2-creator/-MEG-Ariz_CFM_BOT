require("dotenv").config();

const http = require("http");

const {
  Client,
  GatewayIntentBits,
  Events,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");

// ========================================
// WATCH / CINEMA
// ========================================

const {
  startWatchLive,
  getWatchLive,
  getWatchCurrentVideo,
  watchNext,
  watchPause,
  watchResume,
  watchStop,
  clearWatchLive,
  MAX_WATCH_LINKS
} = require("./Lienket_watch");

const {
  createWatchRoom,
  getWatchRoom
} = require("./watchRoom");

// ========================================
// MUSIC
// ========================================

const {
  handleMusicButton
} = require("./Music/musicButtons");

const {
  playQuery
} = require("./Music/musicActions");

// ========================================
// CONFIG
// ========================================

const PREFIX = "p!";
const MAX_VIDEOS = 3;

// ========================================
// ENV
// ========================================

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Thiếu DISCORD_TOKEN!");
  process.exit(1);
}

// ========================================
// HTTP SERVER - RAILWAY
// ========================================

const PORT = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Arizu Cinema Bot is online!");
    return;
  }

  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Not Found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `🌐 HTTP server đang chạy trên port ${PORT}`
  );
});

// ========================================
// DISCORD CLIENT
// ========================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ========================================
// BOT READY
// ========================================

client.once(
  Events.ClientReady,
  readyClient => {
    console.log(
      `✅ Bot đã đăng nhập: ${readyClient.user.tag}`
    );

    console.log(
      "🎬 [MEG]Ariz_CFM_BOT đang hoạt động!"
    );

    console.log(
      `🎵 Music system mới đã được nạp. Prefix: ${PREFIX}`
    );

    console.log(
      "📢 Lệnh: p!play | p!join | p!watch"
    );
  }
);

// ========================================
// HELPER
// ========================================

function getMentionedUserId(text) {
  const match = text.match(
    /<@!?(\d+)>/
  );

  return match ? match[1] : null;
}

function getMentionedChannelId(text) {
  const match = text.match(
    /<#(\d+)>/
  );

  return match ? match[1] : null;
}

function removeMentionTokens(text) {
  return text
    .replace(/<@!?\d+>/g, "")
    .replace(/<#\d+>/g, "")
    .trim();
}

function isUrl(text) {
  return /^https?:\/\//i.test(text);
}

function getWatchLinksAndName(args) {
  const links = [];
  const names = [];

  for (const arg of args) {
    if (isUrl(arg)) {
      links.push(arg);
    } else {
      names.push(arg);
    }
  }

  return {
    links,
    videoName:
      names.length > 0
        ? names.join(" ")
        : "Video"
  };
}

async function sendCommandError(
  message,
  error
) {
  console.error(error);

  await message.reply(
    `❌ Không thể thực hiện lệnh.\n` +
    `\`${error?.message || "Lỗi không xác định"}\``
  );
}

// ========================================
// PREFIX COMMANDS
// ========================================

client.on(
  Events.MessageCreate,
  async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const content =
      message.content.trim();

    if (
      !content
        .toLowerCase()
        .startsWith(PREFIX)
    ) {
      return;
    }

    const raw =
      content.slice(PREFIX.length).trim();

    if (!raw) return;

    const parts =
      raw.split(/\s+/);

    const command =
      parts.shift().toLowerCase();

    const args = parts;

    // ====================================
    // p!play
    // ====================================

    if (command === "play") {
      const query =
        args.join(" ").trim();

      if (!query) {
        await message.reply(
          "❌ Cách dùng: `p!play <tên bài hoặc URL>`"
        );
        return;
      }

      try {
        const result =
          await playQuery(
            client,
            message,
            query
          );

        if (!result) {
          await message.reply(
            "❌ Không nhận được kết quả phát nhạc."
          );
          return;
        }

        if (
          result.type === "queue"
        ) {
          await message.reply(
            `🎵 Đã thêm **${result.track.songName}** ` +
            `vào danh sách đợi.\n` +
            `📋 Vị trí: **#${result.position}**`
          );

          return;
        }

        if (
          result.type === "playing"
        ) {
          const track =
            result.track;

          const embed =
            new EmbedBuilder()
              .setTitle(
                "🎵 Đang phát nhạc"
              )
              .setDescription(
                `**[${track.songName}](${track.url})**`
              )
              .setFooter({
                text:
                  "[MEG]Ariz Music"
              });

          await message.reply({
            embeds: [embed]
          });

          return;
        }

        await message.reply(
          "✅ Đã xử lý yêu cầu phát nhạc."
        );

      } catch (error) {
        await sendCommandError(
          message,
          error
        );
      }

      return;
    }

    // ====================================
    // p!join
    // ====================================

    if (command === "join") {
      const member =
        message.member;

      if (
        !member?.voice?.channel
      ) {
        await message.reply(
          "❌ Bạn phải vào một phòng thoại trước!"
        );
        return;
      }

      const voiceChannel =
        member.voice.channel;

      if (
        voiceChannel.type !==
        ChannelType.GuildVoice
      ) {
        await message.reply(
          "❌ Đây không phải phòng thoại."
        );
        return;
      }

      const permissions =
        voiceChannel.permissionsFor(
          client.user
        );

      if (
        !permissions ||
        !permissions.has("Connect")
      ) {
        await message.reply(
          "❌ Bot không có quyền **Connect** vào phòng thoại này."
        );
        return;
      }

      try {
        joinVoiceChannel({
          channelId:
            voiceChannel.id,

          guildId:
            voiceChannel.guild.id,

          adapterCreator:
            voiceChannel
              .guild
              .voiceAdapterCreator,

          selfDeaf: false,
          selfMute: false
        });

        await message.reply(
          `🔊 **[MEG]Ariz_CFM_BOT đã tham gia phòng thoại!**\n\n` +
          `📢 **Phòng:** ${voiceChannel}\n` +
          `👤 **Người gọi:** ${message.author}\n\n` +
          `🎬 Bot đã sẵn sàng cho Cinema Room.`
        );

        console.log(
          `🔊 Bot đã join: ${voiceChannel.name}`
        );

      } catch (error) {
        await sendCommandError(
          message,
          error
        );
      }

      return;
    }

    // ====================================
    // p!watch
    //
    // p!watch @chủ_phòng #phòng_voice
    // Tên phim link1 link2 link3
    // ====================================

    if (command === "watch") {
      if (args.length < 3) {
        await message.reply(
          "❌ Cách dùng:\n" +
          "`p!watch @chủ_phòng #phòng_voice Tên_phim link1 link2 link3`\n\n" +
          `📌 Tối đa ${MAX_VIDEOS} video.`
        );
        return;
      }

      const fullArgs =
        args.join(" ");

      const ownerId =
        getMentionedUserId(
          fullArgs
        );

      const voiceChannelId =
        getMentionedChannelId(
          fullArgs
        );

      if (!ownerId) {
        await message.reply(
          "❌ Hãy mention chủ phòng, ví dụ `@TênNgười`."
        );
        return;
      }

      if (!voiceChannelId) {
        await message.reply(
          "❌ Hãy mention phòng voice, ví dụ `#PhòngVoice`."
        );
        return;
      }

      const owner =
        await client.users.fetch(
          ownerId
        ).catch(() => null);

      if (!owner) {
        await message.reply(
          "❌ Không tìm thấy chủ phòng."
        );
        return;
      }

      const voiceChannel =
        message.guild.channels.cache.get(
          voiceChannelId
        );

      if (!voiceChannel) {
        await message.reply(
          "❌ Không tìm thấy phòng voice."
        );
        return;
      }

      if (
        voiceChannel.type !==
        ChannelType.GuildVoice
      ) {
        await message.reply(
          "❌ Kênh được chọn không phải phòng voice."
        );
        return;
      }

      const cleanInput =
        removeMentionTokens(
          fullArgs
        );

      const cleanParts =
        cleanInput.split(/\s+/);

      const {
        links,
        videoName
      } =
        getWatchLinksAndName(
          cleanParts
        );

      if (links.length === 0) {
        await message.reply(
          "❌ Bạn chưa cung cấp link video hợp lệ."
        );
        return;
      }

      if (
        links.length > MAX_VIDEOS
      ) {
        await message.reply(
          `❌ Chỉ được tối đa **${MAX_VIDEOS} video** cho mỗi Live.`
        );
        return;
      }

      try {
        startWatchLive({
          owner,
          voiceChannel,
          videoName,
          links
        });

        const currentVideo =
          getWatchCurrentVideo();

        createWatchRoom(
          links[0],
          owner,
          voiceChannel
        );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎬 [MEG]Ariz_CFM_BOT — Live"
            )
            .setDescription(
              `**${videoName}**\n\n` +
              `👑 **Chủ phòng:** ${owner}\n` +
              `🔊 **Phòng:** ${voiceChannel}\n\n` +
              `▶️ **Đang phát:** Video ${currentVideo.id}\n\n` +
              `🔗 **Link:** ${currentVideo.link}\n\n` +
              `📋 **Tổng số video:** ${links.length}`
            )
            .setTimestamp();

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "live_pause"
                )
                .setLabel(
                  "⏸️ Tạm dừng"
                )
                .setStyle(
                  ButtonStyle.Secondary
                ),

              new ButtonBuilder()
                .setCustomId(
                  "live_resume"
                )
                .setLabel(
                  "▶️ Tiếp tục"
                )
                .setStyle(
                  ButtonStyle.Success
                ),

              new ButtonBuilder()
                .setCustomId(
                  "live_next"
                )
                .setLabel(
                  "⏭️ Tiếp"
                )
                .setStyle(
                  ButtonStyle.Primary
                ),

              new ButtonBuilder()
                .setCustomId(
                  "live_stop"
                )
                .setLabel(
                  "⏹️ Dừng"
                )
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        await message.reply({
          embeds: [embed],
          components: [row]
        });

        console.log(
          `🎬 ${message.author.tag} ` +
          `tạo Live "${videoName}" ` +
          `với ${links.length} video.`
        );

      } catch (error) {
        await sendCommandError(
          message,
          error
        );
      }

      return;
    }
  }
);

// ========================================
// BUTTONS
// ========================================

client.on(
  Events.InteractionCreate,
  async interaction => {
    if (!interaction.isButton()) {
      return;
    }

    try {
      const musicButtonIds = [
        "music_pause",
        "music_resume",
        "music_skip",
        "music_stop",
        "music_shuffle",
        "music_loop",
        "music_vol_down",
        "music_vol_up",
        "music_queue",
        "music_queue_first",
        "music_queue_prev",
        "music_queue_next",
        "music_queue_last",
        "music_stop_confirm",
        "music_leave"
      ];

      if (
        musicButtonIds.includes(
          interaction.customId
        )
      ) {
        await handleMusicButton(
          interaction,
          client
        );
        return;
      }

      // ==================================
      // LIVE PAUSE
      // ==================================

      if (
        interaction.customId ===
        "live_pause"
      ) {
        const success =
          watchPause();

        await interaction.reply({
          content:
            success
              ? "⏸️ Live đã tạm dừng."
              : "❌ Không có Live đang hoạt động.",
          ephemeral: true
        });

        return;
      }

      // ==================================
      // LIVE RESUME
      // ==================================

      if (
        interaction.customId ===
        "live_resume"
      ) {
        const success =
          watchResume();

        await interaction.reply({
          content:
            success
              ? "▶️ Live đã tiếp tục."
              : "❌ Không có Live đang hoạt động.",
          ephemeral: true
        });

        return;
      }

      // ==================================
      // LIVE NEXT
      // ==================================

      if (
        interaction.customId ===
        "live_next"
      ) {
        const next =
          watchNext();

        if (!next) {
          await interaction.reply({
            content:
              "⏹️ Đã hết danh sách video.",
            ephemeral: true
          });

          return;
        }

        await interaction.reply({
          content:
            `⏭️ Chuyển sang **video ${next.id}**.\n` +
            `🔗 ${next.link}`,
          ephemeral: true
        });

        return;
      }

      // ==================================
      // LIVE STOP
      // ==================================

      if (
        interaction.customId ===
        "live_stop"
      ) {
        const success =
          watchStop();

        await interaction.reply({
          content:
            success
              ? "⏹️ Live đã dừng."
              : "❌ Không có Live đang hoạt động.",
          ephemeral: true
        });

        return;
      }

      // ==================================
      // WATCH INFO
      // ==================================

      if (
        interaction.customId ===
        "watch_info"
      ) {
        const room =
          getWatchRoom();

        const live =
          getWatchLive();

        const current =
          getWatchCurrentVideo();

        if (
          !room ||
          !live ||
          !current
        ) {
          await interaction.reply({
            content:
              "❌ Không có Cinema Room đang hoạt động.",
            ephemeral: true
          });

          return;
        }

        const infoEmbed =
          new EmbedBuilder()
            .setTitle(
              "🎬 Cinema Room"
            )
            .setDescription(
              `👑 **Chủ phòng:** ${live.owner}\n` +
              `🔊 **Phòng:** ${live.voiceChannel}\n\n` +
              `▶️ **Video hiện tại:** ${current.id}\n\n` +
              `🔗 **Link:** ${current.link}`
            )
            .setTimestamp();

        await interaction.reply({
          embeds: [infoEmbed],
          ephemeral: true
        });

        return;
      }

    } catch (error) {
      console.error(
        "❌ Button error:"
      );

      console.error(error);

      try {
        if (
          !interaction.replied &&
          !interaction.deferred
        ) {
          await interaction.reply({
            content:
              "❌ Có lỗi khi xử lý nút.",
            ephemeral: true
          });
        }
      } catch {}
    }
  }
);

// ========================================
// START BOT
// ========================================

async function startBot() {
  console.log(
    "🔐 Đang kết nối tới Discord..."
  );

  try {
    await client.login(
      process.env.DISCORD_TOKEN
    );
  } catch (error) {
    console.error(
      "❌ Không thể đăng nhập Discord:"
    );

    console.error(error);

    process.exit(1);
  }
}

console.log(
  "🚀 Đang khởi động [MEG]Ariz_CFM_BOT..."
);

startBot();
