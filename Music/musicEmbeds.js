const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

const QUEUE_PAGE_SIZE = 10;

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

function formatDuration(ms) {
    if (!ms || Number.isNaN(ms)) {
        return "Live";
    }

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getTrackArtwork(track) {
    return (
        track?.info?.artworkUrl ||
        track?.info?.thumbnail ||
        null
    );
}

function getLoopLabel(loop) {
    switch (loop) {
        case "track":
            return "Track";

        case "queue":
            return "Queue";

        default:
            return "Off";
    }
}

function createEmbed(options = {}) {
    const { EmbedBuilder } = require("discord.js");

    const embed = new EmbedBuilder();

    if (options.title) {
        embed.setTitle(options.title);
    }

    if (options.description) {
        embed.setDescription(options.description);
    }

    if (options.color === "primary") {
        embed.setColor(0x5865f2);
    } else if (options.color === "info") {
        embed.setColor(0x3498db);
    } else if (typeof options.color === "number") {
        embed.setColor(options.color);
    }

    if (options.fields) {
        embed.addFields(options.fields);
    }

    if (options.thumbnail) {
        embed.setThumbnail(options.thumbnail);
    }

    if (options.footer) {
        embed.setFooter({
            text: options.footer
        });
    }

    return embed;
}

function buildNowPlayingEmbed(track, player, guildData) {
    const requester = track?.info?.requester;

    const requesterLabel = requester
        ? (
            requester.username ||
            requester.tag ||
            "Unknown"
        )
        : "Unknown";

    const position = formatDuration(
        player?.position || 0
    );

    const duration = formatDuration(
        track?.info?.length || 0
    );

    return createEmbed({
        title: "Now Playing",

        description:
            track?.info?.title ||
            "Unknown track",

        color: "primary",

        fields: [
            {
                name: "Artist",
                value:
                    track?.info?.author ||
                    "Unknown",
                inline: true
            },
            {
                name: "Requester",
                value: requesterLabel,
                inline: true
            },
            {
                name: "Progress",
                value:
                    `${position} / ${duration}`,
                inline: true
            },
            {
                name: "Volume",
                value:
                    `${guildData?.volume ?? 75}%`,
                inline: true
            },
            {
                name: "Loop",
                value:
                    getLoopLabel(
                        guildData?.loop
                    ),
                inline: true
            },
            {
                name: "Queue",
                value:
                    `${player?.queue?.length || 0} track(s)`,
                inline: true
            }
        ],

        thumbnail:
            getTrackArtwork(track),

        footer:
            player?.paused
                ? "Paused"
                : "Playing"
    });
}

function buildQueueEmbed(
    queue,
    currentTrack,
    page = 0
) {
    const totalTracks =
        queue?.length || 0;

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                totalTracks /
                QUEUE_PAGE_SIZE
            )
        );

    const safePage =
        Math.min(
            Math.max(page, 0),
            totalPages - 1
        );

    const start =
        safePage *
        QUEUE_PAGE_SIZE;

    const slice =
        queue?.slice(
            start,
            start + QUEUE_PAGE_SIZE
        ) || [];

    let description = "";

    if (currentTrack) {
        description +=
            `**Now Playing**\n` +
            `${currentTrack.info?.title || "Unknown"} — ` +
            `${currentTrack.info?.author || "Unknown"}\n\n`;
    }

    if (slice.length === 0) {
        description +=
            "The queue is empty.";
    } else {
        description += slice
            .map((track, index) => {
                const num =
                    start + index + 1;

                return (
                    `${num}. ` +
                    `${track.info?.title || "Unknown"} — ` +
                    `${track.info?.author || "Unknown"}`
                );
            })
            .join("\n");
    }

    return createEmbed({
        title: "Music Queue",

        description:
            description.substring(
                0,
                4096
            ),

        color: "info",

        footer:
            `Page ${safePage + 1} of ${totalPages} • ` +
            `${totalTracks} queued`
    });
}

