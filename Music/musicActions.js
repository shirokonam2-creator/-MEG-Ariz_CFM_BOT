const { PermissionFlagsBits } = require("discord.js");

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

/* =========================
   ERROR
========================= */

class MusicError extends Error {
    constructor(title, message) {
        super(message);
        this.name = "MusicError";
        this.title = title;
    }
}

/* =========================
   EMBED
========================= */

function successEmbed(title, description) {
    const {
        EmbedBuilder
    } = require("discord.js");

    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x57f287);
}

/* =========================
   LAVALINK
========================= */

function getConnectedLavalinkNodes(client) {
    if (!client.riffy?.nodeMap) {
        return [];
    }

    return [
        ...client.riffy.nodeMap.values()
    ].filter(
        node => node.connected
    );
}

function assertRiffyAvailable(client) {
    if (!client.riffy) {
        throw new MusicError(
            "Lavalink unavailable",
            "Music is unavailable because Lavalink has not been configured."
        );
    }
}

function assertLavalinkNodeAvailable(client) {
    if (
        !getConnectedLavalinkNodes(client).length
    ) {
        throw new MusicError(
            "Lavalink unavailable",
            "No Lavalink nodes are connected."
        );
    }
}

/* =========================
   VOICE
========================= */

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

function canControlMusic(
    member,
    player
) {
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

function assertCanControl(
    member,
    player
) {
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

function assertBotVoicePermissions(
    channel
) {
    if (!channel) {
        throw new MusicError(
            "Voice channel unavailable",
            "Could not access that voice channel."
        );
    }

    const permissions =
        channel.permissionsFor(
            channel.client.user
        );

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

/* =========================
   PLAYER
========================= */

function getPlayer(
    client,
    guildId
) {
    return (
        client.riffy?.players?.get(
            guildId
        ) || null
    );
}

async function waitForPlayerConnection(
    player
) {
    if (player.connected) {
        return;
    }

    try {
        await player.connection.resolve();
    } catch {}

    if (player.connected) {
        return;
    }

    await new Promise(resolve => {
        let finished = false;

        const finish = () => {
            if (finished) return;

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

async function startPlayback(
    player
) {
    await waitForPlayerConnection(
        player
    );

    await player.play();
}

/* =========================
   ENSURE PLAYER
========================= */

async function ensurePlayer(
    client,
    interaction
) {
    assertRiffyAvailable(client);
    assertLavalinkNodeAvailable(client);

    assertInVoice(
        interaction.member
    );

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

    if (!player) {
        player =
            client.riffy.createConnection(
                {
                    guildId,

                    voiceChannel:
                        interaction.member
                            .voice
                            .channel
                            .id,

                    textChannel:
                        interaction.channel.id,

                    deaf: true
                }
            );

        guildData.playerChannelId =
            interaction.channel.id;
    }

    player.setVolume(
        guildData.volume
    );

    return {
        player,
        guildData
    };
}

/* =========================
   DUPLICATE
========================= */

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
        player.current?.info
            ?.uri === uri
    ) {
        return true;
    }

    return player.queue.some(
        existing =>
            existing.info?.uri ===
            uri
    );
}

/* =========================
   VOICE PERMISSIONS
========================= */

function hasVoicePermissions(
    channel
) {
    if (!channel) {
        return false;
    }

    const permissions =
        channel.permissionsFor(
            channel.client.user
        );

    if (!permissions) {
        return false;
    }

    return (
        permissions.has(
            PermissionFlagsBits.Connect
        ) &&
        permissions.has(
            PermissionFlagsBits.Speak
        )
    );
}

/* =========================
   JOIN
========================= */

async function joinVoiceChannel(
    client,
    interaction
) {
    assertRiffyAvailable(client);

    assertInVoice(
        interaction.member
    );

    const guildId =
        interaction.guild.id;

    const guildData =
        getGuildMusicData(
            guildId
        );

    const channel =
        interaction.member
            .voice.channel;

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
            player.destroy();
        } catch {}

        player = null;
    }

    if (!player) {
        player =
            client.riffy.createConnection(
                {
                    guildId,

                    voiceChannel:
                        channel.id,

                    textChannel:
                        interaction.channel.id,

                    deaf: true
                }
            );

        guildData.playerChannelId =
            interaction.channel.id;
    }

    player.setVolume(
        guildData.volume
    );

    return successEmbed(
        "Joined Voice Channel",
        `Connected to **${channel.name}**.`
    );
}

/* =========================
   PLAY
========================= */

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

    /*
     * Chỉ cho YouTube
     */

    if (
        !YOUTUBE_URL_PATTERN.test(
            query
        )
    ) {
        /*
         * Tên bài hát:
         * tìm trên YouTube
         */
        query =
            `ytsearch:${query}`;
    }

    const {
        player,
        guildData
    } = await ensurePlayer(
        client,
        interaction
    );

    const result =
        await client.riffy.resolve(
            {
                query,

                requester:
                    interaction.user
            }
        );

    if (!result) {
        throw new MusicError(
            "Lavalink error",
            "Lavalink did not return a result."
        );
    }

    const {
        loadType,
        tracks,
        playlistInfo
    } = result;

    /*
     * EMPTY / ERROR
     */

    if (
        loadType === "empty" ||
        loadType === "LOAD_FAILED" ||
        loadType === "error" ||
        !tracks?.length
    ) {
        throw new MusicError(
            "No results",
            "No YouTube results found."
        );
    }

    /*
     * PLAYLIST
     */

    if (
        loadType === "playlist" ||
        loadType ===
            "PLAYLIST_LOADED"
    ) {
        let added = 0;
        let skipped = 0;

        for (
            const track of tracks
        ) {
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
            player.queue.length
        ) {
            await startPlayback(
                player
            );
        }

        return {
            embeds: [
                successEmbed(
                    "Playlist Added",

                    `**${
                        playlistInfo
                            ?.name ||
                        "Playlist"
                    }**\n` +
                    `Added ${added} track(s).` +
                    (
                        skipped
                            ? ` Skipped ${skipped} duplicate(s).`
                            : ""
                    )
                )
            }
    };

    /*
     * SINGLE TRACK
     */

    if (
        loadType === "search" ||
        loadType === "track" ||
        loadType ===
            "SEARCH_RESULT" ||
        loadType ===
            "TRACK_LOADED"
    ) {
        const track =
            tracks?.[0];

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
                `**${track.info.title}** is already playing or in the queue.`
            );
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
            embeds: [
                successEmbed(
                    willPlayNow
                        ? "Now Playing"
                        : "Track Added",

                    willPlayNow
                        ? `**${track.info.title}**\n${track.info.author || "Unknown"}`
                        : `**${track.info.title}**\n${track.info.author || "Unknown"}\nPosition: #${queuePosition}`
                )
            ]  
        };

    throw new MusicError(
        "No results",
        `No results found. (${loadType || "unknown"})`
    );
}

/* =========================
   SKIP
========================= */

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
        player.current.info
            ?.title ||
        "Unknown";

    if (
        player.loop === "track"
    ) {
        player.setLoop(
            "none"
        );

        getGuildMusicData(
            interaction.guild.id
        ).loop = "none";
    }

    player.stop();

    return successEmbed(
        "Skipped",
        `Skipped **${title}**.`
    );
}

/* =========================
   PAUSE
========================= */

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

    player.pause(true);

    return true;
}

