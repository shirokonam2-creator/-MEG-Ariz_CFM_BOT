 const {
  EmbedBuilder
} = require("discord.js");

const {
  getGuildMusicData
} = require("./playerStore");

const {
  getPlayer,
  buildQueueReply,
  destroyPlayerSession,
  setLoopMode,
  applyPause,
  applyResume,
  refreshPlayerMessage
} = require("./musicActions");

const MUSIC_BUTTON_IDS = {
  PAUSE: "music_pause",
  RESUME: "music_resume",
  SKIP: "music_skip",
  STOP: "music_stop",
  SHUFFLE: "music_shuffle",
  LOOP: "music_loop",
  VOL_DOWN: "music_vol_down",
  VOL_UP: "music_vol_up",
  QUEUE: "music_queue",

  QUEUE_FIRST: "music_queue_first",
  QUEUE_PREV: "music_queue_prev",
  QUEUE_NEXT: "music_queue_next",
  QUEUE_LAST: "music_queue_last"
};


/*
 * Kiểm tra người dùng có ở cùng voice
 * với bot hay không
 */
function canControlMusic(interaction, player) {
  if (!interaction.member?.voice?.channelId) {
    return false;
  }

  if (!player?.voiceChannel) {
    return true;
  }

  return (
    interaction.member.voice.channelId ===
    player.voiceChannel
  );
}


/*
 * Gửi lỗi cho người dùng
 */
async function sendError(
  interaction,
  message
) {
  if (
    interaction.deferred ||
    interaction.replied
  ) {
    return interaction.followUp({
      content: message,
      ephemeral: true
    });
  }

  return interaction.reply({
    content: message,
    ephemeral: true
  });
}


/*
 * ==============================
 * MUSIC BUTTON HANDLER
 * ==============================
 */
