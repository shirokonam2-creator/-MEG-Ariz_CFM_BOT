const {
  pausePlayback,
  resumePlayback,
  stopPlayback,
  skipTrack,
  shuffleMusicQueue,
  changeVolumeBy,
  leaveVoiceChannel
} = require("./musicActions");

async function handleMusicButton(
  interaction
) {
  const id = interaction.customId;
  const guildId =
    interaction.guildId;

  if (!guildId) {
    return;
  }

  try {
    switch (id) {

      case "music_pause": {
        const result =
          pausePlayback(guildId);

        await interaction.reply({
          content: result
            ? "⏸️ Đã tạm dừng nhạc."
            : "❌ Không có bài đang phát.",
          ephemeral: true
        });

        break;
      }

      case "music_resume": {
        const result =
          resumePlayback(guildId);

        await interaction.reply({
          content: result
            ? "▶️ Đã tiếp tục phát nhạc."
            : "❌ Không có bài đang tạm dừng.",
          ephemeral: true
        });

        break;
      }

      case "music_skip": {
        const track =
          await skipTrack(interaction);

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
        shuffleMusicQueue(guildId);

        await interaction.reply({
          content:
            "🔀 Đã xáo trộn hàng đợi.",
          ephemeral: true
        });

        break;
      }

      case "music_vol_down": {
        const volume =
          changeVolumeBy(
            guildId,
            -10
          );

        await interaction.reply({
          content: volume === false
            ? "❌ Không có bài đang phát."
            : `🔉 Âm lượng: **${Math.round(volume)}%**`,
          ephemeral: true
        });

        break;
      }

      case "music_vol_up": {
        const volume =
          changeVolumeBy(
            guildId,
            10
          );

        await interaction.reply({
          content: volume === false
            ? "❌ Không có bài đang phát."
            : `🔊 Âm lượng: **${Math.round(volume)}%**`,
          ephemeral: true
        });

        break;
      }

      case "music_queue": {
        const {
          getMusicQueue
        } = require("./musicActions");

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

        const text =
          queue
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
        leaveVoiceChannel(guildId);

        await interaction.reply({
          content:
            "👋 Bot đã rời phòng thoại.",
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

    if (interaction.replied ||
        interaction.deferred) {

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
