# iPhone / iOS 说明

## 推荐：添加到主屏幕（不需要开发者账号）

项目已经包含 PWA 配置和 Service Worker。把 `www` 发布到 GitHub Pages 后：

1. iPhone 用 **Safari** 打开 Pages 地址。
2. 点底部 **分享** → **添加到主屏幕**。
3. 首次联网打开后，页面会被缓存；之后断网也能打开。
4. 图标、启动画面和全屏显示都由 `manifest.webmanifest` 控制。

这是目前没有苹果开发者账号时，最接近原生 App 的安装方式。

## 原生 iOS（需要 Mac + 苹果账号）

苹果不允许安装未签名的 `.ipa`，所以原生安装必须经过签名。需要：

- 一台 Mac，安装 Xcode；
- 一个 Apple ID（免费账号可在自己的 iPhone 上安装，证书 7 天有效）；
- 或 Apple Developer 付费账号（$99/年，可 TestFlight / 上架）。

在 Mac 上执行：

```bash
npm install
npx cap add ios
npx cap sync ios
node tools/apply-ios-assets.mjs
npx cap open ios
```

然后在 Xcode 中：

1. 选中 `App` 工程 → **Signing & Capabilities**；
2. 选择自己的 Team；
3. 把 iPhone 连上 Mac，选择该设备；
4. 点 Run，Xcode 会完成签名并安装。

没有 Mac 的用户请不要尝试本地打包 iOS；使用上面的 PWA 方式即可。

## 为什么 GitHub Actions 不直接产出 IPA？

Android 的 Debug APK 可以用公共调试签名直接安装；iOS 的 `.ipa` 必须使用 **你的** Apple 证书和描述文件签名。没有这些密钥，任何云端编译出来的 IPA 都无法安装到 iPhone。把证书上传到公开仓库又有泄露风险，因此本项目没有默认做 iOS 云端签名。
