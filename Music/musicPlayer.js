const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const play = require("play-dl");

const players = new Map();

/**
 * Lấy player của một guild
 */
function getPlayer(guildId) {
  return players.get(guildId) || null;
}

/**
 * Tạo audio player cho guild
 */
function createPlayer(guildId) {
  let data = players.get(guildId);

  if (data) {
    return data;
  }

  const audioPlayer = createAudioPlayer({
    behaviors: {
      noSubscriber: NoSubscriberBehavior.Play
    }
  });

  data = {
    audioPlayer,
    connection: null,
    resource: null,
    currentUrl: null,
    currentTitle: null,
    currentTrack: null,
    playing: false,
    paused: false
  };

  audioPlayer.on(
    AudioPlayerStatus.Playing,
    () => {
      data.playing = true;
      data.paused = false;
    }
  );

  audioPlayer.on(
    AudioPlayerStatus.Paused,
    () => {
      data.playing = false;
      data.paused = true;
    }
  );

  audioPlayer.on(
    AudioPlayerStatus.AutoPaused,
    () => {
      data.playing = false;
    }
  );

  audioPlayer.on(
    AudioPlayerStatus.Idle,
    () => {
      data.playing = false;
      data.paused = false;
      data.resource = null;
    }
  );

  audioPlayer.on(
    "error",
    error => {
      console.error(
        `❌ Music player error [${guildId}]:`,
        error
      );

      data.playing = false;
      data.paused = false;
      data.resource = null;
    }
  );

  players.set(guildId, data);

  return data;
}

/**
 * Bot tham gia voice channel
 */
function connectToVoice(guild, voiceChannel) {
  if (!guild) {
    throw new Error("Không tìm thấy server.");
  }

  if (!voiceChannel) {
    throw new Error("Không tìm thấy phòng thoại.");
  }

  const playerData = createPlayer(guild.id);

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false
  });

  connection.subscribe(playerData.audioPlayer);

  playerData.connection = connection;

  return playerData;
}

/**
 * Phát YouTube URL
 */
async function playYouTube(
  guild,
  voiceChannel,
  url,
  track = null
) {
  if (!guild) {
    throw new Error("Không tìm thấy server.");
  }

  if (!voiceChannel) {
    throw new Error(
      "Bạn phải ở trong phòng thoại."
    );
  }

  if (!url) {
    throw new Error(
      "Không có URL YouTube."
    );
  }

  const playerData =
    connectToVoice(
      guild,
      voiceChannel
    );

  console.log(
    `🎵 Đang lấy audio YouTube: ${url}`
  );

  const stream =
    await play.stream(url, {
      quality: 2,
      discordPlayerCompatibility: true
    });

  const resource =
    createAudioResource(
      stream.stream,
      {
        inputType: stream.type,
        inlineVolume: true
      }
    );

  if (resource.volume) {
    resource.volume.setVolume(
      0.75
    );
  }

  playerData.resource = resource;
  playerData.currentUrl = url;

  playerData.currentTitle =
    track?.songName ||
    track?.title ||
    "YouTube";

  playerData.currentTrack =
    track || {
      songName:
        playerData.currentTitle,
      url
    };

  playerData.audioPlayer.play(
    resource
  );

  console.log(
    `▶️ Đang phát: ${playerData.currentTitle}`
  );

  return playerData;
}

/**
 * Tạm dừng
 */
function pause(guildId) {
  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }

  return data.audioPlayer.pause();
}

/**
 * Tiếp tục phát
 */
function resume(guildId) {
  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }

  return data.audioPlayer.unpause();
}

/**
 * Dừng nhạc
 */
function stop(guildId) {
  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }

  data.audioPlayer.stop();

  data.playing = false;
  data.paused = false;
  data.resource = null;

  return true;
}

/**
 * Rời phòng thoại
 */
function disconnect(guildId) {
  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }

  try {
    data.audioPlayer.stop();
  } catch {}

  try {
    data.connection?.destroy();
  } catch {}

  players.delete(guildId);

  return true;
}

/**
 * Đặt âm lượng
 */
function setVolume(guildId, volume) {
  const data =
    players.get(guildId);

  if (!data || !data.resource) {
    return false;
  }

  const value =
    Math.max(
      0,
      Math.min(100, Number(volume))
    );

  if (data.resource.volume) {
    data.resource.volume.setVolume(
      value / 100
    );
  }

  return value;
}

/**
 * Tăng / giảm âm lượng
 */
function adjustVolume(
  guildId,
  amount
) {
  const data =
    players.get(guildId);

  if (!data || !data.resource) {
    return false;
  }

  let current = 75;

  if (data.resource.volume) {
    current =
      data.resource.volume.volume *
      100;
  }

  return setVolume(
    guildId,
    current + amount
  );
}

/**
 * Lấy trạng thái phát nhạc
 */
function getPlayerState(guildId) {
  const data =
    players.get(guildId);

  if (!data) {
    return null;
  }

  return {
    playing: data.playing,
    paused: data.paused,
    currentUrl: data.currentUrl,
    currentTitle: data.currentTitle,
    currentTrack: data.currentTrack,
    connection: data.connection
  };
}

module.exports = {
  getPlayer,
  createPlayer,
  connectToVoice,
  playYouTube,
  pause,
  resume,
  stop,
  disconnect,
  setVolume,
  adjustVolume,
  getPlayerState
};
