const {
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const {
    getGuildMusicData,
    clearUpdateInterval
} = require("./playerStore");

const {
    buildNowPlayingEmbed,
    buildQueueEmbed,
    buildQueuePaginationRow,
    getQueuePageSize
} = require("./musicEmbeds");

const YOUTUBE_URL_PATTERN =
    /(?:youtube\.com|youtu\.be)/i;

const PLAYER_CONNECT_TIMEOUT_MS = 12000;

/* =========================================================
   ERROR
========================================================= */

class MusicError extends Error {
    constructor(title, message) {
        super(message);

        this.name = "MusicError";
        this.title = title;
    }
}

/* =========================================================
   EMBED
========================================================= */

function successEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x57f287);
}

/* =========================================================
   LAVALINK
========================================================= */

function getConnectedLavalinkNodes(client) {
    if (!client?.riffy?.nodeMap) {
        return [];
    }

    return [
        ...client.riffy.nodeMap.values()
    ].filter(node => {
        return node?.connected;
    });
}

function assertRiffyAvailable(client) {
    if (!client?.riffy) {
        throw new MusicError(
            "Lavalink unavailable",
            "Music is unavailable because Lavalink has not been configured."
        );
    }
}

function assertLavalinkNodeAvailable(client) {
    const nodes =
        getConnectedLavalinkNodes(client);

    if (!nodes.length) {
        throw new MusicError(
            "Lavalink unavailable",
            "No Lavalink nodes are connected."
        );
    }
}

/* =========================================================
   VOICE
========================================================= */

function requireVoiceChannel(member) {
    return Boolean(
        member?.voice?.channel
    );
}

function assertInVoice(member) {
    if (!requireVoiceChannel(member)) {
        throw new MusicError(
            "Not in voice channel",
            "You need to be in a voice channel."
        );
    }
}

function canControlMusic(member, player) {
    const memberChannel =
        member?.voice?.channel;

    if (
        !memberChannel ||
        !player?.voiceChannel
    ) {
        return false;
    }

    return (
        memberChannel.id ===
        player.voiceChannel
    );
}

function assertCanControl(member, player) {
    if (
        !canControlMusic(
            member,
            player
        )
    ) {
        throw new MusicError(
            "Wrong voice channel",
            "You need to be in the same voice channel as the bot to use music controls."
        );
    }
}

function assertBotVoicePermissions(channel) {
    if (!channel) {
        throw new MusicError(
            "Voice channel unavailable",
            "Could not access that voice channel."
        );
    }

    const me =
        channel.guild?.members?.me;

    if (!me) {
        return;
    }

    const permissions =
        channel.permissionsFor(me);

    if (!permissions) {
        return;
    }

    if (
        !permissions.has(
            PermissionFlagsBits.Connect
        ) ||
        !permissions.has(
            PermissionFlagsBits.Speak
        )
    ) {
        throw new MusicError(
            "Missing permissions",
            "I need Connect and Speak permissions in your voice channel."
        );
    }
}

/* =========================================================
   PLAYER
========================================================= */

function getPlayer(client, guildId) {
    return (
        client?.riffy?.players?.get(
            guildId
        ) || null
    );
}

async function waitForPlayerConnection(player) {
    if (!player) {
        throw new MusicError(
            "Player unavailable",
            "Music player was not created."
        );
    }

    if (player.connected) {
        return;
    }

    try {
        if (
            player.connection &&
            typeof player.connection.resolve ===
                "function"
        ) {
            await player.connection.resolve();
        }
    } catch (_) {
        // Continue and wait for connection event.
    }

    if (player.connected) {
        return;
    }

    await new Promise(resolve => {
        let finished = false;

        const finish = () => {
            if (finished) {
                return;
            }

            finished = true;

            clearTimeout(timer);

            if (
                typeof player.off ===
                "function"
            ) {
                player.off(
                    "connectionRestored",
                    finish
                );
            }

            resolve();
        };

        const timer =
            setTimeout(
                finish,
                PLAYER_CONNECT_TIMEOUT_MS
            );

        if (
            typeof player.once ===
            "function"
        ) {
            player.once(
                "connectionRestored",
                finish
            );
        }
    });

    if (!player.connected) {
        throw new MusicError(
            "Voice connection failed",
            "Could not connect to the voice channel. Check Lavalink and the bot's Connect/Speak permissions."
        );
    }
}

