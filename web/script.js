document.addEventListener('DOMContentLoaded', () => {
    // 1. Copy to Clipboard
    const copyBtn = document.getElementById('copy-btn');
    const cmdText = document.getElementById('install-cmd');

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(cmdText.innerText).then(() => {
            const originalIcon = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#00fabe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => {
                copyBtn.innerHTML = originalIcon;
            }, 2000);
        });
    });

    // 2. Terminal Typing Animation
    const terminalBody = document.getElementById('terminal-content');
    const lines = [
        { text: '> Select: Create Bot', delay: 1000 },
        { text: '> Enter name: mybot', delay: 1500 },
        { text: '> Enter token: ********', delay: 2000 },
        { text: '✅ Bot Created!', delay: 1000, class: 'success' },
        { text: '🌐 URL: <span class="url">mybot.aryanispe.in</span>', delay: 500 }
    ];

    async function typeLines() {
        for (const line of lines) {
            await new Promise(r => setTimeout(r, line.delay));
            const div = document.createElement('div');
            div.className = 'line animate-in' + (line.class ? ' ' + line.class : '');
            div.innerHTML = line.text;
            terminalBody.appendChild(div);
        }
        
        // Loop after a pause
        setTimeout(() => {
            terminalBody.innerHTML = '<div class="line"><span class="prompt">$</span> npx botcli</div>';
            typeLines();
        }, 5000);
    }

    typeLines();
});