/* =========================
   RESUME
========================= */

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

    player.pause(false);

    return true;
}

/* =========================
   PAUSE COMMAND
========================= */

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

    await applyPause(
        client,
        interaction.guild.id
    );

    return successEmbed(
        "Paused",
        "Playback paused."
    );
}

/* =========================
   RESUME COMMAND
========================= */

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

    await applyResume(
        client,
        interaction.guild.id
    );

    return successEmbed(
        "Resumed",
        "Playback resumed."
    );
}

/* =========================
   SHUFFLE
========================= */

async function shuffleQueue(
    client,
    interaction
) {
    const player =
        getPlayer(
            client,
            interaction.guild.id
        );

    if (
        !player?.queue?.length
    ) {
        throw new MusicError(
            "Empty queue",
            "The queue is empty."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    player.queue.shuffle();

    getGuildMusicData(
        interaction.guild.id
    ).shuffle = true;

    return successEmbed(
        "Shuffled",
        "The queue has been shuffled."
    );
}

/* =========================
   LOOP
========================= */

async function setLoopMode(
    client,
    interaction,
    mode
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

    const validModes = [
        "none",
        "track",
        "queue"
    ];

    if (
        !validModes.includes(mode)
    ) {
        throw new MusicError(
            "Invalid loop mode",
            "Loop mode must be none, track or queue."
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
        `Loop mode set to **${
            labels[mode]
        }**.`
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

    const next =
        guildData.loop === "none"
            ? "track"
            : guildData.loop === "track"
                ? "queue"
                : "none";

    return setLoopMode(
        client,
        interaction,
        next
    );
}

/* =========================
   VOLUME
========================= */

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

    volume =
        Number(volume);

    if (
        !Number.isFinite(volume)
    ) {
        throw new MusicError(
            "Invalid volume",
            "Volume must be a number."
        );
    }

    const guildData =
        getGuildMusicData(
            interaction.guild.id
        );

    guildData.volume =
        Math.max(
            0,
            Math.min(
                100,
                Math.round(volume)
            )
        );

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

/* =========================
   QUEUE
========================= */

function buildQueueReply(
    client,
    interaction,
    page = 1
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

    const queue =
        player.queue?.toArray
            ? player.queue.toArray()
            : Array.from(
                player.queue || []
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
            1,
            Math.min(
                Number(page) || 1,
                totalPages
            )
        );

    const embed =
        buildQueueEmbed(
            player,
            safePage
        );

    const components = [];

    if (
        totalPages > 1
    ) {
        components.push(
            buildQueuePaginationRow(
                safePage,
                totalPages
            )
        );
    }

    return {
        embeds: [embed],
        components
    };
}

/* =========================
   NOW PLAYING
========================= */

function buildNowPlayingReply(
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

    const embed =
        buildNowPlayingEmbed(
            player
        );

    return {
        embeds: [embed]
    };
}

/* =========================
   STOP
========================= */

async function stopPlayback(
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

    const guildId =
        interaction.guild.id;

    try {
        player.queue.clear();
    } catch {}

    try {
        player.stop();
    } catch {}

    const guildData =
        getGuildMusicData(
            guildId
        );

    guildData.loop =
        "none";

    guildData.shuffle =
        false;

    clearUpdateInterval(
        guildId
    );

    return successEmbed(
        "Stopped",
        "Music playback has been stopped and the queue has been cleared."
    );
}

/* =========================
   LEAVE
========================= */

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
        throw new MusicError(
            "Not connected",
            "The bot is not connected to a voice channel."
        );
    }

    assertCanControl(
        interaction.member,
        player
    );

    try {
        player.queue.clear();
    } catch {}

    clearUpdateInterval(
        guildId
    );

    try {
        player.destroy();
    } catch {}

    return successEmbed(
        "Left Voice Channel",
        "Disconnected from the voice channel."
    );
}

/* =========================
   EXPORTS
========================= */

module.exports = {
    MusicError,

    getConnectedLavalinkNodes,

    assertRiffyAvailable,

    assertLavalinkNodeAvailable,

    getPlayer,

    hasVoicePermissions,

    ensurePlayer,

    joinVoiceChannel,

    playQuery,

    skipTrack,

    applyPause,

    applyResume,

    pausePlayback,

    resumePlayback,

    shuffleQueue,

    setLoopMode,

    toggleLoop,

    setVolume,

    adjustVolume,

    stopPlayback,

    leaveVoiceChannel,

    buildQueueReply,

    buildNowPlayingReply,

    startPlayback
}; 
