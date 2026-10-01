const {
  getYouTube
} = require("./youtubeAuth");

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType
} = require("@discordjs/voice");

const { Readable } = require("stream");
const { Innertube } = require("youtubei.js");

const players = new Map();

let youtubeClient = null;
let youtubeClientPromise = null;

async function getYouTubeClient() {
  if (youtubeClient) return youtubeClient;

  if (!youtubeClientPromise) {
    youtubeClientPromise = Innertube.create()
      .then(client => {
        youtubeClient = client;
        console.log("✅ YouTube audio client đã sẵn sàng.");
        return client;
      })
      .catch(error => {
        youtubeClientPromise = null;
        throw error;
      });
  }

  return youtubeClientPromise;
}

function getPlayer(guildId) {
  return players.get(guildId) || null;
}

function createPlayer(guildId) {
  let data = players.get(guildId);

  if (data) return data;

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
    paused: false,
    manualStop: false,
    voiceChannel: null,
    guild: null
  };

  audioPlayer.on(AudioPlayerStatus.Playing, () => {
    data.playing = true;
    data.paused = false;
  });

  audioPlayer.on(AudioPlayerStatus.Paused, () => {
    data.playing = false;
    data.paused = true;
  });

  audioPlayer.on(AudioPlayerStatus.AutoPaused, () => {
    data.playing = false;
  });

  audioPlayer.on(AudioPlayerStatus.Idle, async () => {
    if (data.manualStop) {
      data.manualStop = false;
      data.playing = false;
      data.paused = false;
      data.resource = null;
      return;
    }

    data.playing = false;
    data.paused = false;
    data.resource = null;

    console.log(`⏭️ Bài hát đã kết thúc [${guildId}]`);

    try {
      const { getNextTrack } = require("./musicQueue");

      const nextTrack = getNextTrack(guildId);

      if (!nextTrack) {
        console.log(`📭 Queue trống [${guildId}]`);

        data.currentTrack = null;
        data.currentUrl = null;
        data.currentTitle = null;

        return;
      }

      if (!data.voiceChannel) {
        console.error(
          `❌ Không tìm thấy voice channel [${guildId}]`
        );
        return;
      }

      console.log(
        `⏭️ Chuyển sang bài tiếp theo: ${nextTrack.songName}`
      );

      await playYouTube(
        data.guild,
        data.voiceChannel,
        nextTrack.url,
        nextTrack
      );

      // Đồng bộ trạng thái
      const musicStore = require("./playerStore");
      const musicData =
        musicStore.getGuildMusicData(guildId);

      musicData.currentTrack = nextTrack;
      musicData.isPlaying = true;
      musicData.isPaused = false;

    } catch (error) {
      console.error(
        `❌ Không thể phát bài tiếp theo [${guildId}]:`,
        error
      );
    }
  });

  audioPlayer.on("error", error => {
    console.error(
      `❌ Music player error [${guildId}]:`,
      error
    );

    data.playing = false;
    data.paused = false;
    data.resource = null;
  });

  players.set(guildId, data);

  return data;
}

