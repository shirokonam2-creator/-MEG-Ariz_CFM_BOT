const queues = new Map();

/**
 * Lấy queue của server
 */
function getQueue(guildId) {
  if (!queues.has(guildId)) {
    queues.set(guildId, []);
  }

  return queues.get(guildId);
}

/**
 * Thêm bài vào queue
 */
function addToQueue(guildId, track) {
  const queue = getQueue(guildId);

  queue.push(track);

  return queue;
}

/**
 * Lấy bài tiếp theo
 */
function getNextTrack(guildId) {
  const queue = getQueue(guildId);

  if (queue.length === 0) {
    return null;
  }

  return queue.shift();
}

/**
 * Xem bài tiếp theo nhưng không xóa
 */
function peekNextTrack(guildId) {
  const queue = getQueue(guildId);

  return queue[0] || null;
}

/**
 * Xem toàn bộ queue
 */
function getQueueTracks(guildId) {
  return [...getQueue(guildId)];
}

/**
 * Xóa toàn bộ queue
 */
function clearQueue(guildId) {
  queues.set(guildId, []);

  return true;
}

/**
 * Xóa một bài theo vị trí
 */
function removeFromQueue(guildId, index) {
  const queue = getQueue(guildId);

  if (
    index < 0 ||
    index >= queue.length
  ) {
    return null;
  }

  return queue.splice(index, 1)[0];
}

/**
 * Đổi vị trí bài hát
 */
function moveInQueue(
  guildId,
  fromIndex,
  toIndex
) {
  const queue = getQueue(guildId);

  if (
    fromIndex < 0 ||
    fromIndex >= queue.length ||
    toIndex < 0 ||
    toIndex >= queue.length
  ) {
    return false;
  }

  const [track] =
    queue.splice(fromIndex, 1);

  queue.splice(toIndex, 0, track);

  return true;
}

/**
 * Xáo trộn queue
 */
function shuffleQueue(guildId) {
  const queue = getQueue(guildId);

  for (
    let i = queue.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      queue[i],
      queue[j]
    ] = [
      queue[j],
      queue[i]
    ];
  }

  return queue;
}

/**
 * Số lượng bài đang chờ
 */
function getQueueSize(guildId) {
  return getQueue(guildId).length;
}

/**
 * Kiểm tra queue có rỗng không
 */
function isQueueEmpty(guildId) {
  return getQueueSize(guildId) === 0;
}

/**
 * Xóa queue khỏi bộ nhớ
 */
function deleteQueue(guildId) {
  queues.delete(guildId);
}

/**
 * Lấy vị trí của bài hát
 */
function findTrackIndex(
  guildId,
  track
) {
  const queue = getQueue(guildId);

  return queue.indexOf(track);
}

module.exports = {
  getQueue,
  addToQueue,
  addTrack: addToQueue,

  getNextTrack,
  peekNextTrack,
  getQueueTracks,

  clearQueue,

  removeFromQueue,
  removeTrack: removeFromQueue,

  moveInQueue,
  shuffleQueue,

  getQueueSize,
  isQueueEmpty,

  deleteQueue,
  findTrackIndex
};
