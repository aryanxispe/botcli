#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const https = require('https');
const { spawn } = require('child_process');

// Current App Version
const pkg = require('./package.json');
const VERSION = pkg.version;

/**
 * Configuration & Persistent Storage
 * v1.3.0 'Nexus' Update: Using shared dependency store in ~/.botcli
 */
const BOTS_DATA_DIR = path.join(os.homedir(), '.botcli');
const BOTS_FILE = path.join(BOTS_DATA_DIR, 'bots.json');
const BOTS_ROOT = path.join(os.homedir(), 'bots');
const SHARED_LIB_PATH = path.join(BOTS_DATA_DIR, 'node_modules', 'node-telegram-bot-api');

/**
 * Helper: Ensure Storage & Nexus Engine Exist
 */
async function ensureStorage() {
    await fs.ensureDir(BOTS_DATA_DIR);
    if (!await fs.pathExists(BOTS_FILE)) {
        await fs.writeJson(BOTS_FILE, []);
    }
}

/**
 * Helper: Detect NPM Binary Path (cPanel Bypass)
 */
function getNpmPath() {
    try {
        const nodeVersionMatch = process.version.match(/v(\d+)/);
        const majorVersion = nodeVersionMatch ? nodeVersionMatch[1] : '20';
        
        const possiblePaths = [
            'npm',
            `/opt/cpanel/ea-nodejs${majorVersion}/bin/npm`,
            `/usr/local/bin/npm`,
            `/usr/bin/npm`
        ];

        for (const p of possiblePaths) {
            try {
                if (p === 'npm') return 'npm';
                if (fs.existsSync(p)) return p;
            } catch (e) {}
        }
    } catch (err) {}
    return 'npm';
}

/**
 * Helper: Initialize Nexus Engine (One-time setup)
 */
