#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

/**
 * Configuration & Persistent Storage
 */
const BOTS_DATA_DIR = path.join(os.homedir(), '.botcli');
const BOTS_FILE = path.join(BOTS_DATA_DIR, 'bots.json');
const BOTS_ROOT = path.join(os.homedir(), 'bots');

/**
 * Helper: Ensure Storage Exists
 */
async function ensureStorage() {
    await fs.ensureDir(BOTS_DATA_DIR);
    if (!await fs.pathExists(BOTS_FILE)) {
        await fs.writeJson(BOTS_FILE, []);
    }
}

/**
 * Helper: Load Bots
 */
async function loadBots() {
    await ensureStorage();
    try {
        return await fs.readJson(BOTS_FILE);
    } catch (err) {
        return [];
    }
}

/**
 * Helper: Save Bots
 */
async function saveBots(bots) {
    await ensureStorage();
    await fs.writeJson(BOTS_FILE, bots, { spaces: 2 });
}

/**
 * Helper: Detect NPM Binary Path (cPanel Bypass)
 */
function getNpmPath() {
    try {
        // Find which node version is running
        const nodeVersionMatch = process.version.match(/v(\d+)/);
        const majorVersion = nodeVersionMatch ? nodeVersionMatch[1] : '20';
        
        const possiblePaths = [
            'npm', // Default
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
 * Main Menu
 */
async function mainMenu() {
    console.clear();
    console.log(chalk.blue.bold('\n--- 🤖 BOTCLI: Telegram Bot Manager ---'));
    
    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Main Menu:',
            choices: [
                { name: '🚀 1. Create Bot', value: 'create' },
                { name: '📋 2. List Bots', value: 'list' },
                { name: '❌ 3. Delete Bot', value: 'delete' },
                new inquirer.Separator(),
                { name: 'Exit', value: 'exit' }
            ]
        }
    ]);

    switch (action) {
        case 'create':
            await createBotFlow();
            break;
        case 'list':
            await listBots();
            break;
        case 'delete':
            await deleteBot();
            break;
        case 'exit':
            console.log(chalk.gray('Goodbye!'));
            process.exit(0);
    }
}

/**
 * Create Bot Flow
 */
async function createBotFlow() {
    const questions = [
        {
            type: 'input',
            name: 'name',
            message: 'Enter Bot Name:',
            validate: (val) => val.length > 0 ? true : 'Name cannot be empty'
        },
        {
            type: 'input',
            name: 'token',
            message: 'Enter Telegram Bot Token:',
            validate: (val) => val.length > 0 ? true : 'Token cannot be empty'
        }
    ];

    const answers = await inquirer.prompt(questions);
    const spinner = ora('Generating bot...').start();

    try {
        const username = os.userInfo().username;
        const subdomain = `${answers.name.toLowerCase().replace(/\s+/g, '-')}-${username}.aryanispe.in`;
        
        const botDir = path.join(BOTS_ROOT, subdomain);
        await fs.ensureDir(botDir);

        const botCode = `
const TelegramBot = require('node-telegram-bot-api');

const token = '${answers.token}';
const bot = new TelegramBot(token, { polling: true });

console.log('--- 🤖 Bot Started: ${answers.name} ---');
console.log('Listening for messages...');

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Hello! I am ${answers.name}. I was created using botcli!');
});
        `;

        await fs.writeFile(path.join(botDir, 'bot.js'), botCode);
        
        const botPkg = {
            name: subdomain,
            version: "1.0.0",
            main: "bot.js",
            dependencies: {
                "node-telegram-bot-api": "^0.64.0"
            }
        };
        await fs.writeJson(path.join(botDir, 'package.json'), botPkg, { spaces: 2 });

        const bots = await loadBots();
        const newBot = {
            name: answers.name,
            token: answers.token,
            subdomain: subdomain,
            path: botDir,
            createdAt: new Date().toISOString(),
            status: 'stopped'
        };
        bots.push(newBot);
        await saveBots(bots);

        spinner.succeed(chalk.green(`Bot created successfully!`));
        console.log(chalk.blue(`\nSubdomain: `) + chalk.white(subdomain));
        console.log(chalk.blue(`Path: `) + chalk.white(botDir));

        const { postAction } = await inquirer.prompt([
            {
                type: 'list',
                name: 'postAction',
                message: 'What would you like to do next?',
                choices: [
                    { name: '🔥 1. Start Bot', value: 'start' },
                    { name: '➕ 2. Create Another Bot', value: 'again' },
                    { name: '🔙 3. Back to Main Menu', value: 'menu' },
                    { name: 'Exit', value: 'exit' }
                ]
            }
        ]);

        if (postAction === 'start') {
            await startBot(newBot);
        } else if (postAction === 'again') {
            return createBotFlow();
        } else if (postAction === 'menu') {
            return mainMenu();
        } else {
            process.exit(0);
        }

    } catch (err) {
        spinner.fail(chalk.red(`Error: ${err.message}`));
    }

    await pause();
    mainMenu();
}

