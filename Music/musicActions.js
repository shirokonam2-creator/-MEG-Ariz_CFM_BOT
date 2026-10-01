const fs = require("fs");
const path = require("path");

console.log("📁 Music:", fs.readdirSync(__dirname));

console.log(
  "📁 sources:",
  fs.existsSync(path.join(__dirname, "sources"))
    ? fs.readdirSync(path.join(__dirname, "sources"))
    : "KHÔNG CÓ THƯ MỤC SOURCES"
);

const {
  searchYouTube,
  resolveYouTube,
  isYouTubeUrl
} = require("./youtube");

const {
  playYouTube,
  pause,
  resume,
  stop,
  setVolume,
  getPlayerState
} = require("./musicPlayer");

const {
  addToQueue,
  getQueue,
  getNextTrack,
  clearQueue,
  removeFromQueue,
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

  // Nếu nhập URL YouTube
  if (isYouTubeUrl(text)) {
    const track = await resolveYouTube(text);

    if (!track) {
      throw new Error("Không thể lấy bài hát từ URL YouTube.");
    }

    return track;
  }

  // Nếu nhập tên bài hát
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
  const guildId = message.guild.id;

  // Tìm bài hát
  const track = await findTrack(query);

  // Dữ liệu Music
  const musicData = getGuildMusicData(guildId);

  // Dữ liệu player thực tế
  const playerData = getPlayerState(guildId);

  /*
   * ĐANG PHÁT
   *
   * Không ngắt bài hiện tại.
   * Bài mới được thêm vào queue.
   */

  if (
    playerData &&
    playerData.currentTrack &&
    playerData.playing
  ) {
    const queue = addToQueue(
      guildId,
      track
    );

    return {
      type: "queue",
      track,
      position: queue.length
    };
  }


  /*
   * CHƯA CÓ BÀI
   *
   * Phát ngay lập tức.
   */

  await playYouTube(
    message.guild,
    voiceChannel,
    track.url,
    track
  );

  musicData.currentTrack = track;
  musicData.isPlaying = true;
  musicData.isPaused = false;

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

  /*
   * Không còn bài trong queue
   */

  if (!nextTrack) {
    const musicData = getGuildMusicData(guild.id);

    musicData.currentTrack = null;
    musicData.isPlaying = false;
    musicData.isPaused = false;

    return null;
  }


  /*
   * Phát bài tiếp theo
   */

  await playYouTube(
    guild,
    voiceChannel,
    nextTrack.url,
    nextTrack
  );

  const musicData = getGuildMusicData(guild.id);

  musicData.currentTrack = nextTrack;
  musicData.isPlaying = true;
  musicData.isPaused = false;

  return nextTrack;
}


/* =========================================================
   PAUSE
========================================================= */

function pausePlayback(guildId) {
  const result = pause(guildId);

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
  const result = resume(guildId);

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
  stop(guildId);

  // Xóa toàn bộ queue
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
  /*
   * Lấy bài tiếp theo TRƯỚC khi stop
   * để tránh Idle event tự xử lý queue hai lần.
   */

  const nextTrack = getNextTrack(guild.id);

  if (!nextTrack) {
    stop(guild.id);

    const musicData = getGuildMusicData(guild.id);

    musicData.currentTrack = null;
    musicData.isPlaying = false;
    musicData.isPaused = false;

    return null;
  }

  /*
   * Dừng bài hiện tại
   */

  stop(guild.id);

  /*
   * Phát bài tiếp theo
   */

  await playYouTube(
    guild,
    voiceChannel,
    nextTrack.url,
    nextTrack
  );

  const musicData = getGuildMusicData(guild.id);

  musicData.currentTrack = nextTrack;
  musicData.isPlaying = true;
  musicData.isPaused = false;

  return nextTrack;
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

function removeFromMusicQueue(guildId, index) {
  return removeFromQueue(
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
  let value = Number(volume);

  if (!Number.isFinite(value)) {
    throw new Error("Âm lượng không hợp lệ.");
  }

  value = Math.max(
    0,
    Math.min(100, value)
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
   GET PLAYER STATE
========================================================= */

function getMusicPlayerState(guildId) {
  return getPlayerState(guildId);
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
  removeFromMusicQueue,
  clearMusicQueue,

  changeVolume,

  getMusicPlayerState
};