async function startPlayback(player) {
    await waitForPlayerConnection(
        player
    );

    if (
        typeof player.play !==
        "function"
    ) {
        throw new MusicError(
            "Playback unavailable",
            "The Lavalink player does not support playback."
        );
    }

    await player.play();
}

/* =========================================================
   ENSURE PLAYER
========================================================= */

async function ensurePlayer(
    client,
    interaction
) {
    assertRiffyAvailable(client);
    assertLavalinkNodeAvailable(client);

    assertInVoice(
        interaction.member
    );

    if (!interaction.guild) {
        throw new MusicError(
            "Server unavailable",
            "This command can only be used inside a server."
        );
    }

    const guildId =
        interaction.guild.id;

    const guildData =
        getGuildMusicData(
            guildId
        );

    let player =
        getPlayer(
            client,
            guildId
        );

    const voiceChannel =
        interaction.member.voice.channel;

    assertBotVoicePermissions(
        voiceChannel
    );

    if (
        player &&
        player.voiceChannel !==
            voiceChannel.id
    ) {
        try {
            if (
                typeof player.destroy ===
                "function"
            ) {
                player.destroy();
            }
        } catch (_) {}

        player = null;
    }

    if (!player) {
        if (
            typeof client.riffy
                .createConnection !==
            "function"
        ) {
            throw new MusicError(
                "Player unavailable",
                "Riffy could not create a music connection."
            );
        }

        player =
            client.riffy.createConnection({
                guildId,

                voiceChannel:
                    voiceChannel.id,

                textChannel:
                    interaction.channel?.id,

                deaf: true
            });

        guildData.playerChannelId =
            interaction.channel?.id || null;
    }

    if (
        typeof player.setVolume ===
        "function"
    ) {
        player.setVolume(
            guildData.volume
        );
    }

    return {
        player,
        guildData
    };
}

/* =========================================================
   DUPLICATE
========================================================= */

function isDuplicateTrack(
    player,
    track
) {
    const uri =
        track?.info?.uri;

    if (!uri) {
        return false;
    }

    if (
        player?.current?.info?.uri ===
        uri
    ) {
        return true;
    }

    return Boolean(
        player?.queue?.some(trackInQueue => {
            return (
                trackInQueue?.info?.uri ===
                uri
            );
        })
    );
}

/* =========================================================
   JOIN
========================================================= */

async function joinVoiceChannel(
    client,
    interaction
) {
    assertRiffyAvailable(client);

    assertInVoice(
        interaction.member
    );

    if (!interaction.guild) {
        throw new MusicError(
            "Server unavailable",
            "This command can only be used inside a server."
        );
    }

    const guildId =
        interaction.guild.id;

    const guildData =
        getGuildMusicData(
            guildId
        );

    const channel =
        interaction.member.voice.channel;

    assertBotVoicePermissions(
        channel
    );

    let player =
        getPlayer(
            client,
            guildId
        );

    if (
        player &&
        player.voiceChannel !==
            channel.id
    ) {
        try {
            if (
                typeof player.destroy ===
                "function"
            ) {
                player.destroy();
            }
        } catch (_) {}

        player = null;
    }

    if (!player) {
        player =
            client.riffy.createConnection({
                guildId,

                voiceChannel:
                    channel.id,

                textChannel:
                    interaction.channel?.id,

                deaf: true
            });

        guildData.playerChannelId =
            interaction.channel?.id || null;
    }

    if (
        typeof player.setVolume ===
        "function"
    ) {
        player.setVolume(
            guildData.volume
        );
    }

    return successEmbed(
        "Joined Voice Channel",
        `Connected to **${channel.name}**.`
    );
}

/* =========================================================
   PLAY
========================================================= */

