#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

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
        // 1. Generate Subdomain
        const username = os.userInfo().username;
        const subdomain = `${answers.name.toLowerCase().replace(/\s+/g, '-')}-${username}.aryanispe.in`;
        
        // 2. Setup Folder
        const botDir = path.join(BOTS_ROOT, subdomain);
        await fs.ensureDir(botDir);

        // 3. Generate Bot Code
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

        // 4. Update bots.json
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

        // Post-creation menu
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

        switch (postAction) {
            case 'start':
                await startBot(newBot);
                break;
            case 'again':
                return createBotFlow();
            case 'menu':
                return mainMenu();
            case 'exit':
                process.exit(0);
        }

    } catch (err) {
        spinner.fail(chalk.red(`Error: ${err.message}`));
    }

    await pause();
    mainMenu();
}

/**
 * Start Bot Logic
 */
async function startBot(botInfo) {
    const nodeModulesExist = await fs.pathExists(path.join(botInfo.path, 'node_modules'));
    
    if (!nodeModulesExist) {
        const spinner = ora('Installing dependencies (this may take a minute)...').start();
        try {
            await new Promise((resolve, reject) => {
                const child = spawn('npm', ['install'], { cwd: botInfo.path, shell: true });
                child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`NPM install failed with code ${code}`)));
            });
            spinner.succeed(chalk.green('Dependencies installed.'));
        } catch (err) {
            spinner.fail(chalk.red(`Error: ${err.message}`));
            return;
        }
    }

    const startSpinner = ora(`Starting bot ${botInfo.name}...`).start();
    try {
        // Run bot in background
        const child = spawn('node', ['bot.js'], {
            cwd: botInfo.path,
            detached: true,
            stdio: 'ignore'
        });

        child.unref(); // Allow the parent process (CLI) to exit without killing the bot
        
        // Update status in bots.json
        const bots = await loadBots();
        const botIdx = bots.findIndex(b => b.subdomain === botInfo.subdomain);
        if (botIdx !== -1) {
            bots[botIdx].status = 'running';
            bots[botIdx].pid = child.pid;
            await saveBots(bots);
        }

        startSpinner.succeed(chalk.green(`Bot ${botInfo.name} is now running in the background!`));
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
            // If running, we should ideally kill it, but for now we'll just remove the metadata
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

// Start CLI
mainMenu();