async function ensureNexus() {
    const nexusExists = await fs.pathExists(SHARED_LIB_PATH);
    if (!nexusExists) {
        console.log(chalk.blue.bold('\n--- ⚡ Initializing Nexus Engine (Shared Dependencies) ---'));
        const spinner = ora('Setting up dependency store in ~/.botcli (One-time process)...').start();
        
        try {
            const npmBin = getNpmPath();
            await new Promise((resolve, reject) => {
                const child = spawn(npmBin, ['install', 'node-telegram-bot-api', '--no-bin-links'], { 
                    cwd: BOTS_DATA_DIR, 
                    shell: true 
                });
                child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Failed to initialize Nexus [Code ${code}]`)));
            });
            spinner.succeed(chalk.green('Nexus Engine initialized successfully!'));
        } catch (err) {
            spinner.fail(chalk.red(`Nexus Initialization Error: ${err.message}`));
            console.log(chalk.yellow('\nPlease run manually to fix:'));
            console.log(chalk.cyan(`cd ~/.botcli && npm install node-telegram-bot-api`));
            process.exit(1);
        }
    }
}

/**
 * Helper: Check for Updates
 */
async function checkForUpdates(manual = false) {
    const spinner = manual ? ora('Checking for updates...').start() : null;
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'raw.githubusercontent.com',
            path: '/aryanxispe/botcli/main/package.json',
            method: 'GET',
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const remotePkg = JSON.parse(data);
                    const remoteVersion = remotePkg.version;
                    if (manual && spinner) {
                        spinner.stop();
                        if (remoteVersion === VERSION) console.log(chalk.green(`\n✔ You are on the latest version (v${VERSION})`));
                        else {
                            console.log(chalk.yellow.bold(`\n🚀 Update Available: v${remoteVersion}`));
                            console.log(chalk.white(`To update: `) + chalk.cyan(`npx github:aryanxispe/botcli\n`));
                        }
                    }
                    resolve(remoteVersion !== VERSION);
                } catch (e) { resolve(false); }
            });
        });
        req.on('error', () => { if (manual && spinner) spinner.fail('Network error.'); resolve(false); });
        req.end();
    });
}

/**
 * Main Menu
 */
async function mainMenu() {
    console.clear();
    console.log(chalk.blue.bold('\n--- 🤖 BOTCLI: Telegram Bot Manager ---'));
    console.log(chalk.gray(`Version: v${VERSION} (Nexus Engine Active)\n`));
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Main Menu:',
            choices: [
                { name: '🚀 1. Create Bot', value: 'create' },
                { name: '📋 2. List Bots', value: 'list' },
                { name: '❌ 3. Delete Bot', value: 'delete' },
                { name: '🔄 4. Check for Updates', value: 'update' },
                new inquirer.Separator(),
                { name: 'Exit', value: 'exit' }
            ]
        }
    ]);

    switch (action) {
        case 'create': await createBotFlow(); break;
        case 'list': await listBots(); break;
        case 'delete': await deleteBot(); break;
        case 'update': await checkForUpdates(true); await pause(); await mainMenu(); break;
        case 'exit': process.exit(0);
    }
}

/**
 * Create Bot Flow
 */
async function createBotFlow() {
    const questions = [
        { type: 'input', name: 'name', message: 'Enter Bot Name:' },
        { type: 'input', name: 'token', message: 'Enter Telegram Bot Token:' }
    ];

    const answers = await inquirer.prompt(questions);
    const spinner = ora('Generating bot via Nexus Engine...').start();

    try {
        const username = os.userInfo().username;
        const subdomain = `${answers.name.toLowerCase().replace(/\s+/g, '-')}-${username}.aryanispe.in`;
        const botDir = path.join(BOTS_ROOT, subdomain);
        await fs.ensureDir(botDir);

        // v1.3.0 logic: Use ABSOLUTE path to shared dependency
        const escapedSharedPath = SHARED_LIB_PATH.replace(/\\/g, '/');
        const botCode = `
const TelegramBot = require('${escapedSharedPath}');

const token = '${answers.token}';
const bot = new TelegramBot(token, { polling: true });

console.log('--- 🤖 Bot Started: ${answers.name} ---');
console.log('Listening for messages...');

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Hello! I am ${answers.name}. I was created using botcli Nexus!');
});
        `;

        await fs.writeFile(path.join(botDir, 'bot.js'), botCode);
        
        // metadata push
        const bots = await fs.readJson(BOTS_FILE);
        const newBot = {
            name: answers.name,
            token: answers.token,
            subdomain: subdomain,
            path: botDir,
            createdAt: new Date().toISOString(),
            status: 'stopped'
        };
        bots.push(newBot);
        await fs.writeJson(BOTS_FILE, bots, { spaces: 2 });

        spinner.succeed(chalk.green(`Bot ${answers.name} created instantly!`));
        
        const { postAction } = await inquirer.prompt([{
            type: 'list',
            name: 'postAction',
            message: 'What next?',
            choices: [
                { name: '⚡ 1. Start Bot (Instant)', value: 'start' },
                { name: '🔙 2. Back to Menu', value: 'menu' }
            ]
        }]);

        if (postAction === 'start') await startBot(newBot);
        else await mainMenu();

    } catch (err) { spinner.fail(chalk.red(`Error: ${err.message}`)); }
    await pause();
    mainMenu();
}

/**
 * Start Bot (Instant in v1.3.0)
 */
async function startBot(botInfo) {
    const spinner = ora(`Launching bot ${botInfo.name}...`).start();
    try {
        const child = spawn('node', ['bot.js'], {
            cwd: botInfo.path,
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        
        // Update registry
        const bots = await fs.readJson(BOTS_FILE);
        const idx = bots.findIndex(b => b.subdomain === botInfo.subdomain);
        if (idx !== -1) {
            bots[idx].status = 'running';
            bots[idx].pid = child.pid;
            await fs.writeJson(BOTS_FILE, bots, { spaces: 2 });
        }

        spinner.succeed(chalk.green(`Bot is now live! (Nexus Active)`));
        console.log(chalk.gray(`[PID: ${child.pid}]`));
    } catch (err) { spinner.fail(chalk.red(`Start Error: ${err.message}`)); }
}

async function listBots() {
    try {
        const bots = await fs.readJson(BOTS_FILE);
        if (bots.length === 0) console.log(chalk.yellow('\nNo bots found.'));
        else {
            console.log(chalk.blue.bold('\n--- Registered Bots (Nexus Engine) ---'));
            bots.forEach((bot, i) => {
                const status = bot.status === 'running' ? chalk.green('● Active') : chalk.red('○ Stopped');
                console.log(`${i + 1}. ${chalk.bold(bot.name)} | ${status}`);
            });
        }
    } catch (e) { console.log(chalk.red(e.message)); }
    await pause();
    mainMenu();
}

async function deleteBot() {
    try {
        const bots = await fs.readJson(BOTS_FILE);
        if (bots.length === 0) return mainMenu();
        const { idx } = await inquirer.prompt([{
            type: 'list', name: 'idx', message: 'Select to delete:',
            choices: bots.map((b, i) => ({ name: b.name, value: i }))
        }]);
        bots.splice(idx, 1);
        await fs.writeJson(BOTS_FILE, bots, { spaces: 2 });
        console.log(chalk.green('Deleted.'));
    } catch (e) {}
    await pause();
    mainMenu();
}

async function pause() { return inquirer.prompt([{ type: 'input', name: 'k', message: 'Press Enter...' }]); }

async function run() {
    await ensureStorage();
    await ensureNexus();
    mainMenu();
}

run();
