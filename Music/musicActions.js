async function playQuery({ client, interaction, query }) {
  if (!query || !query.trim()) {
    return {
      content: "❌ Bạn chưa nhập tên bài hát."
    };
  }

  const guildId = interaction.guildId;

  if (!guildId) {
    return {
      content: "❌ Lệnh này chỉ dùng được trong server."
    };
  }

  // Người dùng phải ở trong voice channel
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return {
      content: "❌ Bạn phải vào voice channel trước."
    };
  }

  // Kiểm tra Riffy
  assertRiffyAvailable(client);

  // Kiểm tra Lavalink
  assertLavalinkNodeAvailable(client);

  // Lấy hoặc tạo player
  const player = await ensurePlayer({
    client,
    interaction,
    voiceChannel
  });

  // Tìm bài
  const result = await client.riffy.resolve({
    query: query.trim(),
    requester: interaction.user
  });

  if (!result) {
    return {
      content: "❌ Không nhận được kết quả từ Lavalink."
    };
  }

  const { loadType, tracks, playlistInfo } = result;

  // Không có kết quả
  if (
    loadType === "empty" ||
    loadType === "error" ||
    !tracks ||
    tracks.length === 0
  ) {
    return {
      content: "❌ Không tìm thấy bài hát."
    };
  }

  /*
   * ==============================
   * PLAYLIST
   * ==============================
   */
  if (loadType === "playlist") {
    for (const track of tracks) {
      track.info.requester = interaction.user;
      player.queue.add(track);
    }

    const wasPlaying = player.playing || player.paused;

    // Chỉ bắt đầu phát nếu chưa có bài nào đang phát
    if (!wasPlaying) {
      await player.play();

      return {
        content:
          `🎵 Bắt đầu phát playlist **${playlistInfo?.name || "Playlist"}** ` +
          `(${tracks.length} bài).`
      };
    }

    return {
      content:
        `📋 Đã thêm playlist **${playlistInfo?.name || "Playlist"}** ` +
        `(${tracks.length} bài) vào danh sách đợi.`
    };
  }

  /*
   * ==============================
   * SINGLE TRACK / SEARCH
   * ==============================
   */

  if (loadType === "track" || loadType === "search") {
    const track = tracks[0];

    if (!track) {
      return {
        content: "❌ Không tìm thấy bài hát."
      };
    }

    track.info.requester = interaction.user;

    // Kiểm tra trước khi thêm để biết
    // bài này sẽ phát ngay hay vào queue
    const wasPlaying = player.playing || player.paused;

    // Thêm bài vào cuối queue
    player.queue.add(track);

    /*
     * CHƯA CÓ BÀI ĐANG PHÁT
     * → phát ngay
     */
    if (!wasPlaying) {
      await player.play();

      return {
        content:
          `🎵 Đang phát **${track.info.title}**`
      };
    }

    /*
     * ĐANG CÓ BÀI
     * → giữ nguyên bài hiện tại
     * → thêm bài mới vào queue
     */
    return {
      content:
        `🎵 Đã thêm **${track.info.title}** vào danh sách đợi.`
    };
  }

  /*
   * ==============================
   * LOAD TYPE KHÔNG HỖ TRỢ
   * ==============================
   */

  return {
    content:
      `❌ Không thể phát kết quả này.\n` +
      `Loại kết quả: \`${loadType || "unknown"}\``
  };
module.exports = {
  MusicError,
  getConnectedLavalinkNodes,
  assertRiffyAvailable,
  assertLavalinkNodeAvailable,
  hasVoicePermissions,
  getPlayer,
  ensurePlayer,
  joinVoiceChannel,
  playQuery,
  skipTrack,
  applyPause,
  applyResume,
  pausePlayback,
  resumePlayback,
  shuffleQueue,
  setLoopMode,
  toggleLoop,
  setVolume,
  adjustVolume,
  stopPlayback,
  leaveVoiceChannel,
  buildQueueReply,
  buildNowPlayingReply,
  startPlayback
};
