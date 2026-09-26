// playerStore.js
// Quản lý trạng thái Music riêng cho từng server

class GuildMusicData {
    constructor() {
        this.playerMessageId = null;
        this.playerChannelId = null;

        this.autoplay = false;

        // none | track | queue
        this.loop = 'none';

        this.volume = 75;

        this.shuffle = false;

        this.previousTracks = [];

        this.twentyFourSeven = false;

        // Dùng cho phân trang Queue
        this.queuePages = new Map();

        this.updateInterval = null;

        this.idleTimeout = null;

        this.autoPaused = false;

        this.stopConfirmPending = null;
    }
}

const guildStore = new Map();

/**
 * Lấy dữ liệu Music của server.
 * Nếu server chưa có thì tự tạo mới.
 */
function getGuildMusicData(guildId) {
    if (!guildStore.has(guildId)) {
        guildStore.set(guildId, new GuildMusicData());
    }

    return guildStore.get(guildId);
}

/**
 * Xóa interval cập nhật Now Playing.
 */
function clearUpdateInterval(guildData) {
    if (guildData?.updateInterval) {
        clearInterval(guildData.updateInterval);
        guildData.updateInterval = null;
    }
}

/**
 * Xóa toàn bộ dữ liệu Music của server.
 */
function deleteGuildMusicData(guildId) {
    const guildData = guildStore.get(guildId);

    if (guildData) {
        clearUpdateInterval(guildData);

        if (guildData.idleTimeout) {
            clearTimeout(guildData.idleTimeout);
            guildData.idleTimeout = null;
        }
    }

    guildStore.delete(guildId);
}

module.exports = {
    GuildMusicData,
    getGuildMusicData,
    clearUpdateInterval,
    deleteGuildMusicData
}; 
