const players = new Map();

/**
 * Lấy dữ liệu player của server
 */
function getPlayerData(guildId) {
  if (!players.has(guildId)) {
    players.set(guildId, {
      messageId: null,
      channelId: null,
      currentTrack: null,
      volume: 75,
      loop: "none",
      shuffle: false
    });
  }

  return players.get(guildId);
}

/**
 * Cập nhật dữ liệu player
 */
function updatePlayerData(
  guildId,
  data
) {
  const current =
    getPlayerData(guildId);

  Object.assign(
    current,
    data
  );

  return current;
}

/**
 * Đặt bài hiện tại
 */
function setCurrentTrack(
  guildId,
  track
) {
  return updatePlayerData(
    guildId,
    {
      currentTrack: track
    }
  );
}

/**
 * Lấy bài hiện tại
 */
function getCurrentTrack(
  guildId
) {
  return getPlayerData(
    guildId
  ).currentTrack;
}

/**
 * Đặt message Now Playing
 */
function setPlayerMessage(
  guildId,
  channelId,
  messageId
) {
  return updatePlayerData(
    guildId,
    {
      channelId,
      messageId
    }
  );
}

/**
 * Lấy message Now Playing
 */
function getPlayerMessage(
  guildId
) {
  const data =
    getPlayerData(guildId);

  return {
    channelId:
      data.channelId,
    messageId:
      data.messageId
  };
}

/**
 * Đặt âm lượng
 */
function setStoredVolume(
  guildId,
  volume
) {
  const value =
    Math.max(
      0,
      Math.min(
        100,
        Number(volume)
      )
    );

  return updatePlayerData(
    guildId,
    {
      volume: value
    }
  );
}

/**
 * Lấy âm lượng
 */
function getStoredVolume(
  guildId
) {
  return getPlayerData(
    guildId
  ).volume;
}

/**
 * Đặt chế độ loop
 *
 * none
 * track
 * queue
 */
function setLoopMode(
  guildId,
  mode
) {
  const allowed = [
    "none",
    "track",
    "queue"
  ];

  if (!allowed.includes(mode)) {
    mode = "none";
  }

  return updatePlayerData(
    guildId,
    {
      loop: mode
    }
  );
}

/**
 * Lấy chế độ loop
 */
function getLoopMode(
  guildId
) {
  return getPlayerData(
    guildId
  ).loop;
}

/**
 * Bật/tắt shuffle
 */
function setShuffle(
  guildId,
  enabled
) {
  return updatePlayerData(
    guildId,
    {
      shuffle: Boolean(enabled)
    }
  );
}

/**
 * Lấy trạng thái shuffle
 */
function getShuffle(
  guildId
) {
  return getPlayerData(
    guildId
  ).shuffle;
}

/**
 * Xóa dữ liệu server
 */
function clearPlayerData(
  guildId
) {
  players.delete(guildId);
}

/**
 * Lấy toàn bộ dữ liệu player
 */
function getAllPlayerData() {
  return players;
}

module.exports = {
  getPlayerData,
  updatePlayerData,

  setCurrentTrack,
  getCurrentTrack,

  setPlayerMessage,
  getPlayerMessage,

  setStoredVolume,
  getStoredVolume,

  setLoopMode,
  getLoopMode,

  setShuffle,
  getShuffle,

  clearPlayerData,
  getAllPlayerData
};
