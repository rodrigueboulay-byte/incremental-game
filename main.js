// === Configuration ===
const TICK_MS = 100;
const SAVE_KEY = "the_transistor_save_v1";
const FIRST_COMPUTER_TRANSISTOR_THRESHOLD = 1000; // seuil arbitraire pour le premier PC
const UI_THRESHOLDS = {
    transistors: 1,
    production: 10,
    terminal: 800,
    upgrades: 1000,
};

// === État du jeu ===
function nowMs() {
    return typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
}

function createDefaultGameState() {
    return {
        transistors: 0,
        transistorsPerClick: 1,
        totalTransistorsCreated: 0,
        computerPower: 0,
        computers: 0,
        computerBaseCost: 200,
        computerCostMultiplier: 1.3,
        powerPerComputerPerSec: 1,

        generators: 0,
        generatorBaseCost: 10,
        generatorCostMultiplier: 1.15,
        transistorsPerGeneratorPerSec: 1,

        upgradesBought: {},
        terminalLog: [],
        flags: {
            firstComputerBuilt: false,
            terminalUnlocked: false,
        },

        lastTick: nowMs(),
    };
}

let game = createDefaultGameState();

// === Upgrades ===
const UPGRADES = [
    {
        id: "double_click",
        name: "Reinforced Contacts",
        description: "Doubles transistors gained per click.",
        costPower: 50,
        apply: () => {
            game.transistorsPerClick *= 2;
        },
    },
    {
        id: "better_generators",
        name: "Improved Fabrication Line",
        description: "Doubles generator output.",
        costPower: 120,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 2;
        },
    },
];

// === Helpers ===
function safeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getGeneratorCost() {
    return Math.floor(
        game.generatorBaseCost *
        Math.pow(game.generatorCostMultiplier, game.generators)
    );
}

function getComputerCost() {
    return Math.floor(
        game.computerBaseCost *
        Math.pow(game.computerCostMultiplier, game.computers)
    );
}

// === Terminal log ===
function logMessage(message) {
    if (!game.flags.terminalUnlocked) return;

    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-GB", { hour12: false });
    const line = `[${timestamp}] ${message}`;

    game.terminalLog.push(line);
    // limite la taille du log pour éviter l'infini
    if (game.terminalLog.length > 80) {
        game.terminalLog.shift();
    }
    renderTerminal();
}

function renderTerminal() {
    const container = document.getElementById("terminal-log");
    if (!container) return;

    container.innerHTML = "";
    game.terminalLog.forEach(line => {
        const div = document.createElement("div");
        div.textContent = line; // sécurité : pas d'HTML brut
        container.appendChild(div);
    });

    // scroll tout en bas automatiquement
    container.scrollTop = container.scrollHeight;
}

// === Sauvegarde ===
function hydrateGameState(saved = {}) {
    const defaults = createDefaultGameState();
    const flagsFromSave = saved.flags || {};
    let inferredTotal =
        saved.totalTransistorsCreated ??
        (typeof saved.transistors === "number" ? saved.transistors : 0);
    if (flagsFromSave.terminalUnlocked && inferredTotal < UI_THRESHOLDS.terminal) {
        inferredTotal = UI_THRESHOLDS.terminal;
    }

    game = {
        ...defaults,
        ...saved,
        transistors: safeNumber(saved.transistors, defaults.transistors),
        transistorsPerClick: safeNumber(saved.transistorsPerClick, defaults.transistorsPerClick),
        totalTransistorsCreated: safeNumber(inferredTotal, defaults.totalTransistorsCreated),
        computerPower: safeNumber(saved.computerPower, defaults.computerPower),
        computers: safeNumber(saved.computers, defaults.computers),
        computerBaseCost: safeNumber(saved.computerBaseCost, defaults.computerBaseCost),
        computerCostMultiplier: safeNumber(saved.computerCostMultiplier, defaults.computerCostMultiplier),
        powerPerComputerPerSec: safeNumber(saved.powerPerComputerPerSec, defaults.powerPerComputerPerSec),
        generators: safeNumber(saved.generators, defaults.generators),
        generatorBaseCost: safeNumber(saved.generatorBaseCost, defaults.generatorBaseCost),
        generatorCostMultiplier: safeNumber(saved.generatorCostMultiplier, defaults.generatorCostMultiplier),
        transistorsPerGeneratorPerSec: safeNumber(
            saved.transistorsPerGeneratorPerSec,
            defaults.transistorsPerGeneratorPerSec
        ),
        upgradesBought: saved.upgradesBought ?? defaults.upgradesBought,
        terminalLog: Array.isArray(saved.terminalLog) ? saved.terminalLog : defaults.terminalLog,
        flags: {
            ...defaults.flags,
            ...flagsFromSave,
            terminalUnlocked: flagsFromSave.terminalUnlocked ?? false,
        },
        lastTick: nowMs(),
    };

    if (!game.terminalLog) {
        game.terminalLog = [];
    }
    if (!game.upgradesBought) {
        game.upgradesBought = {};
    }
}

