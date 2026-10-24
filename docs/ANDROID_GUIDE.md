# 将扫雷 Web 应用打包成 Android App 指南

本项目是**零依赖**的纯 HTML + CSS + JavaScript，非常适合封装成安卓应用。下方是打包方案与实施步骤。

---

## 一、方案选型（推荐顺序）

### 方案 A：Android WebView 封装（推荐，最可控）
用 Android Studio 建一个空项目，用一个 `WebView` 加载本地 HTML 文件，打包成 APK。

**优点**：全离线、无第三方框架、代码完全掌控、APK 体积小（约 2~3MB）。
**缺点**：需要安装 Android Studio、了解一点 Java/Kotlin。

### 方案 B：Capacitor（Ionic）封装（次推荐，最快）
`npx cap init` + 把网页放进 `web` 目录，`npx cap add android` + `npx cap sync` 即可生成安卓壳项目，最后用 Android Studio 打包。

**优点**：命令少、社区成熟、方便以后加原生能力（震动、触摸反馈等）。
**缺点**：引入 node 生态依赖。

### 方案 C：Cordova（类似 Capacitor 的老牌方案）
同上，更老，配置繁琐，除非已有 Cordova 经验否则不优先。

### 方案 D：PWA（无需 APK，可从浏览器安装）
添加 `manifest.json` + `service-worker.js`，安卓 Chrome 会提示"**添加到主屏幕**"，安装后可全屏离线运行，像一个 App。

**优点**：零构建、无需开发环境。
**缺点**：不是真正意义上的 APK，依赖浏览器。

---

## 二、推荐实施方案（WebView 封装）逐步说明

### 第 1 步：准备源码目录
把本项目三个文件放进 `android-app/app/src/main/assets/minesweeper/`：
```
minesweeper/
├── minesweeper.html
├── minesweeper.css
└── minesweeper.js
```

### 第 2 步：新建 Android 工程（在 Android Studio）
- `New Project` → 选择 **Empty Views Activity**
- 语言可选 Java 或 Kotlin
- 应用名 "扫雷"，包名如 `com.example.minesweeper`

### 第 3 步：修改布局 `activity_main.xml`
用一个 WebView 填满全屏：
```xml
<WebView
    android:id="@+id/webview"
    android:layout_width="match_parent"
    android:layout_height="match_parent" />
```

### 第 4 步：MainActivity 加载本地网页
**Java 版：**
```java
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        WebView wv = new WebView(this);
        setContentView(wv);

        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        // 关掉双击缩放、设为手机视口
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        wv.setWebViewClient(new WebViewClient());
        wv.loadUrl("file:///android_asset/minesweeper/minesweeper.html");
    }
}
```

### 第 5 步：AndroidManifest 配置
在 `<application>` 内加 `android:usesCleartextTraffic` 不需要（本地文件），但要允许全屏/横竖屏：
```xml
<activity
    android:name=".MainActivity"
    android:screenOrientation="portrait" />
```

### 第 6 步：打包
- `Build` → `Generate Signed Bundle / APK`
- 生成密钥（或调试签名）→ 得到 **.apk** 直接安装到手机。

---

## 三、触摸交互改造（本项目的关键适配）

安卓没有「右键」，本项目做了以下映射：

| 桌面（网页版） | 安卓触摸 |
| -------------- | -------- |
| 左键单击 | **单击**（点一下） |
| 右键单击插旗 | **长按**（按住约 450ms 不移动） |
| 左键长按拖动连续插旗 | **触摸拖动** 插旗 |
| 拖 🚩 图标放旗 | **触摸拖动 🚩** 图标放旗 |

实现方式：用 **Pointer Events**（`pointerdown/move/up`）统一鼠标和触摸，再加一个**长按定时器**识别"长按=插旗"。已内置到 `minesweeper.js`，网页版（右键）与安卓版（长按）同时可用。

### 触控相关的 CSS（已在 `minesweeper.css`）
- `touch-action: manipulation` 去掉 300ms 点击延迟与双击缩放
- 棋盘视需要加 `overflow`，避免小屏误触发页面滚动
- 用 `-webkit-tap-highlight-color: transparent` 去掉触摸高亮

---

## 四、打包后的可优化点（可选，非必需）
- **手机震动/提示**：在长按插旗时，通过原生桥（Capacitor 插件或 WebView `@JavascriptInterface`）触发震动反馈
- **状态栏沉浸**：`EdgeToEdge` 让棋盘顶到状态栏/导航栏
- **后台计时**：切到后台暂停计时（需要在 `onPause/onResume` 里处理）
- **自适应网格**：按屏幕宽度自动调整 `--cell-size`，保证小屏完整显示棋盘

---

## 五、快速启动建议

如果只是**想先在真机上试效果**，最快路径：
1. 打开 `minesweeper.html` → 用 Chrome → 菜单「添加到主屏幕」（先加 PWA manifest）
2. 或直接浏览器访问该文件，体验触摸交互是否顺手

若确定要正式 APK，直接走 **方案 A（WebView）**，OneActivity 约 20 分钟搞定。

---

## 六、本仓库里的交付物
- `minesweeper.js` — 已加触摸（Pointer + 长按）支持
- `minesweeper.css` — 已加触控优化（禁缩放、去点按高亮等）
- 其他文件不变，直接进 assets 即可打包