async function playQuery(
    client,
    interaction,
    query
) {
    if (
        !query ||
        !query.trim()
    ) {
        throw new MusicError(
            "Invalid query",
            "Please provide a YouTube URL or song name."
        );
    }

    query =
        query.trim();

    if (
        !YOUTUBE_URL_PATTERN.test(
            query
        )
    ) {
        query =
            `ytmsearch:${query}`;
    }

    const {
        player
    } = await ensurePlayer(
        client,
        interaction
    );

    if (
        typeof client.riffy.resolve !==
        "function"
    ) {
        throw new MusicError(
            "Search unavailable",
            "Riffy could not search Lavalink."
        );
    }

    const result =
        await client.riffy.resolve({
            query,

            requester:
                interaction.user
        });

    if (!result) {
        throw new MusicError(
            "No results",
            "Lavalink returned no result."
        );
    }

    const loadType =
        String(
            result.loadType || ""
        ).toLowerCase();

    const tracks =
        Array.isArray(result.tracks)
            ? result.tracks
            : [];

    const playlistInfo =
        result.playlistInfo;

    /* =====================================================
       PLAYLIST
    ===================================================== */

    if (
        loadType === "playlist" ||
        loadType === "playlist_loaded"
    ) {
        let added = 0;
        let skipped = 0;

        for (
            const track of tracks
        ) {
            if (!track) {
                continue;
            }

            if (!track.info) {
                track.info = {};
            }

            track.info.requester =
                interaction.user;

            if (
                isDuplicateTrack(
                    player,
                    track
                )
            ) {
                skipped++;
                continue;
            }

            player.queue.add(
                track
            );

            added++;
        }

        if (
            !player.playing &&
            !player.paused &&
            player.queue.length > 0
        ) {
            await startPlayback(
                player
            );
        }

        return {
            embed:
                successEmbed(
                    "Playlist Added",

                    `**${
                        playlistInfo?.name ||
                        "Playlist"
                    }**\n` +
                    `Added ${added} track(s).` +
                    (
                        skipped > 0
                            ? ` Skipped ${skipped} duplicate(s).`
                            : ""
                    )
                )
        };
    }

    /* =====================================================
       SINGLE TRACK / SEARCH
    ===================================================== */

    if (
        loadType === "search" ||
        loadType === "track" ||
        loadType === "search_result" ||
        loadType === "track_loaded"
    ) {
        const track =
            tracks[0];

        if (!track) {
            throw new MusicError(
                "No results",
                "No YouTube results found."
            );
        }

        if (
            isDuplicateTrack(
                player,
                track
            )
        ) {
            throw new MusicError(
                "Duplicate track",
                `**${track.info?.title || "This track"}** is already playing or in the queue.`
            );
        }

        if (!track.info) {
            track.info = {};
        }

        track.info.requester =
            interaction.user;

        const willPlayNow =
            !player.playing &&
            !player.paused;

        player.queue.add(
            track
        );

        const queuePosition =
            player.queue.length;

        if (willPlayNow) {
            await startPlayback(
                player
            );
        }

        return {
            embed:
                successEmbed(
                    willPlayNow
                        ? "Now Playing"
                        : "Track Added",

                    willPlayNow
                        ? `**${track.info.title || "Unknown"}**\n${track.info.author || "Unknown"}`
                        : `**${track.info.title || "Unknown"}**\n${track.info.author || "Unknown"}\nPosition: #${queuePosition}`
                )
        };
    }

    throw new MusicError(
        "No results",
        `No results found. (${result.loadType || "unknown"})`
    );
}

/* =========================================================
   SKIP
========================================================= */

