const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require("@discordjs/voice");

const play = require("play-dl");

const players = new Map();


/* =========================================================
   LẤY PLAYER
========================================================= */

function getPlayer(guildId) {
  return players.get(guildId) || null;
}


/* =========================================================
   TẠO PLAYER
========================================================= */

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

    paused: false,

    manualStop: false,

    voiceChannel: null,

    guild: null
  };


  /* =======================================================
     PLAYING
  ======================================================= */

  audioPlayer.on(
    AudioPlayerStatus.Playing,
    () => {
      data.playing = true;
      data.paused = false;
    }
  );


  /* =======================================================
     PAUSED
  ======================================================= */

  audioPlayer.on(
    AudioPlayerStatus.Paused,
    () => {
      data.playing = false;
      data.paused = true;
    }
  );


  /* =======================================================
     AUTO PAUSED
  ======================================================= */

  audioPlayer.on(
    AudioPlayerStatus.AutoPaused,
    () => {
      data.playing = false;
    }
  );


  /* =======================================================
     IDLE = BÀI HÁT KẾT THÚC
  ======================================================= */

  audioPlayer.on(
    AudioPlayerStatus.Idle,
    async () => {

      /*
       * Stop thủ công
       */

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


      console.log(
        `⏭️ Bài hát đã kết thúc [${guildId}]`
      );


      try {

        const {
          getNextTrack
        } = require("./musicQueue");

        const nextTrack =
          getNextTrack(guildId);


        /*
         * Queue trống
         */

        if (!nextTrack) {

          console.log(
            `📭 Queue trống [${guildId}]`
          );

          data.currentTrack = null;
          data.currentUrl = null;
          data.currentTitle = null;

          return;
        }


        /*
         * Không còn voice channel
         */

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

      } catch (error) {

        console.error(
          `❌ Không thể phát bài tiếp theo [${guildId}]:`,
          error
        );

      }
    }
  );


  /* =======================================================
     ERROR
  ======================================================= */

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


  players.set(
    guildId,
    data
  );

  return data;
}


/* =========================================================
   KẾT NỐI VOICE
========================================================= */

function connectToVoice(
  guild,
  voiceChannel
) {

  if (!guild) {
    throw new Error(
      "Không tìm thấy server."
    );
  }

  if (!voiceChannel) {
    throw new Error(
      "Không tìm thấy phòng thoại."
    );
  }


  const playerData =
    createPlayer(guild.id);


  playerData.guild =
    guild;

  playerData.voiceChannel =
    voiceChannel;


  /*
   * Nếu đã có connection
   * và vẫn đang ở đúng voice channel
   * thì dùng lại connection.
   */

  if (
    playerData.connection &&
    playerData.connection.joinConfig?.channelId ===
      voiceChannel.id
  ) {

    playerData.connection.subscribe(
      playerData.audioPlayer
    );

    return playerData;
  }


  /*
   * Nếu connection cũ tồn tại
   * nhưng channel đã thay đổi
   */

  try {
    playerData.connection?.destroy();
  } catch {}


  const connection =
    joinVoiceChannel({
      channelId:
        voiceChannel.id,

      guildId:
        guild.id,

      adapterCreator:
        guild.voiceAdapterCreator,

      selfDeaf: true,

      selfMute: false
    });


  connection.subscribe(
    playerData.audioPlayer
  );


  playerData.connection =
    connection;


  return playerData;
}


/* =========================================================
   PHÁT YOUTUBE
========================================================= */

async function playYouTube(
  guild,
  voiceChannel,
  url,
  track = null
) {

  if (!guild) {
    throw new Error(
      "Không tìm thấy server."
    );
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


  /*
   * Nếu đây là bài mới sau bài cũ,
   * hủy trạng thái stop thủ công.
   */

  playerData.manualStop = false;


  console.log(
    `🎵 Đang lấy audio YouTube: ${url}`
  );


  const stream =
    await play.stream(
      url,
      {
        quality: 2,

        discordPlayerCompatibility:
          true
      }
    );


  const resource =
    createAudioResource(
      stream.stream,
      {
        inputType:
          stream.type,

        inlineVolume:
          true
      }
    );


  /*
   * Lấy âm lượng hiện tại.
   * Nếu chưa có thì dùng 75%.
   */

  const oldVolume =
    playerData.resource?.volume?.volume;


  const volume =
    Number.isFinite(oldVolume)
      ? oldVolume
      : 0.75;


  if (resource.volume) {

    resource.volume.setVolume(
      volume
    );

  }


  playerData.resource =
    resource;


  playerData.currentUrl =
    url;


  playerData.currentTitle =
    track?.songName ||
    track?.title ||
    "YouTube";


  playerData.currentTrack =
    track ||
    {
      songName:
        playerData.currentTitle,

      url
    };


  /*
   * Phát audio
   */

  playerData.audioPlayer.play(
    resource
  );


  console.log(
    `▶️ Đang phát: ${playerData.currentTitle}`
  );


  return playerData;
}


/* =========================================================
   PAUSE
========================================================= */

function pause(guildId) {

  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }

  return data.audioPlayer.pause();
}


/* =========================================================
   RESUME
========================================================= */

function resume(guildId) {

  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }

  return data.audioPlayer.unpause();
}


/* =========================================================
   STOP
========================================================= */

function stop(guildId) {

  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }


  /*
   * Đánh dấu stop thủ công
   * để Idle không tự chạy queue.
   */

  data.manualStop = true;


  try {
    data.audioPlayer.stop();
  } catch {}


  data.playing = false;
  data.paused = false;
  data.resource = null;


  return true;
}


/* =========================================================
   DISCONNECT
========================================================= */

function disconnect(guildId) {

  const data =
    players.get(guildId);

  if (!data) {
    return false;
  }


  data.manualStop = true;


  try {
    data.audioPlayer.stop();
  } catch {}


  try {
    data.connection?.destroy();
  } catch {}


  players.delete(
    guildId
  );


  return true;
}


/* =========================================================
   VOLUME
========================================================= */

function setVolume(
  guildId,
  volume
) {

  const data =
    players.get(guildId);

  if (
    !data ||
    !data.resource
  ) {
    return false;
  }


  const value =
    Math.max(
      0,
      Math.min(
        100,
        Number(volume)
      )
    );


  if (data.resource.volume) {

    data.resource.volume.setVolume(
      value / 100
    );

  }


  return value;
}


/* =========================================================
   TĂNG / GIẢM VOLUME
========================================================= */

function adjustVolume(
  guildId,
  amount
) {

  const data =
    players.get(guildId);

  if (
    !data ||
    !data.resource
  ) {
    return false;
  }


  let current = 75;


  if (
    data.resource.volume
  ) {

    current =
      data.resource.volume.volume *
      100;

  }


  return setVolume(
    guildId,
    current + amount
  );
}


/* =========================================================
   TRẠNG THÁI PLAYER
========================================================= */

function getPlayerState(
  guildId
) {

  const data =
    players.get(guildId);

  if (!data) {
    return null;
  }


  return {

    playing:
      data.playing,

    paused:
      data.paused,

    currentUrl:
      data.currentUrl,

    currentTitle:
      data.currentTitle,

    currentTrack:
      data.currentTrack,

    connection:
      data.connection,

    voiceChannel:
      data.voiceChannel
  };
}


/* =========================================================
   EXPORT
========================================================= */

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
