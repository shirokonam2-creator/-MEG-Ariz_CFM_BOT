// ========================================
// Live.js
// Quản lý Live + Random video/nhạc
// ========================================

const {
  createVideoLinks
} = require("./Linkvideo");

const {
  normalizeName
} = require("./namevideo");

const {
  createPlayOrder,
  getNextIndex,
  getVideoByOrder,
  MAX_WATCH_LINKS
} = require("./Thutuphat");

let activeLive = null;

// ========================================
// Danh sách Random
// ========================================
//
// Có thể thêm nguồn video/nhạc hợp pháp vào đây.
// type:
//   "video"
//   "music"
//
// url:
//   URL nguồn phát
//
// name:
//   tên nội dung
//

const randomMedia = [
  // Ví dụ:
  // {
  //   type: "video",
  //   name: "Video mẫu",
  //   url: "https://example.com/video.mp4"
  // },
  //
  // {
  //   type: "music",
  //   name: "Nhạc mẫu",
  //   url: "https://example.com/music.mp3"
  // }
];

// ========================================
// Tạo Live
// ========================================

function createLive({
  owner,
  voiceChannel,
  videoName,
  links
}) {

  if (!Array.isArray(links)) {
    throw new Error(
      "Danh sách link không hợp lệ."
    );
  }

  if (links.length === 0) {
    throw new Error(
      "Phải có ít nhất 1 link video."
    );
  }

  // Không cho quá 3 link
  if (links.length > MAX_WATCH_LINKS) {
    throw new Error(
      `Chỉ được tối đa ${MAX_WATCH_LINKS} link video.`
    );
  }

  const videoLinks =
    createVideoLinks(links);

  const name =
    normalizeName(videoName);

  const playOrder =
    createPlayOrder(videoLinks);

  activeLive = {

    owner,

    voiceChannel,

    videoName: name,

    videos: videoLinks,

    playOrder,

    currentIndex: 0,

    status: "playing",

    mode: "watch",

    randomMedia: null,

    createdAt: Date.now()
  };

  return activeLive;
}

// ========================================
// Lấy Live
// ========================================

function getLive() {
  return activeLive;
}

// ========================================
// Video hiện tại
// ========================================

function getCurrentVideo() {

  if (!activeLive) {
    return null;
  }

  // Đang phát 3 link của /watch
  if (activeLive.mode === "watch") {

    return getVideoByOrder(
      activeLive.videos,
      activeLive.currentIndex
    );
  }

  // Đang Random
  if (activeLive.mode === "random") {

    return activeLive.randomMedia;
  }

  return null;
}

// ========================================
// Chọn Random
// ========================================

function getRandomMedia() {

  if (randomMedia.length === 0) {
    return null;
  }

  const index =
    Math.floor(
      Math.random() * randomMedia.length
    );

  return randomMedia[index];
}

// ========================================
// Chuyển sang Random
// ========================================

function startRandomMode() {

  if (!activeLive) {
    return null;
  }

  const media =
    getRandomMedia();

  if (!media) {

    activeLive.mode = "random";

    activeLive.status = "waiting";

    activeLive.randomMedia = null;

    return null;
  }

  activeLive.mode = "random";

  activeLive.status = "playing";

  activeLive.randomMedia = media;

  return media;
}

// ========================================
// Video tiếp theo
// ========================================

function nextVideo() {

  if (!activeLive) {
    return null;
  }

  // -------------------------------
  // WATCH MODE
  // -------------------------------

  if (activeLive.mode === "watch") {

    const nextIndex =
      getNextIndex(
        activeLive.currentIndex,
        activeLive.videos.length
      );

    // Hết 3 link
    if (nextIndex === -1) {

      return startRandomMode();
    }

    activeLive.currentIndex =
      nextIndex;

    activeLive.status =
      "playing";

    return getCurrentVideo();
  }

  // -------------------------------
  // RANDOM MODE
  // -------------------------------

  if (activeLive.mode === "random") {

    return startRandomMode();
  }

  return null;
}

// ========================================
// Thêm nguồn Random
// ========================================

function addRandomMedia({
  type,
  name,
  url
}) {

  if (
    type !== "video" &&
    type !== "music"
  ) {
    throw new Error(
      'type phải là "video" hoặc "music".'
    );
  }

  if (!name || !url) {
    throw new Error(
      "Thiếu tên hoặc URL."
    );
  }

  randomMedia.push({
    type,
    name,
    url
  });

  return randomMedia[
    randomMedia.length - 1
  ];
}

// ========================================
// Lấy danh sách Random
// ========================================

function getRandomMediaList() {
  return randomMedia;
}

// ========================================
// Pause
// ========================================

function pauseLive() {

  if (!activeLive) {
    return false;
  }

  activeLive.status = "paused";

  return true;
}

// ========================================
// Resume
// ========================================

function resumeLive() {

  if (!activeLive) {
    return false;
  }

  activeLive.status = "playing";

  return true;
}

// ========================================
// Stop
// ========================================

function stopLive() {

  if (!activeLive) {
    return false;
  }

  activeLive.status = "stopped";

  return true;
}

// ========================================
// Xóa Live
// ========================================

function clearLive() {
  activeLive = null;
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
