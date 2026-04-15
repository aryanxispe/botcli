# BotCLI

Professional Telegram Bot Management CLI. Create, manage, and deploy bots directly from your terminal with instant folder generation and automated subdomain simulation.

## 🌐 Live Presence
View the tool in action, along with a mechanical demo:
**[https://botcli.vercel.app/](https://botcli.vercel.app/)**

---

## 🚀 Installation

You don't need to install anything globally. You can run the latest version directly from GitHub:

```bash
npx github:aryanxispe/botcli
```

*Note: Once published to NPM, you can use `npx botcli`.*

---

## ✨ Features

- **Instant Provisioning**: Zero-config folder and bot logic generation.
- **Dynamic Subdomains**: Automated unique subdomains for each bot workspace.
- **Technical Minimalism**: High-performance CLI interface using `commander` and `inquirer`.
- **Local Registry**: State management via a local `bots.json` file.

---

## 🛠️ Commands

### 1. Create Bot
Initializes a new project directory with a bot template and pre-configured `package.json`.

### 2. List Bots
Displays all managed bots, their tokens, and their respective simulated subdomains.

### 3. Delete Bot
Safely removes a bot from the local registry and cleans up resources.

---

## 📂 Project Structure

- `botcli.js`: Main CLI entry point.
- `index.html`: Premium landing page.
- `style.css`: Technical design system.
- `bots.json`: Metadata storage.

---

## 📄 License
MIT © [aryanxispe](https://github.com/aryanxispe)
