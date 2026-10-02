const fs = require("fs");
const path = require("path");
const { Innertube, Platform } = require("youtubei.js/web");

Platform.shim.eval = async (data) => {
  return new Function(data.output)();
};


// ========================================
// ĐƯỜNG DẪN LƯU CREDENTIALS
// ========================================

const DATA_DIR =
  process.env.YOUTUBE_DATA_DIR ||
  (process.env.RAILWAY_ENVIRONMENT
    ? "/data"
    : path.join(__dirname, "data"));

const CREDENTIALS_FILE = path.join(
  DATA_DIR,
  "youtube_oauth.json"
);

let youtube = null;
let youtubePromise = null;

// ========================================
// ĐỌC CREDENTIALS
// ========================================

function loadCredentials() {
  try {
    if (!fs.existsSync(CREDENTIALS_FILE)) {
      return {};
    }

    const content = fs
      .readFileSync(CREDENTIALS_FILE, "utf8")
      .trim();

    if (!content) return {};

    const data = JSON.parse(content);

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      return {};
    }

    return data;
  } catch (error) {
    console.error(
      "❌ Không đọc được YouTube credentials:",
      error.message
    );

    return {};
  }
}

// ========================================
// LƯU CREDENTIALS
// ========================================

function saveCredentials(credentials) {
  if (
    !credentials ||
    typeof credentials !== "object"
  ) {
    return;
  }

  try {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });

    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(credentials, null, 2),
      "utf8"
    );

    console.log(
      "💾 Đã lưu YouTube credentials."
    );
  } catch (error) {
    console.error(
      "❌ Không lưu được credentials:",
      error.message
    );

    console.error(
      "⚠️ Hãy kiểm tra thư mục lưu và Railway Volume."
    );
  }
}

// ========================================
// KHỞI TẠO YOUTUBE OAUTH
// ========================================

async function getYouTube() {
  if (youtube) {
    return youtube;
  }

  if (youtubePromise) {
    return youtubePromise;
  }

  youtubePromise = (async () => {
    const client = await Innertube.create({
      retrieve_player: true
    });

    const session = client.session;

    if (!session) {
      throw new Error(
        "Không tìm thấy YouTube session."
      );
    }

    // ------------------------------------
    // HIỂN THỊ MÃ XÁC MINH
    // ------------------------------------

    session.on("auth-pending", data => {
      console.log("");
      console.log(
        "===================================="
      );
      console.log(
        "🔐 YOUTUBE ĐANG CHỜ XÁC MINH"
      );
      console.log(
        "🌐 Trang xác minh:"
      );
      console.log(
        data.verification_url
      );
      console.log(
        "🔢 MÃ XÁC MINH:"
      );
      console.log(
        data.user_code
      );
      console.log(
        "===================================="
      );
      console.log("");
    });

    // ------------------------------------
    // ĐĂNG NHẬP THÀNH CÔNG
    // ------------------------------------

    session.on("auth", data => {
      console.log(
        "✅ YouTube OAuth đã xác thực thành công."
      );

      if (data?.credentials) {
        saveCredentials(data.credentials);
      }
    });

    // ------------------------------------
    // LỖI XÁC THỰC
    // ------------------------------------

    session.on("auth-error", error => {
      console.error(
        "❌ YouTube OAuth error:",
        error?.message || error
      );
    });

    // ------------------------------------
    // CẬP NHẬT CREDENTIALS
    // ------------------------------------

    session.on(
      "update-credentials",
      data => {
        if (data?.credentials) {
          saveCredentials(data.credentials);
        }
      }
    );

    // ------------------------------------
    // ĐĂNG NHẬP
    // ------------------------------------

    const credentials = loadCredentials();

    if (Object.keys(credentials).length > 0) {
      try {
        console.log(
          "🔑 Đang thử credentials đã lưu..."
        );

        await session.signIn(credentials);

        console.log(
          "✅ Đã đăng nhập bằng credentials đã lưu."
        );
      } catch (error) {
        console.error(
          "⚠️ Credentials cũ không dùng được:",
          error?.message || error
        );

        console.log(
          "🔄 Đang thử yêu cầu xác minh mới..."
        );

        await session.signIn();
      }
    } else {
      console.log(
        "🔐 Đang yêu cầu mã xác minh YouTube..."
      );

      await session.signIn();
    }

    youtube = client;

    return client;
  })();

  try {
    return await youtubePromise;
  } catch (error) {
    youtubePromise = null;

    console.error(
      "❌ Không khởi tạo được YouTube:",
      error?.message || error
    );

    throw error;
  } finally {
    // Cho phép thử lại nếu khởi tạo thất bại.
    if (!youtube) {
      youtubePromise = null;
    }
  }
}

// ========================================
// EXPORT
// ========================================

module.exports = {
  getYouTube,
  loadCredentials,
  saveCredentials
};