function saveGame() {
    try {
        const data = JSON.stringify(game);
        localStorage.setItem(SAVE_KEY, data);
    } catch (e) {
        console.error("Error while saving game:", e);
    }
}

function loadGame() {
    const raw = localStorage.getItem(SAVE_KEY);

    if (!raw) {
        hydrateGameState();
        renderAll();
        return;
    }

    try {
        const data = JSON.parse(raw);
        hydrateGameState(data);
        renderAll();
    } catch (e) {
        console.error("Error while loading save:", e);
        hydrateGameState();
        renderAll();
    }
}

function hardReset() {
    if (!confirm("Reset game and delete save?")) return;

    localStorage.removeItem(SAVE_KEY);
    hydrateGameState();
    renderAll();
}

// === Milestones ===
function checkMilestones() {
    // Premier PC : atteint quand assez de transistors cumulés
    if (
        !game.flags.firstComputerBuilt &&
        game.totalTransistorsCreated >= FIRST_COMPUTER_TRANSISTOR_THRESHOLD
    ) {
        game.flags.firstComputerBuilt = true;

        logMessage("1954 TRADIC assembled.");
        logMessage("Running first program...");
        logMessage("Hello, World!");

        // petit boost léger optionnel
        game.transistorsPerGeneratorPerSec *= 1.5;
    }
}

// === Logique du jeu ===
function gameTick() {
    const now = nowMs();
    const deltaSec = (now - game.lastTick) / 1000;
    game.lastTick = now;

    // Production via générateurs
    const fromGenerators =
        game.generators * game.transistorsPerGeneratorPerSec * deltaSec;
    game.transistors += fromGenerators;
    game.totalTransistorsCreated += fromGenerators;
    const powerFromComputers =
        game.computers * game.powerPerComputerPerSec * deltaSec;
    game.computerPower += powerFromComputers;

    checkMilestones();
    renderAll();
}

// === Actions ===
function onClickGenerate() {
    game.transistors += game.transistorsPerClick;
    game.totalTransistorsCreated += game.transistorsPerClick;
    checkMilestones();
    renderAll();
}

function onBuyGenerator() {
    const cost = getGeneratorCost();
    if (game.transistors < cost) return;

    game.transistors -= cost;
    game.generators += 1;
    renderStats();
}

function onBuyComputer() {
    const cost = getComputerCost();
    if (game.transistors < cost) return;

    game.transistors -= cost;
    game.computers += 1;
    renderStats();
}

function buyUpgrade(id) {
    if (game.upgradesBought[id]) return;

    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;

    if (game.computerPower < up.costPower) return;

    game.computerPower -= up.costPower;
    game.upgradesBought[id] = true;
    up.apply();

    renderAll();
}

// === Rendu ===
function toggleElement(id, shouldShow) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !shouldShow);
}

