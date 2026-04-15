#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Configuration
const BOTS_FILE = path.join(__dirname, 'bots.json');
const BOTS_ROOT = path.join(os.homedir(), 'bots');

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
                '1. Create Bot',
                '2. List Bots',
                '3. Delete Bot',
                new inquirer.Separator(),
                'Exit'
            ]
        }
    ]);

    switch (action) {
        case '1. Create Bot':
            await createBotFlow();
            break;
        case '2. List Bots':
            await listBots();
            break;
        case '3. Delete Bot':
            await deleteBot();
            break;
        case 'Exit':
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
        
        // Create local package.json for the bot folder
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
        const bots = await fs.readJson(BOTS_FILE);
        bots.push({
            name: answers.name,
            token: answers.token,
            subdomain: subdomain,
            path: botDir,
            createdAt: new Date().toISOString()
        });
        await fs.writeJson(BOTS_FILE, bots, { spaces: 2 });

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
                    '1. Start Bot (Coming Soon)',
                    '2. Create Another Bot',
                    '3. Back to Main Menu',
                    '4. Exit'
                ]
            }
        ]);

        switch (postAction) {
            case '1. Start Bot (Coming Soon)':
                console.log(chalk.yellow('\n[Info] This feature is coming soon!'));
                await pause();
                return createBotFlow(); // Loop back or go elsewhere? Let's go back to menu for now
            case '2. Create Another Bot':
                return createBotFlow();
            case '3. Back to Main Menu':
                return mainMenu();
            case '4. Exit':
                console.log(chalk.gray('Goodbye!'));
                process.exit(0);
        }

    } catch (err) {
        spinner.fail(chalk.red(`Error: ${err.message}`));
    }

    await pause();
    mainMenu();
}

/**
 * List Bots
 */
async function listBots() {
    try {
        const bots = await fs.readJson(BOTS_FILE);
        if (bots.length === 0) {
            console.log(chalk.yellow('\nNo bots found.'));
        } else {
            console.log(chalk.blue.bold('\n--- Registered Bots ---'));
            bots.forEach((bot, index) => {
                console.log(`${index + 1}. ${chalk.green(bot.name)} (${bot.subdomain})`);
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
        const bots = await fs.readJson(BOTS_FILE);
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
            await fs.writeJson(BOTS_FILE, bots, { spaces: 2 });
            console.log(chalk.green(`\nBot removed from manager.`));
        }

    } catch (err) {
        console.log(chalk.red(`Error: ${err.message}`));
    }
    await pause();
    mainMenu();
}

/**
 * Launch Bot Process
 */
async function pause() {
    return inquirer.prompt([{ type: 'input', name: 'key', message: 'Press Enter to continue...' }]);
}

// Start CLI
mainMenu();
