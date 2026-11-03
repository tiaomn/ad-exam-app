# 广告设计师三级 · 全库随机抽题

纯本地离线的刷题 App，题库 **580 道**（单选 376 / 判断 98 / 多选 106），每套随机抽取 **100 题**（单选 67 / 判断 17 / 多选 16）。

- 无 CDN、无网络请求、无广告、无账号
- 自动计算正确率、错误率、答对/答错/未答
- localStorage 保存历次成绩与错题
- 错题本支持筛选、错题练习、答对移出
- Android / iPhone 响应式布局，支持刘海安全区

## 上传到 GitHub 后

### Android APK

1. 仓库打开 **Actions**
2. 左侧选 **打包 Android APK**
3. 右侧 **Run workflow → Run workflow**
4. 等 5～10 分钟，在运行记录底部下载 `ad-exam-apk.zip`
5. 解压得到 `ad-exam.apk`，传到安卓手机安装

不需要安装 Android Studio。APK 是 Debug 签名，可直接安装，不适合上架应用商店。

### iPhone

1. 仓库 **Settings → Pages**，Source 选 **GitHub Actions**
2. **Actions → 发布 iPhone 可安装网页版 → Run workflow**
3. iPhone 用 Safari 打开 Pages 网址
4. 分享 → **添加到主屏幕**

首次联网打开后会缓存，之后断网可用。原生 `.ipa` 需要苹果开发者账号和签名，无法用公共 CI 直接生成可安装包。

## 目录说明

| 路径 | 用途 |
|---|---|
| `www/` | App 本体、PWA 配置、离线缓存、图标 |
| `assets/android/` | Android 各密度图标 |
| `assets/splash.png` | Android 启动图 |
| `tools/apply-android-assets.mjs` | 把图标写入 Capacitor 生成的 Android 工程 |
| `src/` + `tools/build.py` | 重新生成 `www/index.html`（发布 PWA 时用） |
| `.github/workflows/build-apk.yml` | 云端编译 APK |
| `.github/workflows/deploy-pwa.yml` | 云端发布 iPhone 网页版 |

## 兼容性

- Android 34 只对应 **Capacitor 6.x**
- Capacitor 7.x 强制要求 **compileSdk 35**
- 当前 `package.json` 是 Capacitor 7，构建 APK 时会自动补装 SDK 35；要严格使用 Android 34，请把 Capacitor 固定到 6.x

## 本地重新生成网页

```bash
python tools/build.py
```

需要 Python 3；该脚本不依赖第三方库。
