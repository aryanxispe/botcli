document.addEventListener('DOMContentLoaded', () => {
    // 1. Copy to Clipboard Utility
    const copyBtn = document.getElementById('copy-btn');
    const cmdText = document.getElementById('install-cmd');

    copyBtn.addEventListener('click', () => {
        const text = cmdText.innerText;
        navigator.clipboard.writeText(text).then(() => {
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#27c93f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            copyBtn.style.color = '#27c93f';
            
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '';
            }, 2000);
        });
    });

    // 2. Terminal Simulation (snappy & mechanical)
    const terminalBody = document.getElementById('terminal-content');
    const lines = [
        { text: '<span style="color:#888">></span> Select: <span style="color:#00d2ff">Create Bot</span>', delay: 800 },
        { text: '<span style="color:#888">></span> Enter name: <span style="color:#fff">my-telegram-bot</span>', delay: 1200 },
        { text: '<span style="color:#888">></span> Enter token: <span style="color:#555">********</span>', delay: 1500 },
        { text: '<span style="color:#27c93f">✓</span> Bot initialized successfully.', delay: 800 },
        { text: '<span style="color:#888">></span> Path: <span style="color:#00d2ff">~/bots/my-telegram-bot</span>', delay: 400 },
        { text: '<span style="color:#888">></span> URL: <span style="color:#00d2ff; text-decoration: underline;">mybot.aryanispe.in</span>', delay: 400 }
    ];

    let currentIdx = 0;

    async function typeEffect() {
        // Reset terminal
        terminalBody.innerHTML = '<div class="line"><span class="cursor">$</span> npx botcli</div>';
        currentIdx = 0;

        await new Promise(r => setTimeout(r, 1000));

        for (const line of lines) {
            const div = document.createElement('div');
            div.className = 'line animate-in';
            div.style.opacity = '0';
            div.style.transform = 'translateY(5px)';
            div.innerHTML = line.text;
            
            terminalBody.appendChild(div);
            
            // Animation for line appearing
            setTimeout(() => {
                div.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
                div.style.opacity = '1';
                div.style.transform = 'translateY(0)';
            }, 50);

            await new Promise(r => setTimeout(r, line.delay));
        }

        // Wait before restart
        setTimeout(typeEffect, 6000);
    }

    typeEffect();

    // 3. Scroll Appearance
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.card, .section-header').forEach(el => {
        observer.observe(el);
    });
});
