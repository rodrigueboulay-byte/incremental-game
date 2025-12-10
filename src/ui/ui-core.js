// UI helpers centralisés (affichage générique).
export function toggleElement(id, shouldShow) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !shouldShow);
}

export function renderTerminal(game) {
    const container = document.getElementById("terminal-log");
    if (!container) return;

    container.innerHTML = "";
    game.terminalLog.forEach(line => {
        const div = document.createElement("div");
        div.textContent = line; // sécurité : pas d'HTML brut
        container.appendChild(div);
    });

    if (container.clientHeight > 0) {
        while (
            container.scrollHeight > container.clientHeight &&
            game.terminalLog.length > 0 &&
            container.firstChild
        ) {
            container.removeChild(container.firstChild);
            game.terminalLog.shift();
        }
    }

    // scroll tout en bas automatiquement
    container.scrollTop = container.scrollHeight;
}
