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

// ========================================
// WATCH ROOM
// ========================================

const {
  createWatchRoom,
  getWatchRoom
} = require("./watchRoom");

// ========================================
// LIVE SYSTEM
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

// ========================================
// MUSIC
// ========================================

const {
  handleMusicButton
} = require("./Music/musicButtons");

// ========================================
// MUSIC CONFIG
// ========================================

const LAVALINK_HOST =
  process.env.LAVALINK_HOST || "localhost";

const LAVALINK_PORT =
  Number(
    process.env.LAVALINK_PORT || 2333
  );

const LAVALINK_PASSWORD =
  process.env.LAVALINK_PASSWORD ||
  "youshallnotpass";

const LAVALINK_SECURE =
  String(
    process.env.LAVALINK_SECURE || "false"
  ).toLowerCase() === "true";

const LAVALINK_NAME =
  process.env.LAVALINK_NAME ||
  "Main";

const LAVALINK_SEARCH_PLATFORM =
  process.env.LAVALINK_SEARCH_PLATFORM ||
  "ytmsearch";

// ========================================
// GIỚI HẠN /watch
// ========================================

const MAX_VIDEOS = 3;

// ========================================
// KIỂM TRA ENV
// ========================================

if (!process.env.DISCORD_TOKEN) {
  console.error(
    "❌ Thiếu DISCORD_TOKEN!"
  );

  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error(
    "❌ Thiếu CLIENT_ID!"
  );

  process.exit(1);
}

if (!process.env.GUILD_ID) {
  console.error(
    "❌ Thiếu GUILD_ID!"
  );

  process.exit(1);
}

// ========================================
// RENDER HTTP SERVER
// ========================================

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

// ========================================
// DISCORD CLIENT
// ========================================

const client =
  new Client({

    intents: [

      GatewayIntentBits.Guilds,

      GatewayIntentBits.GuildVoiceStates

    ]
  });

// ========================================
// KHỞI TẠO RIFFY / LAVALINK
// ========================================

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
              guild?.shard
            ) {

              guild.shard.send(
                payload
              );

              return;
            }

            const shardCount =
              client.ws.shards.size ||
              1;

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

    // ====================================
    // VOICE STATE
    // ====================================

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
          client.riffy
            ?.updateVoiceState
        ) {

          client.riffy
            .updateVoiceState(
              packet
            );
        }
      }
    );

    // ====================================
    // PLAYER ERROR
    // ====================================

    client.riffy.on(
      "playerError",
      (player, error) => {

        console.error(
          `❌ Music player error [${player.guildId}]:`,
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

// ========================================
// KHỞI TẠO MUSIC
// ========================================

initializeMusic();

// ========================================
// SLASH COMMANDS
// ========================================

const commands = [

  // ======================================
  // /watch
  // ======================================

  new SlashCommandBuilder()

    .setName("watch")

    .setDescription(
      "Tạo phòng xem video"
    )

    .addUserOption(option =>

      option
        .setName("chu_phong")
        .setDescription(
          "Chủ phòng xem"
        )
        .setRequired(true)

    )

    .addChannelOption(option =>

      option
        .setName("phong_call")
        .setDescription(
          "Phòng voice dùng để xem"
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
          "Tên phim + tối đa 3 link video"
        )
        .setRequired(true)

    )

    .to
