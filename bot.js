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
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType
} = require("discord.js");

const {
  GatewayDispatchEvents
} = require("discord.js");

const {
  Riffy
} = require("riffy");

const {
  joinVoiceChannel
} = require("@discordjs/voice");

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

const {
  handleMusicButton
} = require("./Music/musicButtons");

const {
  playQuery
} = require("./Music/musicActions");

const MAX_VIDEOS = 3;

const LAVALINK_HOST =
  process.env.LAVALINK_HOST || "localhost";

const LAVALINK_PORT =
  Number(process.env.LAVALINK_PORT || 2333);

const LAVALINK_PASSWORD =
  process.env.LAVALINK_PASSWORD ||
  "youshallnotpass";

const LAVALINK_SECURE =
  String(
    process.env.LAVALINK_SECURE || "false"
  ).toLowerCase() === "true";

const LAVALINK_NAME =
  process.env.LAVALINK_NAME || "Main";

const LAVALINK_SEARCH_PLATFORM =
  process.env.LAVALINK_SEARCH_PLATFORM ||
  "ytmsearch";

if (!process.env.DISCORD_TOKEN) {
  console.error("❌ Thiếu DISCORD_TOKEN!");
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error("❌ Thiếu CLIENT_ID!");
  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error("❌ Thiếu GUILD_ID!");
  process.exit(1);
}

const PORT =
  process.env.PORT || 10000;

