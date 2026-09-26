const {
    MUSIC_BUTTON_IDS
} = require("./musicEmbeds");

const {
    getGuildMusicData
} = require("./playerStore");

const {
    getPlayer,
    assertCanControl,
    applyPause,
    applyResume,
    skipTrack,
    stopPlayback,
    shuffleQueue,
    toggleLoop,
    adjustVolume,
    buildQueueReply,
    MusicError
} = require("./musicActions");


async function handleMusicButton(
    interaction,
    client
) {
    if (!interaction.isButton()) {
        return false;
    }

    const customId =
        interaction.customId;

    const musicButtonIds =
        Object.values(
            MUSIC_BUTTON_IDS
        );

    if (
        !musicButtonIds.includes(
            customId
        )
    ) {
        return false;
    }

    /*
     * Kiểm tra Riffy
     */

    if (!client.riffy) {
        await interaction.reply({
            content:
                "❌ Music system chưa được kết nối với Lavalink.",
            ephemeral: true
        });

        return true;
    }

    const guildId =
        interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content:
                "❌ Không xác định được server.",
            ephemeral: true
        });

        return true;
    }

    try {
        /*
         * =========================
         * QUEUE
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.QUEUE
        ) {
            const player =
                getPlayer(
                    client,
                    guildId
                );

            if (!player) {
                throw new MusicError(
                    "No player",
                    "Không có Music player đang hoạt động."
                );
            }

            assertCanControl(
                interaction.member,
                player
            );

            const guildData =
                getGuildMusicData(
                    guildId
                );

            guildData.queuePages.set(
                interaction.user.id,
                0
            );

            const reply =
                buildQueueReply(
                    client,
                    guildId,
                    0
                );

            await interaction.reply({
                ...reply,
                ephemeral: true
            });

            return true;
        }


        /*
         * =========================
         * QUEUE PAGINATION
         * =========================
         */

        if (
            customId ===
                MUSIC_BUTTON_IDS.QUEUE_FIRST ||
            customId ===
                MUSIC_BUTTON_IDS.QUEUE_PREV ||
            customId ===
                MUSIC_BUTTON_IDS.QUEUE_NEXT ||
            customId ===
                MUSIC_BUTTON_IDS.QUEUE_LAST
        ) {
            const guildData =
                getGuildMusicData(
                    guildId
                );

            const player =
                getPlayer(
                    client,
                    guildId
                );

            if (!player) {
                throw new MusicError(
                    "No player",
                    "Không có Music player."
                );
            }

            assertCanControl(
                interaction.member,
                player
            );

            let page =
                guildData.queuePages.get(
                    interaction.user.id
                ) ?? 0;

            const totalPages =
                Math.max(
                    1,
                    Math.ceil(
                        (
                            player.queue
                                ?.length || 0
                        ) / 10
                    )
                );

            if (
                customId ===
                MUSIC_BUTTON_IDS.QUEUE_FIRST
            ) {
                page = 0;
            }

            if (
                customId ===
                MUSIC_BUTTON_IDS.QUEUE_PREV
            ) {
                page =
                    Math.max(
                        0,
                        page - 1
                    );
            }

            if (
                customId ===
                MUSIC_BUTTON_IDS.QUEUE_NEXT
            ) {
                page =
                    Math.min(
                        totalPages - 1,
                        page + 1
                    );
            }

            if (
                customId ===
                MUSIC_BUTTON_IDS.QUEUE_LAST
            ) {
                page =
                    totalPages - 1;
            }

            guildData.queuePages.set(
                interaction.user.id,
                page
            );

            const reply =
                buildQueueReply(
                    client,
                    guildId,
                    page
                );

            await interaction.update(
                reply
            );

            return true;
        }


        /*
         * =========================
         * GET PLAYER
         * =========================
         */

        const player =
            getPlayer(
                client,
                guildId
            );

        if (!player) {
            throw new MusicError(
                "No player",
                "Không có Music player đang hoạt động."
            );
        }

        assertCanControl(
            interaction.member,
            player
        );


        /*
         * =========================
         * PAUSE
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.PAUSE
        ) {
            const changed =
                await applyPause(
                    client,
                    guildId
                );

            if (!changed) {
                throw new MusicError(
                    "Cannot pause",
                    "Nhạc hiện không thể Pause."
                );
            }

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * RESUME
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.RESUME
        ) {
            const changed =
                await applyResume(
                    client,
                    guildId
                );

            if (!changed) {
                throw new MusicError(
                    "Cannot resume",
                    "Nhạc hiện không thể Resume."
                );
            }

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * SKIP
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.SKIP
        ) {
            await skipTrack(
                client,
                interaction
            );

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * STOP
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.STOP
        ) {
            await stopPlayback(
                client,
                interaction
            );

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * SHUFFLE
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.SHUFFLE
        ) {
            await shuffleQueue(
                client,
                interaction
            );

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * LOOP
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.LOOP
        ) {
            await toggleLoop(
                client,
                interaction
            );

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * VOLUME DOWN
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.VOL_DOWN
        ) {
            await adjustVolume(
                client,
                interaction,
                -10
            );

            await interaction.deferUpdate();

            return true;
        }


        /*
         * =========================
         * VOLUME UP
         * =========================
         */

        if (
            customId ===
            MUSIC_BUTTON_IDS.VOL_UP
        ) {
            await adjustVolume(
                client,
                interaction,
                10
            );

            await interaction.deferUpdate();

            return true;
        }

        return false;

    } catch (error) {

        console.error(
            "[Music Button Error]",
            error
        );

        const message =
            error instanceof MusicError
                ? error.message
                : "Đã xảy ra lỗi khi xử lý Music.";

        if (
            interaction.replied ||
            interaction.deferred
        ) {
            try {
                await interaction.followUp({
                    content:
                        `❌ ${message}`,
                    ephemeral: true
                });
            } catch {}
        } else {
            try {
                await interaction.reply({
                    content:
                        `❌ ${message}`,
                    ephemeral: true
                });
            } catch {}
        }

        return true;
    }
}


module.exports = {
    handleMusicButton
};
