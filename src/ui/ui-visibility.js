import { UI_THRESHOLDS, FIRST_COMPUTER_TRANSISTOR_THRESHOLD, PHASES } from "../state.js";

// Met à jour la visibilité des panneaux selon l'état du jeu.
export function updateVisibility(game, { toggleElement, canUnlockAI, isMiniGameUnlocked }) {
    const total = game.totalTransistorsCreated;
    const showTransistors = total >= UI_THRESHOLDS.transistors;
    const showProduction = total >= UI_THRESHOLDS.production;
    const unlockTerminal = total >= UI_THRESHOLDS.terminal;
    const showUpgradesUnlocked = total >= UI_THRESHOLDS.upgrades;
    const showUpgrades = showUpgradesUnlocked || game.aiUnlocked; // show upgrades once AI is unlocked too
    const showQuantumPanel = game.quantumUnlocked; // NEW: quantum computer panel visibility
    const showAIPanel = game.aiUnlocked || canUnlockAI(game);
    const showMiniGames = Array.from(document.querySelectorAll(".mini-game-card")).some(card =>
        isMiniGameUnlocked(card.dataset.miniId)
    );

    toggleElement("panels-container", showTransistors);
    toggleElement("transistor-counter", showTransistors);
    toggleElement("transistor-counter-row", showTransistors);
    toggleElement("panel-transistors", showTransistors);
    toggleElement("panel-system", showTransistors);

    toggleElement("panel-production", showProduction);
    toggleElement("panel-ai", showAIPanel);
    toggleElement("panel-ai-projects", false);
    toggleElement("mini-games-container", showMiniGames);

    if (unlockTerminal && !game.flags.terminalUnlocked) {
        game.terminalLog = [];
        game.flags.terminalUnlocked = true;
    }
    toggleElement("terminal-log", unlockTerminal);

    const showResearchPanel = game.researchUnlocked;
    const showProjectsPanel = game.phase >= PHASES.RESEARCH; // keep panel visible to show points even if no projects
    const canShowComputers =
        game.totalTransistorsCreated >= FIRST_COMPUTER_TRANSISTOR_THRESHOLD;

    toggleElement("panel-computers", canShowComputers);
    toggleElement("panel-upgrades", showUpgrades);
    toggleElement("panel-research", showResearchPanel);
    toggleElement("panel-projects", showProjectsPanel);
    toggleElement("panel-quantum-computers", showQuantumPanel);
    toggleElement("panel-universe-exploration", showQuantumPanel);
}