async function handleMusicButton(
  interaction
) {
  const guildId =
    interaction.guild.id;

  const client =
    interaction.client;

  const customId =
    interaction.customId;

  const player =
    getPlayer(
      client,
      guildId
    );

  const guildData =
    getGuildMusicData(
      guildId
    );


  /*
   * ==============================
   * QUEUE
   * ==============================
   */

  if (
    customId ===
    MUSIC_BUTTON_IDS.QUEUE
  ) {

    if (!player?.current) {
      return sendError(
        interaction,
        "❌ Hiện không có bài nào đang phát."
      );
    }

    if (
      !canControlMusic(
        interaction,
        player
      )
    ) {
      return sendError(
        interaction,
        "❌ Bạn phải ở cùng phòng voice với bot."
      );
    }

    guildData.queuePages =
      guildData.queuePages ||
      new Map();

    guildData.queuePages.set(
      interaction.user.id,
      0
    );

    const payload =
      buildQueueReply(
        client,
        guildId,
        0
      );

    return interaction.reply({
      embeds:
        payload.embeds,
      components:
        payload.components,
      ephemeral: true
    });
  }


  /*
   * ==============================
   * QUEUE PAGINATION
   * ==============================
   */

  const paginationIds = [
    MUSIC_BUTTON_IDS.QUEUE_FIRST,
    MUSIC_BUTTON_IDS.QUEUE_PREV,
    MUSIC_BUTTON_IDS.QUEUE_NEXT,
    MUSIC_BUTTON_IDS.QUEUE_LAST
  ];

  if (
    paginationIds.includes(
      customId
    )
  ) {

    if (!player?.current) {
      return sendError(
        interaction,
        "❌ Hiện không có bài nào đang phát."
      );
    }

    if (
      !canControlMusic(
        interaction,
        player
      )
    ) {
      return sendError(
        interaction,
        "❌ Bạn phải ở cùng phòng voice với bot."
      );
    }

    await interaction.deferUpdate();

    guildData.queuePages =
      guildData.queuePages ||
      new Map();

    const currentPage =
      guildData.queuePages.get(
        interaction.user.id
      ) || 0;

    const payload =
      buildQueueReply(
        client,
        guildId,
        currentPage
      );

    let page =
      payload.page;

    switch (customId) {

      case MUSIC_BUTTON_IDS.QUEUE_FIRST:
        page = 0;
        break;

      case MUSIC_BUTTON_IDS.QUEUE_PREV:
        page =
          Math.max(
            0,
            page - 1
          );
        break;

      case MUSIC_BUTTON_IDS.QUEUE_NEXT:
        page =
          Math.min(
            payload.totalPages - 1,
            page + 1
          );
        break;

      case MUSIC_BUTTON_IDS.QUEUE_LAST:
        page =
          payload.totalPages - 1;
        break;
    }

    guildData.queuePages.set(
      interaction.user.id,
      page
    );

    const updated =
      buildQueueReply(
        client,
        guildId,
        page
      );

    return interaction.editReply({
      embeds:
        updated.embeds,
      components:
        updated.components
    });
  }


  /*
   * ==============================
   * PLAYER CHECK
   * ==============================
   */

  if (!player) {
    return sendError(
      interaction,
      "❌ Chưa có Music player. Hãy dùng `/play` trước."
    );
  }

  if (
    !canControlMusic(
      interaction,
      player
    )
  ) {
    return sendError(
      interaction,
      "❌ Bạn phải ở cùng phòng voice với bot."
    );
  }


  /*
   * ==============================
   * BUTTON ACTIONS
   * ==============================
   */

  try {

    await interaction.deferUpdate();

    /*
     * PAUSE
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.PAUSE
    ) {

      await applyPause(
        client,
        guildId
      );

      return;
    }


    /*
     * RESUME
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.RESUME
    ) {

      await applyResume(
        client,
        guildId
      );

      return;
    }


    /*
     * SKIP
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.SKIP
    ) {

      if (
        player.loop ===
        "track"
      ) {
        player.setLoop(
          "none"
        );
      }

      player.stop();

      return;
    }


    /*
     * STOP
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.STOP
    ) {

      await destroyPlayerSession(
        client,
        guildId,
        player,
        guildData
      );

      return;
    }


    /*
     * SHUFFLE
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.SHUFFLE
    ) {

      if (
        player.queue &&
        player.queue.length > 0
      ) {

        player.queue.shuffle();

        guildData.shuffle =
          true;

        await refreshPlayerMessage(
          client,
          guildId
        );
      }

      return;
    }


    /*
     * LOOP
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.LOOP
    ) {

      const current =
        guildData.loop ||
        "none";

      let next;

      if (
        current ===
        "none"
      ) {
        next = "track";
      }

      else if (
        current ===
        "track"
      ) {
        next = "queue";
      }

      else {
        next = "none";
      }

      await setLoopMode(
        client,
        interaction,
        next
      );

      return;
    }


    /*
     * VOLUME DOWN
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.VOL_DOWN
    ) {

      guildData.volume =
        Math.max(
          0,
          (guildData.volume ?? 75) -
          10
        );

      player.setVolume(
        guildData.volume
      );

      await refreshPlayerMessage(
        client,
        guildId
      );

      return;
    }


    /*
     * VOLUME UP
     */
    if (
      customId ===
      MUSIC_BUTTON_IDS.VOL_UP
    ) {

      guildData.volume =
        Math.min(
          100,
          (guildData.volume ?? 75) +
          10
        );

      player.setVolume(
        guildData.volume
      );

      await refreshPlayerMessage(
        client,
        guildId
      );

      return;
    }

  } catch (error) {

    console.error(
      "[MEG MUSIC BUTTON ERROR]",
      error
    );

    try {

      await interaction.followUp({
        content:
          "❌ Không thể thực hiện thao tác Music.",
        ephemeral: true
      });

    } catch {}
  }
}


/*
 * ==============================
 * EXPORT
 * ==============================
 */

module.exports = {
  MUSIC_BUTTON_IDS,
  handleMusicButton
};
