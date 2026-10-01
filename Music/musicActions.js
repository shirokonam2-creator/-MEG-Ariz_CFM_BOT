const {
  searchYouTube,
  resolveYouTube,
  isYouTubeUrl
} = require("./sources/youtube");

const {
  playYouTube,
  pausePlayer,
  resumePlayer,
  stopPlayer,
  getPlayerData,
  setVolume
} = require("./musicPlayer");

const {
  addTrack,
  getQueue,
  getNextTrack,
  clearQueue,
  removeTrack,
  shuffleQueue
} = require("./musicQueue");

const {
  getGuildMusicData
} = require("./playerStore");


/* =========================================================
   TÌM BÀI TRÊN YOUTUBE
========================================================= */

async function findTrack(query) {
  const text = String(query || "").trim();

  if (!text) {
    throw new Error("Bạn chưa nhập tên bài hát.");
  }

  // Nếu là URL YouTube
  if (isYouTubeUrl(text)) {
    return await resolveYouTube(text);
  }

  // Nếu là tên bài hát
  const track = await searchYouTube(text);

  if (!track) {
    throw new Error(`Không tìm thấy bài hát: ${text}`);
  }

  return track;
}


/* =========================================================
   PLAY
========================================================= */

async function playQuery(client, message, query) {
  if (!message?.guild) {
    throw new Error("Lệnh này chỉ dùng được trong server.");
  }

  if (!message.member?.voice?.channel) {
    throw new Error("Bạn phải vào voice channel trước.");
  }

  const voiceChannel = message.member.voice.channel;

  // Tìm bài
  const track = await findTrack(query);

  // Lấy dữ liệu player
  let musicData = getGuildMusicData(message.guild.id);

  /*
   * Nếu đang có bài hát:
   * -> Không ngắt bài hiện tại
   * -> Thêm bài mới vào queue
   */

  const playerData = getPlayerData(message.guild.id);

  if (
    playerData &&
    playerData.currentTrack &&
    playerData.isPlaying
  ) {
    const position = addTrack(
      message.guild.id,
      track
    );

    return {
      type: "queue",
      track,
      position
    };
  }

  /*
   * Không có bài đang phát
   * -> phát ngay
   */

  await playYouTube(
    message.guild,
    voiceChannel,
    track.url,
    track
  );

  musicData.currentTrack = track;
  musicData.isPlaying = true;

  return {
    type: "playing",
    track
  };
}


/* =========================================================
   PLAY NEXT
========================================================= */

async function playNext(client, guild, voiceChannel) {
  const nextTrack = getNextTrack(guild.id);

  if (!nextTrack) {
    const musicData = getGuildMusicData(guild.id);

    musicData.currentTrack = null;
    musicData.isPlaying = false;

    return null;
  }

  await playYouTube(
    guild,
    voiceChannel,
    nextTrack.url,
    nextTrack
  );

  const musicData = getGuildMusicData(guild.id);

  musicData.currentTrack = nextTrack;
  musicData.isPlaying = true;

  return nextTrack;
}


/* =========================================================
   PAUSE
========================================================= */

function pausePlayback(guildId) {
  const result = pausePlayer(guildId);

  if (!result) {
    throw new Error("Hiện không có bài hát đang phát.");
  }

  const musicData = getGuildMusicData(guildId);
  musicData.isPlaying = false;
  musicData.isPaused = true;

  return true;
}


/* =========================================================
   RESUME
========================================================= */

function resumePlayback(guildId) {
  const result = resumePlayer(guildId);

  if (!result) {
    throw new Error("Không có bài hát đang tạm dừng.");
  }

  const musicData = getGuildMusicData(guildId);
  musicData.isPlaying = true;
  musicData.isPaused = false;

  return true;
}


/* =========================================================
   STOP
========================================================= */

function stopPlayback(guildId) {
  stopPlayer(guildId);
  clearQueue(guildId);

  const musicData = getGuildMusicData(guildId);

  musicData.currentTrack = null;
  musicData.isPlaying = false;
  musicData.isPaused = false;

  return true;
}


/* =========================================================
   SKIP
========================================================= */

async function skipTrack(client, guild, voiceChannel) {
  stopPlayer(guild.id);

  return await playNext(
    client,
    guild,
    voiceChannel
  );
}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffleTracks(guildId) {
  shuffleQueue(guildId);

  return getQueue(guildId);
}


/* =========================================================
   QUEUE
========================================================= */

function getMusicQueue(guildId) {
  return getQueue(guildId);
}


/* =========================================================
   REMOVE
========================================================= */

function removeFromQueue(guildId, index) {
  return removeTrack(
    guildId,
    index
  );
}


/* =========================================================
   CLEAR QUEUE
========================================================= */

function clearMusicQueue(guildId) {
  clearQueue(guildId);

  return true;
}


/* =========================================================
   VOLUME
========================================================= */

function changeVolume(guildId, volume) {
  const value = Math.max(
    0,
    Math.min(100, Number(volume))
  );

  setVolume(
    guildId,
    value
  );

  const musicData = getGuildMusicData(guildId);

  musicData.volume = value;

  return value;
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  findTrack,
  playQuery,
  playNext,

  pausePlayback,
  resumePlayback,
  stopPlayback,
  skipTrack,

  shuffleTracks,

  getMusicQueue,
  removeFromQueue,
  clearMusicQueue,

  changeVolume
};