function connectToVoice(guild, voiceChannel) {
  if (!guild) {
    throw new Error("Không tìm thấy server.");
  }

  if (!voiceChannel) {
    throw new Error("Không tìm thấy phòng thoại.");
  }

  const playerData = createPlayer(guild.id);

  playerData.guild = guild;
  playerData.voiceChannel = voiceChannel;

  if (
    playerData.connection &&
    playerData.connection.joinConfig?.channelId === voiceChannel.id
  ) {
    playerData.connection.subscribe(
      playerData.audioPlayer
    );

    return playerData;
  }

  try {
    playerData.connection?.destroy();
  } catch (_) {}

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
 * Lấy audio YouTube bằng youtubei.js
 * Không sử dụng play-dl nữa.
 */
async function getYouTubeAudio(videoId) {
  if (!videoId) {
    throw new Error("Không có YouTube video ID.");
  }

  console.log(
    `🎧 Đang lấy audio trực tiếp từ YouTube: ${videoId}`
  );

  const youtube = await getYouTubeClient();

  /*
   * YouTube.js hỗ trợ chọn audio format.
   * Ưu tiên Opus để Discord Voice có thể phát WebM/Opus
   * mà không cần chuyển đổi bằng FFmpeg.
   */
  const stream = await youtube.download(videoId, {
    type: "audio",
    quality: "best",
    codec: "opus",
    format: "webm"
  });

  if (!stream) {
    throw new Error(
      "YouTube không trả về audio stream."
    );
  }

  /*
   * youtubei.js trả về Web ReadableStream.
   * Node.js 24 có Readable.fromWeb().
   */
  const nodeStream = Readable.fromWeb(stream);

  return nodeStream;
}

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

  const playerData = connectToVoice(
    guild,
    voiceChannel
  );

  playerData.manualStop = false;

  /*
   * Lấy video ID từ track trước.
   */
  let videoId = track?.videoId || null;

  if (!videoId) {
    try {
      const parsed = new URL(url);

      if (parsed.hostname === "youtu.be") {
        videoId =
          parsed.pathname
            .slice(1)
            .split("/")[0] || null;
      } else {
        videoId =
          parsed.searchParams.get("v");
      }
    } catch (_) {}
  }

  if (!videoId) {
    throw new Error(
      "Không thể xác định YouTube video ID."
    );
  }

  console.log(
    `🎵 Chuẩn bị phát: ${
      track?.songName || "YouTube"
    }`
  );

  const audioStream =
    await getYouTubeAudio(videoId);

  /*
   * Audio YouTube được yêu cầu là WebM/Opus,
   * nên Discord Voice có thể xử lý trực tiếp.
   */
  const resource = createAudioResource(
    audioStream,
    {
      inputType: StreamType.WebmOpus,
      inlineVolume: true
    }
  );

  /*
   * Giữ âm lượng hiện tại.
   */
  let volume = 0.75;

  if (
    playerData.resource?.volume &&
    Number.isFinite(
      playerData.resource.volume.volume
    )
  ) {
    volume =
      playerData.resource.volume.volume;
  }

  if (resource.volume) {
    resource.volume.setVolume(volume);
  }

  playerData.resource = resource;

  playerData.currentUrl = url;

  playerData.currentTitle =
    track?.songName ||
    track?.title ||
    "YouTube";

  playerData.currentTrack =
    track ||
    {
      source: "youtube",
      songName: playerData.currentTitle,
      url,
      videoId
    };

  playerData.audioPlayer.play(
    resource
  );

  console.log(
    `▶️ Đang phát: ${playerData.currentTitle}`
  );

  return playerData;
}

function pause(guildId) {
  const data = players.get(guildId);

  if (!data) return false;

  return data.audioPlayer.pause();
}

function resume(guildId) {
  const data = players.get(guildId);

  if (!data) return false;

  return data.audioPlayer.unpause();
}

function stop(guildId) {
  const data = players.get(guildId);

  if (!data) return false;

  data.manualStop = true;

  try {
    data.audioPlayer.stop();
  } catch (_) {}

  data.playing = false;
  data.paused = false;
  data.resource = null;

  return true;
}

function disconnect(guildId) {
  const data = players.get(guildId);

  if (!data) return false;

  data.manualStop = true;

  try {
    data.audioPlayer.stop();
  } catch (_) {}

  try {
    data.connection?.destroy();
  } catch (_) {}

  players.delete(guildId);

  return true;
}

function setVolume(guildId, volume) {
  const data = players.get(guildId);

  if (!data || !data.resource) {
    return false;
  }

  const value = Math.max(
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

function adjustVolume(guildId, amount) {
  const data = players.get(guildId);

  if (!data || !data.resource) {
    return false;
  }

  let current = 75;

  if (data.resource.volume) {
    current =
      data.resource.volume.volume * 100;
  }

  return setVolume(
    guildId,
    current + amount
  );
}

function getPlayerState(guildId) {
  const data = players.get(guildId);

  if (!data) return null;

  return {
    playing: data.playing,
    paused: data.paused,
    currentUrl: data.currentUrl,
    currentTitle: data.currentTitle,
    currentTrack: data.currentTrack,
    connection: data.connection,
    voiceChannel: data.voiceChannel,
    volume:
      data.resource?.volume
        ? data.resource.volume.volume * 100
        : 75
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
  getPlayerState,
  getYouTubeAudio
};
