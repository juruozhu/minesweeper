# 用 GitHub 做开源版本管理 —— 完整操作指南

本项目（经典扫雷 / Minesweeper）当前版本 **v1.1**。下面是从零把它托管到 GitHub 并长期做版本管理的完整流程。

---

## 0. 前置准备

```bash
# 检查 git
git --version

# 必须配置身份（否则无法提交）
git config --global user.name  "你的名字或GitHub用户名"
git config --global user.email "你的邮箱@example.com"

# 建议统一默认分支名为 main
git config --global init.defaultBranch main
```

> 可选但强烈推荐：安装 **GitHub CLI**（`gh`），它能在命令行直接创建远程仓库、建 Release。
> Windows: `winget install GitHub.cli`，然后 `gh auth login`。

---

## 1. 素材说明

项目的美术素材（棋盘数字、红色 LED、黄色笑脸、地雷、旗帜、图标）全部保存在 `assets/` 目录，为独立 PNG 图片，可自由使用与替换。

游戏代码对素材缺失做了**降级兜底**——若 `assets/` 目录不存在：
- 棋盘数字 → 退化为经典配色文字（1蓝/2绿/3红…）
- 计数器/计时 → 退化为普通文字数字
- 笑脸 → 退化为内置 SVG 表情
- 地雷 → 退化为内置 SVG 地雷

所以即使素材缺失，游戏**依然可运行**。

---

## 2. 推荐仓库结构

当前工作区结构已基本可直接用。若想连安卓工程一起开源，建议整理成：

```
minesweeper/
├── web/                      # 网页游戏（可直接双击运行）
│   ├── minesweeper.html
│   ├── minesweeper.css
│   ├── minesweeper.js
│   ├── assets.js
│   └── assets/               # 像素素材（独立 PNG）
├── android/                  # Capacitor 安卓工程源码（不含 build/node_modules）
│   ├── app/
│   ├── build.gradle
│   ├── variables.gradle
│   └── ...
├── docs/
│   ├── ANDROID_GUIDE.md
│   └── GITHUB_GUIDE.md
├── .gitignore
├── LICENSE
└── README.md
```

> 也可以保持现在的扁平结构，把安卓工程源码放进 `android/` 子目录即可。

> 如果嫌麻烦，**保持现在的扁平结构也可以**，只是把 `android/`（源码部分）复制进来即可。

---

## 3. 选择开源许可证（LICENSE）

没有 LICENSE 的仓库在法律上默认"保留所有权利"，别人无法合法使用。常见选择：

| 许可证 | 特点 | 适合 |
|--------|------|------|
| **MIT** | 最宽松，随便用，只需保留版权声明 | ⭐ 个人小项目首选 |
| **Apache-2.0** | 宽松 + 明确的专利授权 | 想更正式一些 |
| **GPL-3.0** | 传染性，衍生作品也必须开源 | 希望改动也开源 |

最简单的做法：在 GitHub 仓库页面 **Add file → Create new file**，文件名写 `LICENSE`，会自动弹出"Choose a license template"。

---

## 4. 本地初始化并首次提交

```bash
cd D:\HTML5

# 初始化仓库
git init

# 查看将要提交的文件（确认 node_modules、build、*.apk 等已被忽略）
git status

# 全部加入暂存区
git add .

# 首次提交
git commit -m "feat: 经典扫雷 v1.1（原版像素素材 + 手机端适配 + 安卓打包）"

# 打个版本标签
git tag -a v1.1 -m "v1.1"
```

验证忽略规则是否生效：

```bash
git status --ignored | findstr apk            # 应显示 apk 被忽略
```

---

## 5. 在 GitHub 创建远程仓库并推送

### 方式 A：网页创建（最简单）

1. 打开 <https://github.com/new>
2. Repository name 填 `minesweeper`（或你喜欢的名字）
3. **不要**勾选 "Add a README"（本地已有）
4. 可见性选 Public
5. 创建后复制仓库地址，然后：

```bash
git remote add origin https://github.com/你的用户名/minesweeper.git
git branch -M main
git push -u origin main
git push origin v1.1        # 推送版本标签
```