function buildPlayerButtonRows(
    player,
    guildData
) {
    const paused =
        player?.paused;

    /*
     * HÀNG 1
     *
     * Pause
     * Resume
     * Skip
     * Stop
     * Shuffle
     */

    const row1 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.PAUSE
                    )
                    .setLabel("Pause")
                    .setStyle(
                        ButtonStyle.Primary
                    )
                    .setEmoji("⏸️")
                    .setDisabled(
                        Boolean(paused)
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.RESUME
                    )
                    .setLabel("Resume")
                    .setStyle(
                        ButtonStyle.Success
                    )
                    .setEmoji("▶️")
                    .setDisabled(
                        !paused
                    ),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.SKIP
                    )
                    .setLabel("Skip")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setEmoji("⏭️"),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.STOP
                    )
                    .setLabel("Stop")
                    .setStyle(
                        ButtonStyle.Danger
                    )
                    .setEmoji("⏹️"),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.SHUFFLE
                    )
                    .setLabel("Shuffle")
                    .setStyle(
                        guildData?.shuffle
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
                    .setEmoji("🔀")
            );

    /*
     * HÀNG 2
     *
     * Loop
     * Vol -
     * Vol +
     * Queue
     */

    const row2 =
        new ActionRowBuilder()
            .addComponents(

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.LOOP
                    )
                    .setLabel("Loop")
                    .setStyle(
                        guildData?.loop !== "none"
                            ? ButtonStyle.Success
                            : ButtonStyle.Secondary
                    )
                    .setEmoji("🔁"),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.VOL_DOWN
                    )
                    .setLabel("Vol -")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setEmoji("🔉"),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.VOL_UP
                    )
                    .setLabel("Vol +")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setEmoji("🔊"),

                new ButtonBuilder()
                    .setCustomId(
                        MUSIC_BUTTON_IDS.QUEUE
                    )
                    .setLabel("Queue")
                    .setStyle(
                        ButtonStyle.Secondary
                    )
                    .setEmoji("📋")
            );

    return [
        row1,
        row2
    ];
}

function buildQueuePaginationRow(
    page,
    totalPages
) {
    const currentPage =
        page + 1;

    const firstButton =
        new ButtonBuilder()
            .setCustomId(
                MUSIC_BUTTON_IDS.QUEUE_FIRST
            )
            .setLabel("First")
            .setStyle(
                ButtonStyle.Secondary
            )
            .setDisabled(
                currentPage <= 1
            );

    const previousButton =
        new ButtonBuilder()
            .setCustomId(
                MUSIC_BUTTON_IDS.QUEUE_PREV
            )
            .setLabel("Previous")
            .setStyle(
                ButtonStyle.Secondary
            )
            .setDisabled(
                currentPage <= 1
            );

    const nextButton =
        new ButtonBuilder()
            .setCustomId(
                MUSIC_BUTTON_IDS.QUEUE_NEXT
            )
            .setLabel("Next")
            .setStyle(
                ButtonStyle.Secondary
            )
            .setDisabled(
                currentPage >= totalPages
            );

    const lastButton =
        new ButtonBuilder()
            .setCustomId(
                MUSIC_BUTTON_IDS.QUEUE_LAST
            )
            .setLabel("Last")
            .setStyle(
                ButtonStyle.Secondary
            )
            .setDisabled(
                currentPage >= totalPages
            );

    return new ActionRowBuilder()
        .addComponents(
            firstButton,
            previousButton,
            nextButton,
            lastButton
        );
}

function getQueuePageSize() {
    return QUEUE_PAGE_SIZE;
}

module.exports = {
    MUSIC_BUTTON_IDS,
    formatDuration,
    buildNowPlayingEmbed,
    buildQueueEmbed,
    buildPlayerButtonRows,
    buildQueuePaginationRow,
    getQueuePageSize
};
