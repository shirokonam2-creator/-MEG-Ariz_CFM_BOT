const {
  PermissionFlagsBits
} = require("discord.js");

const {
  searchYouTubeSong,
  getSongByUrl,
  isYouTubeUrl
} = require("./musicSource");

const {
  playYouTube,
  pause,
  resume,
  stop,
  disconnect,
  setVolume,
  adjustVolume,
  getPlayerState
} = require("./musicPlayer");

const {
  addToQueue,
  getNextTrack,
  getQueueTracks,
  clearQueue,
  removeFromQueue,
  shuffleQueue,
  getQueueSize
} = require("./musicQueue");

/**
 * Kiểm tra người dùng đang ở voice channel
 */
function getUserVoiceChannel(interaction) {
  const channel =
    interaction.member?.voice?.channel;

  if (!channel) {
    throw new Error(
      "Bạn phải vào một phòng thoại trước."
    );
  }

  return channel;
}

/**
 * Tìm bài hát trong nguồn
 */
function findSong(query) {
  if (!query || !query.trim()) {
    return null;
  }

  const text = query.trim();

  // Nếu nhập URL YouTube
  if (isYouTubeUrl(text)) {
    return (
      getSongByUrl(text) || {
        songName: text,
        url: text
      }
    );
  }

  // Tìm bằng songName
  return searchYouTubeSong(text);
}

/**
 * /play
 */
async function playQuery(
  client,
  interaction,
  query
) {
  const guild =
    interaction.guild;

  if (!guild) {
    throw new Error(
      "Lệnh này chỉ sử dụng được trong server."
    );
  }

  const voiceChannel =
    getUserVoiceChannel(interaction);

  if (!query || !query.trim()) {
    throw new Error(
      "Vui lòng nhập tên bài hát."
    );
  }

  const track =
    findSong(query);

  if (!track) {
    throw new Error(
      `Không tìm thấy bài **${query}** trong youtube.json.`
    );
  }

  const playerState =
    getPlayerState(guild.id);

  const isPlaying =
    playerState?.playing ||
    playerState?.paused;

  /*
   * Nếu đang có bài phát:
   * → thêm bài mới vào queue
   */
  if (isPlaying) {
    addToQueue(
      guild.id,
      track
    );

    return {
      type: "queue",
      track,
      position:
        getQueueSize(guild.id)
    };
  }

  /*
   * Nếu chưa phát:
   * → phát ngay
   */
  await playYouTube(
    guild,
    voiceChannel,
    track.url,
    track
  );

  return {
    type: "playing",
    track
  };
}

/**
 * Phát bài tiếp theo trong queue
 */
async function playNext(
  guild,
  voiceChannel
) {
  const nextTrack =
    getNextTrack(guild.id);

  if (!nextTrack) {
    return null;
  }

  await playYouTube(
    guild,
    voiceChannel,
    nextTrack.url,
    nextTrack
  );

  return nextTrack;
}

/**
 * Pause
 */
function pausePlayback(
  guildId
) {
  return pause(guildId);
}

/**
 * Resume
 */
function resumePlayback(
  guildId
) {
  return resume(guildId);
}

/**
 * Stop
 */
function stopPlayback(
  guildId
) {
  clearQueue(guildId);

  return stop(guildId);
}

/**
 * Rời voice
 */
function leaveVoiceChannel(
  guildId
) {
  clearQueue(guildId);

  return disconnect(guildId);
}

/**
 * Skip bài hiện tại
 */
async function skipTrack(
  interaction
) {
  const guild =
    interaction.guild;

  if (!guild) {
    return null;
  }

  stop(guild.id);

  const voiceChannel =
    interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return null;
  }

  return playNext(
    guild,
    voiceChannel
  );
}

/**
 * Shuffle queue
 */
function shuffleMusicQueue(
  guildId
) {
  return shuffleQueue(
    guildId
  );
}

/**
 * Đặt volume
 */
function changeVolume(
  guildId,
  volume
) {
  return setVolume(
    guildId,
    volume
  );
}

/**
 * Tăng / giảm volume
 */
function changeVolumeBy(
  guildId,
  amount
) {
  return adjustVolume(
    guildId,
    amount
  );
}

/**
 * Lấy queue
 */
function getMusicQueue(
  guildId
) {
  return getQueueTracks(
    guildId
  );
}

/**
 * Xóa bài trong queue
 */
function removeMusicQueue(
  guildId,
  index
) {
  return removeFromQueue(
    guildId,
    index
  );
}

/**
 * Xóa toàn bộ queue
 */
function clearMusicQueue(
  guildId
) {
  return clearQueue(
    guildId
  );
}

module.exports = {
  getUserVoiceChannel,
  findSong,

  playQuery,
  playNext,

  pausePlayback,
  resumePlayback,
  stopPlayback,
  leaveVoiceChannel,

  skipTrack,

  shuffleMusicQueue,

  changeVolume,
  changeVolumeBy,

  getMusicQueue,
  removeMusicQueue,
  clearMusicQueue
};
