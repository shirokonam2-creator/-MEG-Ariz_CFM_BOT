const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

function buildNowPlayingEmbed(track, playerState = {}) {
  const title =
    track?.songName ||
    track?.title ||
    "Không rõ tên bài";

  const url =
    track?.url || null;

  const embed =
    new EmbedBuilder()
      .setTitle("🎵 Đang phát nhạc")
      .setDescription(
        url
          ? `**[${title}](${url})**`
          : `**${title}**`
      )
      .addFields({
        name: "Trạng thái",
        value: playerState.paused
          ? "⏸️ Đang tạm dừng"
          : "▶️ Đang phát",
        inline: true
      })
      .setFooter({
        text: "Arizu Music"
      });

  return embed;
}

function buildQueueEmbed(queue = []) {
  if (!queue.length) {
    return new EmbedBuilder()
      .setTitle("🎵 Danh sách chờ")
      .setDescription(
        "📭 Không có bài nào đang chờ."
      );
  }

  const description =
    queue
      .map(
        (track, index) =>
          `**${index + 1}.** ${track.songName || "Không rõ tên"}`
      )
      .join("\n");

  return new EmbedBuilder()
    .setTitle("🎵 Danh sách chờ")
    .setDescription(description)
    .setFooter({
      text: `${queue.length} bài đang chờ`
    });
}

function buildPlayerButtonRows() {
  const row1 =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("music_pause")
        .setLabel("Pause")
        .setEmoji("⏸️")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_resume")
        .setLabel("Resume")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId("music_skip")
        .setLabel("Skip")
        .setEmoji("⏭️")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("music_stop")
        .setLabel("Stop")
        .setEmoji("⏹️")
        .setStyle(ButtonStyle.Danger),

      new ButtonBuilder()
        .setCustomId("music_shuffle")
        .setLabel("Shuffle")
        .setEmoji("🔀")
        .setStyle(ButtonStyle.Secondary)
    );

  const row2 =
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("music_vol_down")
        .setLabel("Vol -")
        .setEmoji("🔉")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_vol_up")
        .setLabel("Vol +")
        .setEmoji("🔊")
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId("music_queue")
        .setLabel("Queue")
        .setEmoji("📜")
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId("music_leave")
        .setLabel("Leave")
        .setEmoji("👋")
        .setStyle(ButtonStyle.Danger)
    );

  return [
    row1,
    row2
  ];
}

module.exports = {
  buildNowPlayingEmbed,
  buildQueueEmbed,
  buildPlayerButtonRows
};
