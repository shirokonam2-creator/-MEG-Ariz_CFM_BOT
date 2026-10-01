const {
  pausePlayback,
  resumePlayback,
  stopPlayback,
  skipTrack,
  shuffleTracks,
  getMusicQueue,
  changeVolume,
  getMusicPlayerState
} = require("./musicActions");

const {
  disconnect
} = require("./musicPlayer");

async function handleMusicButton(interaction) {
  const id = interaction.customId;
  const guildId = interaction.guildId;

  if (!guildId) return;

  try {
    switch (id) {

      case "music_pause": {
        const result = pausePlayback(guildId);

        await interaction.reply({
          content: result
            ? "⏸️ Đã tạm dừng nhạc."
            : "❌ Không có bài đang phát.",
          ephemeral: true
        });

        break;
      }

      case "music_resume": {
        const result = resumePlayback(guildId);

        await interaction.reply({
          content: result
            ? "▶️ Đã tiếp tục phát nhạc."
            : "❌ Không có bài đang tạm dừng.",
          ephemeral: true
        });

        break;
      }

      case "music_skip": {
        if (!interaction.guild) {
          throw new Error("Không tìm thấy server.");
        }

        const voiceChannel =
          interaction.member?.voice?.channel;

        if (!voiceChannel) {
          await interaction.reply({
            content:
              "❌ Bạn phải ở trong voice channel.",
            ephemeral: true
          });

          break;
        }

        const track = await skipTrack(
          interaction.client,
          interaction.guild,
          voiceChannel
        );

        await interaction.reply({
          content: track
            ? `⏭️ Đã chuyển sang **${track.songName}**.`
            : "⏭️ Không còn bài nào trong hàng đợi.",
          ephemeral: true
        });

        break;
      }

      case "music_stop": {
        stopPlayback(guildId);

        await interaction.reply({
          content:
            "⏹️ Đã dừng nhạc và xóa hàng đợi.",
          ephemeral: true
        });

        break;
      }

      case "music_shuffle": {
        const queue = getMusicQueue(guildId);

        if (!queue.length) {
          await interaction.reply({
            content:
              "📭 Hàng đợi đang trống.",
            ephemeral: true
          });

          break;
        }

        shuffleTracks(guildId);

        await interaction.reply({
          content:
            "🔀 Đã xáo trộn hàng đợi.",
          ephemeral: true
        });

        break;
      }

      case "music_vol_down": {
        const state =
          getMusicPlayerState(guildId);

        if (!state || !state.currentTrack) {
          await interaction.reply({
            content:
              "❌ Không có bài đang phát.",
            ephemeral: true
          });

          break;
        }

        const currentVolume =
          state.volume ?? 75;

        const volume = changeVolume(
          guildId,
          currentVolume - 10
        );

        await interaction.reply({
          content:
            `🔉 Âm lượng: **${Math.round(volume)}%**`,
          ephemeral: true
        });

        break;
      }

      case "music_vol_up": {
        const state =
          getMusicPlayerState(guildId);

        if (!state || !state.currentTrack) {
          await interaction.reply({
            content:
              "❌ Không có bài đang phát.",
            ephemeral: true
          });

          break;
        }

        const currentVolume =
          state.volume ?? 75;

        const volume = changeVolume(
          guildId,
          currentVolume + 10
        );

        await interaction.reply({
          content:
            `🔊 Âm lượng: **${Math.round(volume)}%**`,
          ephemeral: true
        });

        break;
      }

      case "music_queue": {
        const queue =
          getMusicQueue(guildId);

        if (!queue.length) {
          await interaction.reply({
            content:
              "📭 Hàng đợi đang trống.",
            ephemeral: true
          });

          break;
        }

        const text = queue
          .map(
            (track, index) =>
              `${index + 1}. ${track.songName}`
          )
          .join("\n");

        await interaction.reply({
          content:
            `🎵 **Danh sách chờ:**\n${text}`,
          ephemeral: true
        });

        break;
      }

      case "music_stop_confirm": {
        stopPlayback(guildId);

        await interaction.update({
          content:
            "⏹️ Đã dừng nhạc và xóa hàng đợi.",
          components: []
        });

        break;
      }

      case "music_leave": {
        const result =
          disconnect(guildId);

        await interaction.reply({
          content: result
            ? "👋 Bot đã rời phòng thoại."
            : "❌ Bot hiện không ở trong phòng thoại.",
          ephemeral: true
        });

        break;
      }

      default:
        return;
    }

  } catch (error) {

    console.error(
      "❌ Music button error:",
      error
    );

    if (
      interaction.replied ||
      interaction.deferred
    ) {

      await interaction.followUp({
        content:
          `❌ ${error.message || "Có lỗi xảy ra."}`,
        ephemeral: true
      });

    } else {

      await interaction.reply({
        content:
          `❌ ${error.message || "Có lỗi xảy ra."}`,
        ephemeral: true
      });

    }
  }
}

module.exports = {
  handleMusicButton
};