### 方式 B：用 gh 命令一步到位

```bash
gh auth login
cd D:\HTML5
git init && git add . && git commit -m "init"
gh repo create minesweeper --public --source=. --remote=origin --push
git tag -a v1.1 -m "v1.1" && git push origin v1.1
```

---

## 6. 日常版本管理流程

```
main        ──●────●────────●────────●──→   稳定版本
                 \        /            \
   feature/xxx    ●──●──●              ●    开发分支
```

**推荐做法（Git Flow 简化版）：**

```bash
# 1) 开发新功能时建分支
git checkout -b feature/添加音效

# 2) 改完提交
git add .
git commit -m "feat: 添加踩雷音效"

# 3) 推送到远程
git push -u origin feature/添加音效

# 4) 在 GitHub 上发起 Pull Request → 合并到 main

# 5) 合并后本地同步
git checkout main
git pull
```

**提交信息规范（Conventional Commits，利于自动生成更新日志）：**

| 前缀 | 用途 | 示例 |
|------|------|------|
| `feat:` | 新功能 | `feat: 增加自定义难度上限到 20` |
| `fix:` | 修复 bug | `fix: 胜利表情错显示为 X_X` |
| `docs:` | 文档 | `docs: 更新 README 操作说明` |
| `style:` | 格式（不影响逻辑） | `style: 调整缩进` |
| `refactor:` | 重构 | `refactor: 抽取表情映射表` |
| `chore:` | 杂项（构建/依赖） | `chore: 升级版本到 1.2` |

---

## 7. 发版流程（每次升级版本号）

以升到 v1.2 为例：

```bash
# 1) 改安卓版本号（android/app/build.gradle）
#    versionCode 3
#    versionName "1.2"

# 2) 同步网页改动到 android/app/src/main/assets/public  (npx cap sync android)

# 3) 重新构建 APK → 输出 扫雷-v1.2.apk

# 4) 提交并打标签
git add .
git commit -m "chore: 升级版本到 1.2"
git tag -a v1.2 -m "v1.2"
git push origin main
git push origin v1.2
```

**5) 在 GitHub 发布 Release（把 APK 挂上去，而不是提交进仓库）：**

网页方式：仓库 → **Releases → Draft a new release** → 选 tag `v1.2` → 上传 `扫雷-v1.2.apk` → 写更新说明 → Publish。

或用 gh：

```bash
gh release create v1.2 "D:\HTML5\扫雷-v1.2.apk" \
  --title "v1.2" \
  --notes "更新内容：..."
```

> `.gitignore` 已排除 `*.apk`，所以 APK 不会进入仓库历史，不占空间；通过 Release 分发是标准做法。

---

## 8. 常见问题

**Q：push 时要求输入密码？**
A：GitHub 已不支持密码推送。要改用 **Personal Access Token**（Settings → Developer settings → Personal access tokens → 生成，勾选 `repo`），或配置 SSH 密钥：

```bash
ssh-keygen -t ed25519 -C "你的邮箱"
# 把 ~/.ssh/id_ed25519.pub 内容贴到 GitHub → Settings → SSH and GPG keys
git remote set-url origin git@github.com:你的用户名/minesweeper.git
```

**Q：不小心把 node_modules 提交了？**
A：确认 `.gitignore` 已写对，然后：

```bash
git rm -r --cached node_modules
git commit -m "chore: 移除误提交的 node_modules"
```

**Q：想加个自动构建 APK 的 CI？**
A：可加 `.github/workflows/build.yml`，用 GitHub Actions 自动编译 APK 并附加到 Release（需要配置 Android SDK action）。

---

## 9. 一次性检查清单

- [ ] `git config user.name / user.email` 已设置
- [ ] `.gitignore` 已就位（排除 `node_modules/`、`build/`、`*.apk`）
- [ ] 选择合适的 `LICENSE`
- [ ] README 补充项目说明与使用方法
- [ ] 首次提交 + `v1.1` 标签
- [ ] 创建 GitHub 仓库（Public）并 push
- [ ] 在 Releases 上传 `minesweeper-v1.1.apk`