async function skipTrack(
    client,
    interaction
) {
    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (!player?.current) {
        throw new MusicError(
            "No player",
            "Nothing is playing right now."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    const title =
        player.current.info?.title ||
        "Unknown";

    if (
        player.loop === "track" &&
        typeof player.setLoop ===
            "function"
    ) {
        player.setLoop("none");

        getGuildMusicData(
            interaction.guild.id
        ).loop = "none";
    }

    if (
        typeof player.stop !==
        "function"
    ) {
        throw new MusicError(
            "Skip unavailable",
            "The player cannot skip the current track."
        );
    }

    await player.stop();

    return successEmbed(
        "Skipped",
        `Skipped **${title}**.`
    );
}

/* =========================================================
   PAUSE
========================================================= */

async function applyPause(
    client,
    guildId
) {
    const player =
        getPlayer(
            client,
            guildId
        );

    if (
        !player?.current ||
        player.paused
    ) {
        return false;
    }

    if (
        typeof player.pause !==
        "function"
    ) {
        return false;
    }

    player.pause(true);

    return true;
}

/* =========================================================
   RESUME
========================================================= */

async function applyResume(
    client,
    guildId
) {
    const player =
        getPlayer(
            client,
            guildId
        );

    if (
        !player?.current ||
        !player.paused
    ) {
        return false;
    }

    if (
        typeof player.pause !==
        "function"
    ) {
        return false;
    }

    player.pause(false);

    return true;
}

/* =========================================================
   PAUSE COMMAND
========================================================= */

async function pausePlayback(
    client,
    interaction
) {
    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (!player?.current) {
        throw new MusicError(
            "No player",
            "Nothing is playing right now."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    if (player.paused) {
        throw new MusicError(
            "Already paused",
            "Playback is already paused."
        );
    }

    const changed =
        await applyPause(
            client,
            interaction.guild.id
        );

    if (!changed) {
        throw new MusicError(
            "Cannot pause",
            "Playback could not be paused."
        );
    }

    return successEmbed(
        "Paused",
        "Playback paused."
    );
}

/* =========================================================
   RESUME COMMAND
========================================================= */

async function resumePlayback(
    client,
    interaction
) {
    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (!player?.current) {
        throw new MusicError(
            "No player",
            "Nothing is playing right now."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    if (!player.paused) {
        throw new MusicError(
            "Not paused",
            "Playback is not paused."
        );
    }

    const changed =
        await applyResume(
            client,
            interaction.guild.id
        );

    if (!changed) {
        throw new MusicError(
            "Cannot resume",
            "Playback could not be resumed."
        );
    }

    return successEmbed(
        "Resumed",
        "Playback resumed."
    );
}

/* =========================================================
   SHUFFLE
========================================================= */

async function shuffleQueue(
    client,
    interaction
) {
    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (!player) {
        throw new MusicError(
            "No player",
            "No active music player."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    if (
        !player.queue ||
        !player.queue.length
    ) {
        throw new MusicError(
            "Empty queue",
            "The queue is empty."
        );
    }

    if (
        typeof player.queue.shuffle !==
        "function"
    ) {
        throw new MusicError(
            "Shuffle unavailable",
            "This Lavalink player does not support queue shuffle."
        );
    }

    player.queue.shuffle();

    const guildData =
        getGuildMusicData(
            interaction.guild.id
        );

    guildData.shuffle = true;

    return successEmbed(
        "Shuffled",
        "The queue has been shuffled."
    );
}

/* =========================================================
   LOOP
========================================================= */

async function setLoopMode(
    client,
    interaction,
    mode
) {
    const allowedModes = [
        "none",
        "track",
        "queue"
    ];

    if (
        !allowedModes.includes(
            mode
        )
    ) {
        throw new MusicError(
            "Invalid loop mode",
            "Invalid loop mode."
        );
    }

    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (!player) {
        throw new MusicError(
            "No player",
            "No active music player."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    if (
        typeof player.setLoop !==
        "function"
    ) {
        throw new MusicError(
            "Loop unavailable",
            "This Lavalink player does not support loop mode."
        );
    }

    const guildData =
        getGuildMusicData(
            interaction.guild.id
        );

    guildData.loop =
        mode;

    player.setLoop(
        mode
    );

    const labels = {
        none: "Off",
        track: "Track",
        queue: "Queue"
    };

    return successEmbed(
        "Loop Updated",
        `Loop mode set to **${labels[mode]}**.`
    );
}

async function toggleLoop(
    client,
    interaction
) {
    const guildData =
        getGuildMusicData(
            interaction.guild.id
        );

    const current =
        guildData.loop || "none";

    const next =
        current === "none"
            ? "track"
            : current === "track"
                ? "queue"
                : "none";

    return setLoopMode(
        client,
        interaction,
        next
    );
}

/* =========================================================
   VOLUME
========================================================= */

async function setVolume(
    client,
    interaction,
    volume
) {
    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (!player) {
        throw new MusicError(
            "No player",
            "No active music player."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    const guildData =
        getGuildMusicData(
            interaction.guild.id
        );

    const numericVolume =
        Number(volume);

    if (
        !Number.isFinite(
            numericVolume
        )
    ) {
        throw new MusicError(
            "Invalid volume",
            "Volume must be a number."
        );
    }

    guildData.volume =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(
                    numericVolume
                )
            )
        );

    if (
        typeof player.setVolume !==
        "function"
    ) {
        throw new MusicError(
            "Volume unavailable",
            "This Lavalink player does not support volume control."
        );
    }

    player.setVolume(
        guildData.volume
    );

    return successEmbed(
        "Volume Updated",
        `Volume set to **${guildData.volume}%**.`
    );
}

async function adjustVolume(
    client,
    interaction,
    delta
) {
    const guildData =
        getGuildMusicData(
            interaction.guild.id
        );

    return setVolume(
        client,
        interaction,
        guildData.volume +
            delta
    );
}

/* =========================================================
   STOP
========================================================= */

async function stopPlayback(
    client,
    interaction
) {
    const guildId =
        interaction.guild.id;

    const player =
        getPlayer(
            client,
            guildId
        );

    if (!player) {
        throw new MusicError(
            "No player",
            "No active music player."
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

    clearUpdateInterval(
        guildData
    );

    guildData.queuePages.clear();

    if (player.queue) {
        try {
            player.queue.clear();
        } catch (_) {}
    }

    try {
        if (
            typeof player.stop ===
            "function" &&
            player.current
        ) {
            await player.stop();
        }
    } catch (_) {}

    try {
        if (
            typeof player.destroy ===
            "function"
        ) {
            await player.destroy();
        }
    } catch (_) {}

    return successEmbed(
        "Stopped",
        "Music playback has been stopped."
    );
}

/* =========================================================
   LEAVE
========================================================= */

async function leaveVoiceChannel(
    client,
    interaction
) {
    const guildId =
        interaction.guild.id;

    const player =
        getPlayer(
            client,
            guildId
        );

    if (!player) {
        return successEmbed(
            "Not Connected",
            "The bot is not connected to a music voice channel."
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

    clearUpdateInterval(
        guildData
    );

    guildData.queuePages.clear();

    try {
        if (
            typeof player.destroy ===
            "function"
        ) {
            await player.destroy();
        }
    } catch (_) {}

    return successEmbed(
        "Left Voice Channel",
        "Disconnected from the voice channel."
    );
}

/* =========================================================
   QUEUE
========================================================= */

function getQueueTracks(player) {
    if (!player?.queue) {
        return [];
    }

    try {
        return [
            ...player.queue
        ];
    } catch (_) {
        return [];
    }
}

function buildQueueReply(
    client,
    guildId,
    page = 0
) {
    const player =
        getPlayer(
            client,
            guildId
        );

    if (!player) {
        throw new MusicError(
            "No player",
            "No active music player."
        );
    }

    const guildData =
        getGuildMusicData(
            guildId
        );

    const queue =
        getQueueTracks(
            player
        );

    const pageSize =
        getQueuePageSize();

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                queue.length /
                pageSize
            )
        );

    const safePage =
        Math.max(
            0,
            Math.min(
                Number(page) || 0,
                totalPages - 1
            )
        );

    guildData.queuePages.forEach(
        (value, userId) => {
            if (
                !Number.isInteger(
                    value
                )
            ) {
                guildData.queuePages.set(
                    userId,
                    0
                );
            }
        }
    );

    const embed =
        buildQueueEmbed(
            queue,
            player.current,
            safePage
        );

    const components = [];

    if (totalPages > 1) {
        components.push(
            buildQueuePaginationRow(
                safePage,
                totalPages
            )
        );
    }

    return {
        embeds: [
            embed
        ],
        components
    };
}

/* =========================================================
   NOW PLAYING
========================================================= */

function buildNowPlayingReply(
    client,
    guildId
) {
    const player =
        getPlayer(
            client,
            guildId
        );

    if (!player) {
        throw new MusicError(
            "No player",
            "No active music player."
        );
    }

    const guildData =
        getGuildMusicData(
            guildId
        );

    const embed =
        buildNowPlayingEmbed(
            player,
            player.current,
            guildData
        );

    return {
        embeds: [
            embed
        ]
    };
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  MAX_WATCH_LINKS,

  createLive,

  getLive,

  getCurrentVideo,

  nextVideo,

  addRandomMedia,

  getRandomMediaList,

  startRandomMode,

  pauseLive,

  resumeLive,

  stopLive,

  clearLive
};