const server =
  http.createServer((req, res) => {

    if (req.url === "/") {

      res.writeHead(200, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end(
        "Arizu Cinema Bot is online!"
      );

      return;
    }

    res.writeHead(404, {
      "Content-Type":
        "text/plain; charset=utf-8"
    });

    res.end("Not Found");
  });

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🌐 HTTP server đang chạy trên port ${PORT}`
    );

  }
);

const client =
  new Client({

    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ]

  });

function initializeMusic() {

  try {

    client.riffy =
      new Riffy(

        client,

        [
          {
            host:
              LAVALINK_HOST,

            port:
              LAVALINK_PORT,

            password:
              LAVALINK_PASSWORD,

            secure:
              LAVALINK_SECURE,

            name:
              LAVALINK_NAME
          }
        ],

        {

          send: payload => {

            const guildId =
              payload?.d?.guild_id;

            if (!guildId) {
              return;
            }

            const guild =
              client.guilds.cache.get(
                guildId
              );

            if (
              guild &&
              guild.shard
            ) {

              guild.shard.send(
                payload
              );

              return;
            }

            const shardCount =
              client.ws.shards.size || 1;

            const shardId =
              Number(
                (
                  BigInt(guildId) >>
                  22n
                ) %
                BigInt(shardCount)
              );

            client.ws.shards
              .get(shardId)
              ?.send(payload);

          },

          defaultSearchPlatform:
            LAVALINK_SEARCH_PLATFORM,

          restVersion:
            "v4",

          bypassChecks: {
            nodeFetchInfo: true
          }

        }

      );

    client.riffy.on(
      "nodeConnect",
      node => {

        console.log(
          `✅ LAVALINK NODE CONNECTED: ${node.name}`
        );

      }
    );

    client.riffy.on(
      "nodeError",
      (node, error) => {

        console.error(
          `❌ LAVALINK NODE ERROR [${node?.name || "unknown"}]:`,
          error?.message || error
        );

      }
    );

    client.riffy.on(
      "nodeDisconnect",
      (node, reason) => {

        console.error(
          `⚠️ LAVALINK NODE DISCONNECTED [${node?.name || "unknown"}]:`,
          reason
        );

      }
    );

    client.on(
      "raw",
      packet => {

        if (
          ![
            GatewayDispatchEvents
              .VoiceStateUpdate,

            GatewayDispatchEvents
              .VoiceServerUpdate

          ].includes(packet.t)
        ) {

          return;
        }

        if (
          client.riffy &&
          typeof client.riffy
            .updateVoiceState === "function"
        ) {

          client.riffy
            .updateVoiceState(packet);

        }

      }
    );

    client.riffy.on(
      "playerError",
      (player, error) => {

        console.error(
          `❌ Music player error [${player.guildId}]:`,
          error
        );

      }
    );

    client.riffy.on(
      "trackError",
      (player, track, error) => {

        console.error(
          `❌ Track error [${player.guildId}]:`,
          error
        );

      }
    );

    console.log(
      "🎵 Riffy Music system đã được khởi tạo."
    );

  } catch (error) {

    console.error(
      "❌ Không thể khởi tạo Riffy:"
    );

    console.error(error);

    client.riffy = null;

  }

}

initializeMusic();

const commands = [

  new SlashCommandBuilder()

    .setName("watch")

    .setDescription(
      "Tạo Live và phát danh sách video"
    )

    .addUserOption(option =>

      option

        .setName("chu_phong")

        .setDescription(
          "Chủ phòng"
        )

        .setRequired(true)

    )

    .addChannelOption(option =>

      option

        .setName("phong")

        .setDescription(
          "Phòng voice"
        )

        .setRequired(true)

        .addChannelTypes(
          ChannelType.GuildVoice
        )

    )

    .addStringOption(option =>

      option

        .setName("phim")

        .setDescription(
          "Tên phim và tối đa 3 link video, cách nhau bằng dấu cách"
        )

        .setRequired(true)

    )

    .toJSON(),

  new SlashCommandBuilder()

    .setName("join")

    .setDescription(
      "Cho bot tham gia phòng thoại của bạn"
    )

    .toJSON(),

  new SlashCommandBuilder()

    .setName("play")

    .setDescription(
      "Phát nhạc trong phòng thoại"
    )

    .addStringOption(option =>

      option

        .setName("query")

        .setDescription(
          "Tên bài hát hoặc link"
        )

        .setRequired(true)

    )

    .toJSON()

];

async function registerCommands() {

  try {

    console.log(
      "⏳ Đang đăng ký /watch, /join và /play..."
    );

    const rest =
      new REST({
        version: "10"
      }).setToken(
        process.env.DISCORD_TOKEN
      );

    await rest.put(

      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),

      {
        body: commands
      }

    );

    console.log(
      "✅ Đã đăng ký /watch, /join và /play!"
    );

  } catch (error) {

    console.error(
      "❌ Không đăng ký được command:"
    );

    console.error(error);

  }

}

client.once(
  Events.ClientReady,
  readyClient => {

    console.log(
      `✅ Bot đã đăng nhập: ${readyClient.user.tag}`
    );

    console.log(
      "🎬 [MEG]Ariz_CFM_BOT đang hoạt động!"
    );

    if (
      client.riffy &&
      typeof client.riffy.init === "function"
    ) {

      try {

        client.riffy.init(
          readyClient.user.id
        );

        console.log(
          "🎵 Riffy đã kết nối với Discord."
        );

      } catch (error) {

        console.error(
          "❌ Không thể init Riffy:"
        );

        console.error(error);

      }

    }

  }
);

client.on(
  Events.InteractionCreate,
  async interaction => {

    try {

      if (
        interaction.isButton()
      ) {

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
          "music_queue_last"

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

      }

      if (
        interaction.isChatInputCommand()
      ) {

        // ================================
        // /PLAY
        // ================================

        if (
          interaction.commandName === "play"
        ) {

          await interaction.deferReply();

          try {

            const query =
              interaction.options.getString(
                "query",
                true
              );

            const result =
              await playQuery({
                client,
                interaction,
                query
              );

            await interaction.editReply(
              result
            );

          } catch (error) {

            console.error(
              "❌ /play error:"
            );

            console.error(error);

            try {

              if (
                interaction.deferred ||
                interaction.replied
              ) {

                await interaction.editReply({

                  content:
                    `❌ Không thể phát nhạc.\n` +
                    `\`${error.message || "Lỗi không xác định"}\``

                });

              } else {

                await interaction.reply({

                  content:
                    `❌ Không thể phát nhạc.\n` +
                    `\`${error.message || "Lỗi không xác định"}\``,

                  ephemeral: true

                });

              }

            } catch (replyError) {

              console.error(
                "❌ Không thể gửi lỗi /play:"
              );

              console.error(
                replyError
              );

            }

          }

          return;

        }

        // ================================
        // /WATCH
        // ================================

        if (
          interaction.commandName === "watch"
        ) {

          const owner =
            interaction.options.getUser(
              "chu_phong"
            );

          const voiceChannel =
            interaction.options.getChannel(
              "phong"
            );

          const input =
            interaction.options.getString(
              "phim"
            );

          if (!input) {

            await interaction.reply({

              content:
                "❌ Bạn chưa nhập tên phim hoặc link video.",

              ephemeral: true

            });

            return;

          }

          const parts =
            input.trim().split(/\s+/);

          const links = [];
          const names = [];

          for (
            const part of parts
          ) {

            if (
              part.startsWith(
                "http://"
              ) ||
              part.startsWith(
                "https://"
              )
            ) {

              links.push(part);

            } else {

              names.push(part);

            }

          }

          if (
            links.length === 0
          ) {

            await interaction.reply({

              content:
                "❌ Bạn chưa cung cấp link video hợp lệ.",

              ephemeral: true

            });

            return;

          }

          if (
            links.length > MAX_VIDEOS
          ) {

            await interaction.reply({

              content:
                `❌ Chỉ được tối đa **${MAX_VIDEOS} video** cho mỗi Live.`,

              ephemeral: true

            });

            return;

          }

          const videoName =
            names.length > 0
              ? names.join(" ")
              : "Video";

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

                `▶️ **Đang phát:** ` +
                `Video ${currentVideo.id}\n\n` +

                `🔗 **Link:** ` +
                `${currentVideo.link}\n\n` +

                `📋 **Tổng số video:** ` +
                `${links.length}`

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

          await interaction.reply({

            embeds: [
              embed
            ],

            components: [
              row
            ]

          });

          console.log(
            `🎬 ${interaction.user.tag} ` +
            `tạo Live "${videoName}" ` +
            `với ${links.length} video.`
          );

          return;

        }

        // ================================
        // /JOIN
        // ================================

        if (
          interaction.commandName === "join"
        ) {

          const member =
            interaction.member;

          if (
            !member ||
            !member.voice ||
            !member.voice.channel
          ) {

            await interaction.reply({

              content:
                "❌ Bạn phải vào một phòng thoại trước!",

              ephemeral: true

            });

            return;

          }

          const voiceChannel =
            member.voice.channel;

          const permissions =
            voiceChannel.permissionsFor(
              interaction.client.user
            );

          if (
            !permissions ||
            !permissions.has("Connect")
          ) {

            await interaction.reply({

              content:
                "❌ Bot không có quyền **Connect** vào phòng thoại này.",

              ephemeral: true

            });

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

            await interaction.reply({

              content:
                `🔊 **[MEG]Ariz_CFM_BOT đã tham gia phòng thoại!**\n\n` +
                `📢 **Phòng:** ${voiceChannel}\n` +
                `👤 **Người gọi:** ${interaction.user}\n\n` +
                `🎬 Bot đã sẵn sàng cho Cinema Room.`

            });

            console.log(
              `🔊 Bot đã join: ${voiceChannel.name}`
            );

          } catch (error) {

            console.error(
              "❌ Không thể join voice:"
            );

            console.error(error);

            await interaction.reply({

              content:
                "❌ Bot không thể tham gia phòng thoại.",

              ephemeral: true

            });

          }

          return;

        }

      }

      // ================================
      // LIVE BUTTONS
      // ================================

      if (
        interaction.isButton()
      ) {

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

                `▶️ **Video hiện tại:** ` +
                `${current.id}\n\n` +

                `🔗 **Link:** ${current.link}`

              )

              .setTimestamp();

          await interaction.reply({

            embeds: [
              infoEmbed
            ],

            ephemeral: true

          });

          return;

        }

      }

    } catch (error) {

      console.error(
        "❌ Interaction error:"
      );

      console.error(error);

      try {

        if (
          !interaction.replied &&
          !interaction.deferred
        ) {

          await interaction.reply({

            content:
              "❌ Có lỗi khi xử lý lệnh.",

            ephemeral: true

          });

        }

      } catch {}

    }

  }
);

async function startBot() {

  await registerCommands();

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
