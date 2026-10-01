const {
  searchYouTube,
  resolveYouTube,
  isYouTubeUrl
} = require("./sources/youtube");


/**
 * Tìm bài hát từ nguồn YouTube
 */
async function searchSong(query) {
  const text = String(query || "").trim();

  if (!text) {
    throw new Error("Bạn chưa nhập tên bài hát.");
  }

  return await searchYouTube(text);
}


/**
 * Lấy thông tin từ URL hoặc tên bài hát
 */
async function resolveSong(input) {
  const text = String(input || "").trim();

  if (!text) {
    throw new Error(
      "Bạn chưa nhập tên bài hát hoặc URL."
    );
  }

  return await resolveYouTube(text);
}


/**
 * Kiểm tra có phải URL YouTube không
 */
function isYouTube(input) {
  return isYouTubeUrl(input);
}


/**
 * Chuẩn hóa thông tin bài hát
 */
function normalizeTrack(track) {
  if (!track) {
    return null;
  }

  return {
    source: track.source || "youtube",
    songName:
      track.songName ||
      track.title ||
      "Không rõ tên bài",
    url: track.url || null,
    videoId: track.videoId || null,
    author:
      track.author ||
      "YouTube",
    thumbnail:
      track.thumbnail ||
      null
  };
}


/**
 * Tìm và chuẩn hóa bài hát
 */
async function findSong(query) {
  const track = await searchSong(query);

  if (!track) {
    return null;
  }

  return normalizeTrack(track);
}


/**
 * Resolve và chuẩn hóa bài hát
 */
async function getSong(input) {
  const track = await resolveSong(input);

  if (!track) {
    return null;
  }

  return normalizeTrack(track);
}


module.exports = {
  searchSong,
  resolveSong,
  isYouTube,
  normalizeTrack,
  findSong,
  getSong
};
