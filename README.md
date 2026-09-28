# Poker Hand Evaluator

A free, offline-capable web app for Texas Hold'em. Enter your 2 cards and the board (flop, turn, river). The app shows your best 5-card hand, describes it in plain words, and rates it out of 10.

Plain HTML, CSS and JavaScript. No frameworks, no build step, no backend.

| File | What it is |
|---|---|
| `index.html` | The page |
| `styles.css` | Felt theme and CSS-drawn cards |
| `app.js` | UI: slots, pickers, result panel |
| `evaluator.js` | Hand evaluation logic (no UI code) |
| `sw.js` | Service worker (offline support) |
| `manifest.json` | PWA manifest (install to Home Screen) |
| `icons/` | App icons (made by `node tools/make-icons.js`) |
| `tests/` | Test suite |

## Run the tests

```bash
node tests/evaluator.test.js
```

Or serve the folder and open `tests/index.html` in a browser.

## Try it on your computer

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

---

## Publish on GitHub Pages (free), step by step

You do this once. It takes about 10 minutes.

### 1. Create a GitHub account
Go to https://github.com/signup and follow the steps. Remember your **username**, because it becomes part of your app's web address.

### 2. Install the GitHub command-line tool
Open the **Terminal** app on your Mac (press ⌘ Space, type `Terminal`, press Return), then run:

```bash
brew install gh
```

### 3. Log in to GitHub from Terminal
```bash
gh auth login
```
Answer the questions with the arrow keys and Return:
- *Where do you use GitHub?* → **GitHub.com**
- *Preferred protocol?* → **HTTPS**
- *Authenticate Git with your GitHub credentials?* → **Yes**
- *How would you like to authenticate?* → **Login with a web browser**

Terminal shows an 8-character code. Press Return, and your browser opens. Paste the code, click **Continue**, then **Authorize github**. Go back to Terminal, which should say "Logged in as …".

### 4. Tell git your name (one time only)
```bash
git config --global user.name "Your Name"
```
```bash
git config --global user.email "you@example.com"
```
Use the email address you signed up to GitHub with.

### 5. Save the project (your first commit)
```bash
cd ~/claude/poker-hand-evaluator
```
```bash
git add -A
```
```bash
git commit -m "Poker hand evaluator PWA"
```

### 6. Create the repository on GitHub and upload
```bash
gh repo create poker-hand-evaluator --public --source=. --push
```
This creates `https://github.com/YOUR-USERNAME/poker-hand-evaluator` and uploads the files. (The repository has to be **public** for GitHub Pages to be free.)

### 7. Turn on GitHub Pages (in the browser)
1. Go to `https://github.com/YOUR-USERNAME/poker-hand-evaluator`.
2. Click the **⚙ Settings** tab at the top of the repository (on the right, next to "Insights").
3. In the left sidebar, under **Code and automation**, click **Pages**.
4. Under **Build and deployment → Source**, choose **Deploy from a branch**.
5. Under **Branch**, pick **main** in the first dropdown and **/ (root)** in the second. Click **Save**.
6. Wait 1–2 minutes, then refresh the page. A box appears at the top: *"Your site is live at …"*.

### 8. Your app's address
```
https://YOUR-USERNAME.github.io/poker-hand-evaluator/
```
For example, if your username is `jsmith`, the address is `https://jsmith.github.io/poker-hand-evaluator/`. Send this link to your friends.

---

## Install on an iPhone (for you and your friends)

1. Open the link in **Safari**.
2. Tap the **Share** button (a square with an arrow pointing up). It's at the bottom of the screen, or behind the **•••** button on newer iOS versions.
3. Scroll down and tap **Add to Home Screen**.
4. If you see an **Open as Web App** switch, leave it **on**. Tap **Add**.
5. A green poker-card icon named **Poker Hand** appears on the Home Screen. Tap it, and the app opens full screen with no Safari bars. After the first open it works **without internet**.

On Android (Chrome), open the link, tap **⋮**, then tap **Add to Home screen** or **Install app**.

---

## Updating the app later

1. Edit the files.
2. Open `sw.js` and bump `CACHE_VERSION` (for example `'v1'` → `'v2'`). This tells phones to download the new version.
3. Upload:
   ```bash
   git add -A
   ```
   ```bash
   git commit -m "Describe your change"
   ```
   ```bash
   git push
   ```
4. GitHub Pages updates within about a minute. Installed phones pick up the change the next time the app is opened (sometimes it takes a second open).