function updateVisibility() {
    const total = game.totalTransistorsCreated;
    const showTransistors = total >= UI_THRESHOLDS.transistors;
    const showProduction = total >= UI_THRESHOLDS.production;
    const unlockTerminal = total >= UI_THRESHOLDS.terminal;
    const showUpgrades = total >= UI_THRESHOLDS.upgrades;

    toggleElement("panels-container", showTransistors);
    toggleElement("transistor-counter", showTransistors);
    toggleElement("transistor-counter-row", showTransistors);
    toggleElement("panel-transistors", showTransistors);
    toggleElement("panel-system", showTransistors);

    toggleElement("panel-production", showProduction);

    if (unlockTerminal && !game.flags.terminalUnlocked) {
        game.terminalLog = [];
        game.flags.terminalUnlocked = true;
    }
    toggleElement("terminal-log", unlockTerminal);

    toggleElement("panel-computers", showUpgrades);
    toggleElement("panel-upgrades", showUpgrades);
}

function renderStats() {
    const transistorsPerSec =
        game.generators * game.transistorsPerGeneratorPerSec;
    const generatorOutputTotal = transistorsPerSec;
    const computerPowerPerSec =
        game.computers * game.powerPerComputerPerSec;

    document.getElementById("transistors-count").textContent =
        Math.floor(game.transistors);
    const counterDisplay = document.getElementById("transistor-counter");
    if (counterDisplay) {
        counterDisplay.textContent = Math.floor(game.totalTransistorsCreated);
    }
    document.getElementById("transistors-per-click").textContent =
        game.transistorsPerClick.toFixed(2);
    document.getElementById("transistors-per-sec").textContent =
        transistorsPerSec.toFixed(2);

    document.getElementById("generators-count").textContent =
        game.generators;
    document.getElementById("generator-cost").textContent =
        getGeneratorCost();
    document.getElementById("generator-rate").textContent =
        generatorOutputTotal.toFixed(2);
    document.getElementById("computers-count").textContent =
        game.computers;
    document.getElementById("computer-cost").textContent =
        getComputerCost();
    document.getElementById("computer-rate").textContent =
        game.powerPerComputerPerSec.toFixed(2);
    document.getElementById("computer-total-rate").textContent =
        computerPowerPerSec.toFixed(2);
    document.getElementById("computer-power-count").textContent =
        Math.floor(game.computerPower);

    // Boutons disabled
    document.getElementById("btn-buy-generator").disabled =
        game.transistors < getGeneratorCost();
    const btnComputer = document.getElementById("btn-buy-computer");
    if (btnComputer) {
        btnComputer.disabled = game.transistors < getComputerCost();
    }
}

function renderUpgrades() {
    const container = document.getElementById("upgrades-list");
    container.innerHTML = "";

    UPGRADES.forEach(up => {
        const bought = !!game.upgradesBought[up.id];

        const div = document.createElement("div");
        div.className = "upgrade";

        const h3 = document.createElement("h3");
        h3.textContent = `${up.name}${bought ? " (purchased)" : ""}`;
        div.appendChild(h3);

        const desc = document.createElement("p");
        desc.textContent = up.description;
        div.appendChild(desc);

        const cost = document.createElement("p");
        cost.textContent = `Cost: ${up.costPower} computer power`;
        div.appendChild(cost);

        const btn = document.createElement("button");
        btn.textContent = bought ? "Purchased" : "Buy";
        btn.disabled = bought || game.computerPower < up.costPower;
        btn.addEventListener("click", () => buyUpgrade(up.id));
        div.appendChild(btn);

        container.appendChild(div);
    });
}

function renderAll() {
    updateVisibility();
    renderStats();
    renderUpgrades();
    renderTerminal();
}

// === Init ===
function init() {
    loadGame();

    game.lastTick = nowMs();

    document
        .getElementById("btn-generate-transistor")
        .addEventListener("click", onClickGenerate);
    document
        .getElementById("btn-buy-generator")
        .addEventListener("click", onBuyGenerator);
    document
        .getElementById("btn-buy-computer")
        .addEventListener("click", onBuyComputer);

    document
        .getElementById("btn-save-manual")
        .addEventListener("click", () => {
            saveGame();
            alert("Game saved.");
        });

    document
        .getElementById("btn-load-manual")
        .addEventListener("click", () => {
            loadGame();
            alert("Save loaded.");
        });

    document
        .getElementById("btn-hard-reset")
        .addEventListener("click", hardReset);

    renderAll();

    setInterval(gameTick, TICK_MS);
    setInterval(saveGame, 5000);
}

window.addEventListener("DOMContentLoaded", init);
