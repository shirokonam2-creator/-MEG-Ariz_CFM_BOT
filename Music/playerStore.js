const guildMusic = new Map();

function getGuildMusicData(guildId) {
  if (!guildMusic.has(guildId)) {
    guildMusic.set(guildId, {
      currentTrack: null,
      isPlaying: false,
      isPaused: false,
      volume: 75
    });
  }

  return guildMusic.get(guildId);
}

function clearGuildMusicData(guildId) {
  guildMusic.delete(guildId);
}

function hasGuildMusicData(guildId) {
  return guildMusic.has(guildId);
}

module.exports = {
  getGuildMusicData,
  clearGuildMusicData,
  hasGuildMusicData
};