/**
 * Start Bot Logic with Deep cPanel Bypass
 */
async function startBot(botInfo) {
    const nodeModulesExist = await fs.pathExists(path.join(botInfo.path, 'node_modules'));
    
    if (!nodeModulesExist) {
        const spinner = ora('Installing dependencies (Bypassing cPanel restrictions)...').start();
        try {
            const npmBin = getNpmPath();
            
            await new Promise((resolve, reject) => {
                const env = { 
                    ...process.env, 
                    NPM_CONFIG_PREFIX: botInfo.path,
                    NPM_CONFIG_GLOBAL: 'false',
                    NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/'
                };

                // Use --no-bin-links for cPanel shared hosting filesystems
                const child = spawn(npmBin, ['install', '--prefix', '.', '--no-bin-links', '--no-package-lock'], { 
                    cwd: botInfo.path, 
                    shell: true,
                    env
                });

                let errorOutput = '';
                child.stderr.on('data', (data) => { errorOutput += data.toString(); });

                child.on('close', (code) => {
                    if (code === 0) resolve();
                    else reject(new Error(`Exit Code ${code}. Search Path: ${npmBin}. Details: ${errorOutput.slice(0, 150)}`));
                });
            });
            spinner.succeed(chalk.green('Dependencies installed.'));
        } catch (err) {
            spinner.fail(chalk.red(`NPM Restricted: ${err.message}`));
            console.log(chalk.yellow('\n[Troubleshoot] This server blocks automated installs.'));
            console.log(chalk.gray('Please try running manually in terminal:'));
            console.log(chalk.cyan(`cd ${botInfo.path} && npm install --no-bin-links`));
            await pause();
            return;
        }
    }

    const startSpinner = ora(`Starting bot ${botInfo.name}...`).start();
    try {
        const child = spawn('node', ['bot.js'], {
            cwd: botInfo.path,
            detached: true,
            stdio: 'ignore'
        });

        child.unref();
        
        const bots = await loadBots();
        const botIdx = bots.findIndex(b => b.subdomain === botInfo.subdomain);
        if (botIdx !== -1) {
            bots[botIdx].status = 'running';
            bots[botIdx].pid = child.pid;
            await saveBots(bots);
        }

        startSpinner.succeed(chalk.green(`Bot ${botInfo.name} is running!`));
        console.log(chalk.gray(`\n[PID: ${child.pid}] Use 'List Bots' to check status.`));
    } catch (err) {
        startSpinner.fail(chalk.red(`Error: ${err.message}`));
    }
}

/**
 * List Bots
 */
async function listBots() {
    try {
        const bots = await loadBots();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots found.'));
        } else {
            console.log(chalk.blue.bold('\n--- Registered Bots ---'));
            bots.forEach((bot, index) => {
                const statusStr = bot.status === 'running' ? chalk.green('● Running') : chalk.red('○ Stopped');
                console.log(`${index + 1}. ${chalk.bold(bot.name)} | ${statusStr}`);
                console.log(chalk.gray(`   Subdomain: ${bot.subdomain}`));
            });
        }
    } catch (err) {
        console.log(chalk.red(`Error: ${err.message}`));
    }
    await pause();
    mainMenu();
}

/**
 * Delete Bot
 */
async function deleteBot() {
    try {
        const bots = await loadBots();
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots to delete.'));
            await pause();
            return mainMenu();
        }

        const { botIndex } = await inquirer.prompt([
            {
                type: 'list',
                name: 'botIndex',
                message: 'Select bot to delete:',
                choices: bots.map((b, i) => ({ name: `${b.name} (${b.subdomain})`, value: i }))
            }
        ]);

        const deletedBot = bots[botIndex];
        const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to delete ${deletedBot.name}? (This only removes the config data)`,
            default: false
        }]);

        if (confirm) {
            bots.splice(botIndex, 1);
            await saveBots(bots);
            console.log(chalk.green(`\nBot removed from manager.`));
        }

    } catch (err) {
        console.log(chalk.red(`Error: ${err.message}`));
    }
    await pause();
    mainMenu();
}

/**
 * Utility: Pause
 */
async function pause() {
    return inquirer.prompt([{ type: 'input', name: 'key', message: 'Press Enter to continue...' }]);
}

async function run() {
    await ensureStorage();
    mainMenu();
}

run();
