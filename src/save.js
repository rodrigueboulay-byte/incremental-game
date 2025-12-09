import {
    SAVE_KEY,
    UI_THRESHOLDS,
    PANEL_ORDER_KEY,
    PANEL_COLUMNS_KEY,
    MINI_GAMES_ORDER_KEY,
    createDefaultGameState,
    nowMs,
    setGameState,
} from "./state.js";

const fallbackSafeNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

// Rebuild game state from persisted data while keeping the current save format.
export function hydrateGameState(saved = {}, { resetMiniGamesRuntime, safeNumber = fallbackSafeNumber } = {}) {
    if (typeof resetMiniGamesRuntime === "function") {
        resetMiniGamesRuntime();
    }

    const defaults = createDefaultGameState();
    const flagsFromSave = saved.flags || {};
    let inferredTotal =
        saved.totalTransistorsCreated ??
        (typeof saved.transistors === "number" ? saved.transistors : 0);
    if (flagsFromSave.terminalUnlocked && inferredTotal < UI_THRESHOLDS.terminal) {
        inferredTotal = UI_THRESHOLDS.terminal;
    }

    let game = {
        ...defaults,
        ...saved,
        phase: safeNumber(saved.phase, defaults.phase),
        transistors: safeNumber(saved.transistors, defaults.transistors),
        transistorsPerClick: safeNumber(saved.transistorsPerClick, defaults.transistorsPerClick),
        totalTransistorsCreated: safeNumber(inferredTotal, defaults.totalTransistorsCreated),
        computerPower: safeNumber(saved.computerPower, defaults.computerPower),
        lifetimeComputerPower: safeNumber(saved.lifetimeComputerPower, defaults.lifetimeComputerPower),
        computers: safeNumber(saved.computers, defaults.computers),
        computerBaseCost: safeNumber(saved.computerBaseCost, defaults.computerBaseCost),
        computerCostMultiplier: safeNumber(saved.computerCostMultiplier, defaults.computerCostMultiplier),
        powerPerComputerPerSec: safeNumber(saved.powerPerComputerPerSec, defaults.powerPerComputerPerSec),
        quantumPower: safeNumber(saved.quantumPower, defaults.quantumPower),
        quantumUnlocked: saved.quantumUnlocked ?? defaults.quantumUnlocked,
        aiProgress: safeNumber(saved.aiProgress, defaults.aiProgress),
        lifetimeAIProgress: safeNumber(saved.lifetimeAIProgress, defaults.lifetimeAIProgress),
        aiUnlocked: saved.aiUnlocked ?? defaults.aiUnlocked,
        aiMode: saved.aiMode || defaults.aiMode,
        research: safeNumber(saved.research, defaults.research),
        researchPerSec: safeNumber(saved.researchPerSec, defaults.researchPerSec),
        lifetimeResearch: safeNumber(saved.lifetimeResearch, defaults.lifetimeResearch),
        researchUnlocked: saved.researchUnlocked ?? defaults.researchUnlocked,
        saveVersion: saved.saveVersion || defaults.saveVersion,
        aiProgressPerSec: safeNumber(saved.aiProgressPerSec, defaults.aiProgressPerSec),
        quantumResearchBoost: safeNumber(saved.quantumResearchBoost, defaults.quantumResearchBoost),
        aiMode: saved.aiMode || defaults.aiMode,
        generators: safeNumber(saved.generators, defaults.generators),
        generatorBaseCost: safeNumber(saved.generatorBaseCost, defaults.generatorBaseCost),
        generatorCostMultiplier: safeNumber(saved.generatorCostMultiplier, defaults.generatorCostMultiplier),
        transistorsPerGeneratorPerSec: safeNumber(
            saved.transistorsPerGeneratorPerSec,
            defaults.transistorsPerGeneratorPerSec
        ),
        explorationSignals: safeNumber(saved.explorationSignals, defaults.explorationSignals),
        explorationUnlocked: saved.explorationUnlocked ?? defaults.explorationUnlocked,
        explorationScans: safeNumber(saved.explorationScans, defaults.explorationScans),
        explorationHypers: safeNumber(saved.explorationHypers, defaults.explorationHypers),
        universeExploredPercent: safeNumber(
            saved.universeExploredPercent,
            defaults.universeExploredPercent
        ),
        iaCharge: safeNumber(saved.iaCharge, defaults.iaCharge),
        iaChargePerSec: safeNumber(saved.iaChargePerSec, defaults.iaChargePerSec),
        scanCount: safeNumber(saved.scanCount, defaults.scanCount),
        hyperScanCount: safeNumber(saved.hyperScanCount, defaults.hyperScanCount),
        expoFactor: safeNumber(saved.expoFactor, defaults.expoFactor),
        productionBoost: safeNumber(saved.productionBoost, defaults.productionBoost),
        protoAlgoRisk: saved.protoAlgoRisk || defaults.protoAlgoRisk,
        protoAlgoMultiplier: safeNumber(saved.protoAlgoMultiplier, defaults.protoAlgoMultiplier),
        protoAlgoLastResult: safeNumber(saved.protoAlgoLastResult, defaults.protoAlgoLastResult),
        protoAlgoLog: Array.isArray(saved.protoAlgoLog) ? saved.protoAlgoLog.slice(-50) : defaults.protoAlgoLog,
        protoAlgoNextCycleAt: safeNumber(saved.protoAlgoNextCycleAt, defaults.protoAlgoNextCycleAt),
        curriculumProfile: saved.curriculumProfile || defaults.curriculumProfile,
        curriculumLastSwitch: safeNumber(saved.curriculumLastSwitch, defaults.curriculumLastSwitch),
        alignmentScore: safeNumber(saved.alignmentScore, defaults.alignmentScore),
        alignmentHistory: Array.isArray(saved.alignmentHistory) ? saved.alignmentHistory.slice(-5) : defaults.alignmentHistory,
        alignmentActiveBuffs: Array.isArray(saved.alignmentActiveBuffs)
            ? saved.alignmentActiveBuffs
            : defaults.alignmentActiveBuffs,
        alignmentScenario: saved.alignmentScenario || defaults.alignmentScenario,
        alignmentNextScenarioAt: safeNumber(saved.alignmentNextScenarioAt, defaults.alignmentNextScenarioAt),
        alignmentExpiresAt: safeNumber(saved.alignmentExpiresAt, defaults.alignmentExpiresAt),
        alignmentStartedAt: safeNumber(saved.alignmentStartedAt, defaults.alignmentStartedAt),
        alignmentLastDecay: safeNumber(saved.alignmentLastDecay, defaults.alignmentLastDecay),
        readingLastInsight: saved.readingLastInsight || defaults.readingLastInsight,
        readingLastRarity: saved.readingLastRarity || defaults.readingLastRarity,
        readingHistory: Array.isArray(saved.readingHistory) ? saved.readingHistory.slice(-5) : defaults.readingHistory,
        readingCooldownEnd: safeNumber(saved.readingCooldownEnd, defaults.readingCooldownEnd),
        readingCooldownDuration: safeNumber(saved.readingCooldownDuration, defaults.readingCooldownDuration),
        readingActiveBuffs: Array.isArray(saved.readingActiveBuffs)
            ? saved.readingActiveBuffs
            : defaults.readingActiveBuffs,
        synthHarvestActiveBuffs: Array.isArray(saved.synthHarvestActiveBuffs)
            ? saved.synthHarvestActiveBuffs
            : defaults.synthHarvestActiveBuffs,
        rlLoopHistory: Array.isArray(saved.rlLoopHistory) ? saved.rlLoopHistory.slice(-5) : defaults.rlLoopHistory,
        rlLoopStrength: {
            compute: safeNumber(saved.rlLoopStrength?.compute, defaults.rlLoopStrength.compute),
            research: safeNumber(saved.rlLoopStrength?.research, defaults.rlLoopStrength.research),
            exploration: safeNumber(saved.rlLoopStrength?.exploration, defaults.rlLoopStrength.exploration),
            quantum: safeNumber(saved.rlLoopStrength?.quantum, defaults.rlLoopStrength.quantum),
        },
        rlLoopActiveBuffs: Array.isArray(saved.rlLoopActiveBuffs)
            ? saved.rlLoopActiveBuffs
            : defaults.rlLoopActiveBuffs,
        rlLoopOptions: Array.isArray(saved.rlLoopOptions) ? saved.rlLoopOptions : defaults.rlLoopOptions,
        rlLoopNextDecisionAt: safeNumber(saved.rlLoopNextDecisionAt, defaults.rlLoopNextDecisionAt),
        synthCycleStart: safeNumber(saved.synthCycleStart, defaults.synthCycleStart),
        synthCycleDuration: safeNumber(saved.synthCycleDuration, defaults.synthCycleDuration),
        synthHarvestLastResult: saved.synthHarvestLastResult || defaults.synthHarvestLastResult,
        synthHarvestBuffEndTime: safeNumber(
            saved.synthHarvestBuffEndTime,
            defaults.synthHarvestBuffEndTime
        ),
        explorationBonuses: {
            ...defaults.explorationBonuses,
            ...(saved.explorationBonuses || {}),
        },
        upgradesBought: saved.upgradesBought ?? defaults.upgradesBought,
        terminalLog: Array.isArray(saved.terminalLog) ? saved.terminalLog : defaults.terminalLog,
        projectsCompleted: saved.projectsCompleted ?? defaults.projectsCompleted,
        projectEffectsApplied: saved.projectEffectsApplied ?? defaults.projectEffectsApplied,
        aiProjectsCompleted: saved.aiProjectsCompleted ?? defaults.aiProjectsCompleted,
        aiProjectEffectsApplied: saved.aiProjectEffectsApplied ?? defaults.aiProjectEffectsApplied,
        flags: {
            ...defaults.flags,
            ...flagsFromSave,
            terminalUnlocked: flagsFromSave.terminalUnlocked ?? false,
            emergenceOffered: flagsFromSave.emergenceOffered ?? defaults.flags.emergenceOffered,
            emergenceChosen: flagsFromSave.emergenceChosen ?? defaults.flags.emergenceChosen,
            consciousnessAwakened:
                flagsFromSave.consciousnessAwakened ?? defaults.flags.consciousnessAwakened,
            gameEnded: flagsFromSave.gameEnded ?? defaults.flags.gameEnded,
            endAcknowledged: flagsFromSave.endAcknowledged ?? defaults.flags.endAcknowledged,
            iaEmergenceReady: flagsFromSave.iaEmergenceReady ?? defaults.flags.iaEmergenceReady,
            iaEmergenceAccepted:
                flagsFromSave.iaEmergenceAccepted ?? defaults.flags.iaEmergenceAccepted,
            iaEmergenceCompleted:
                flagsFromSave.iaEmergenceCompleted ?? defaults.flags.iaEmergenceCompleted,
            iaDebuffEndTime: safeNumber(
                flagsFromSave.iaDebuffEndTime,
                defaults.flags.iaDebuffEndTime
            ),
            iaCapped: flagsFromSave.iaCapped ?? defaults.flags.iaCapped,
            iaOverdriveEndTime: safeNumber(
                flagsFromSave.iaOverdriveEndTime,
                defaults.flags.iaOverdriveEndTime
            ),
        },
        lastTick: nowMs(),
    };

    game.explorationHypers = safeNumber(saved.explorationHypers, defaults.explorationHypers);
    game.universeExploredPercent = safeNumber(
        saved.universeExploredPercent,
        defaults.universeExploredPercent
    );
    game.iaCharge = safeNumber(saved.iaCharge, defaults.iaCharge);
    game.iaChargePerSec = safeNumber(saved.iaChargePerSec, defaults.iaChargePerSec);
    game.scanCount = safeNumber(saved.scanCount, defaults.scanCount);
    game.hyperScanCount = safeNumber(saved.hyperScanCount, defaults.hyperScanCount);
    game.expoFactor = safeNumber(saved.expoFactor, defaults.expoFactor);
    game.productionBoost = safeNumber(saved.productionBoost, defaults.productionBoost);
    game.flags.iaEmergenceReady = flagsFromSave.iaEmergenceReady ?? defaults.flags.iaEmergenceReady;
    game.flags.iaEmergenceAccepted =
        flagsFromSave.iaEmergenceAccepted ?? defaults.flags.iaEmergenceAccepted;
    game.flags.iaEmergenceCompleted =
        flagsFromSave.iaEmergenceCompleted ?? defaults.flags.iaEmergenceCompleted;
    game.flags.iaDebuffEndTime = safeNumber(
        flagsFromSave.iaDebuffEndTime,
        defaults.flags.iaDebuffEndTime
    );
    game.flags.iaCapped = flagsFromSave.iaCapped ?? defaults.flags.iaCapped;
    game.flags.iaOverdriveEndTime = safeNumber(
        flagsFromSave.iaOverdriveEndTime,
        defaults.flags.iaOverdriveEndTime
    );

    if (game.quantumUnlocked && game.quantumComputers < 1) {
        game.quantumComputers = 1;
    }

    // Ensure new quantum computer defaults override legacy saves.
    game.quantumComputerBaseCost = defaults.quantumComputerBaseCost;
    game.quantumComputerCostMultiplier = defaults.quantumComputerCostMultiplier;
    game.quantumComputerPowerPerSec = defaults.quantumComputerPowerPerSec;

    if (!game.terminalLog) {
        game.terminalLog = [];
    }
    if (!game.upgradesBought) {
        game.upgradesBought = {};
    }

    setGameState(game);
    return game;
}

export function saveGameToStorage(game) {
    try {
        const data = JSON.stringify(game);
        localStorage.setItem(SAVE_KEY, data);
    } catch (e) {
        console.error("Error while saving game:", e);
    }
}

export function loadGameFromStorage() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.error("Error while parsing save:", e);
        return null;
    }
}

export function hardResetStorage() {
    localStorage.removeItem(SAVE_KEY);
}

export function parseStoredOrder(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        console.warn("Failed to parse stored order for", key, err);
        return null;
    }
}

function getElementOrderId(el) {
    if (!el) return null;
    if (el.dataset && el.dataset.miniId) {
        return `mini:${el.dataset.miniId}`;
    }
    return el.id || null;
}

export function savePanelOrder() {
    const container = document.getElementById("panels-container");
    if (!container) return;
    const panels = Array.from(container.querySelectorAll(".panel, .mini-game-card"));
    const columns = Array.from(container.querySelectorAll(".panel-column"));
    const columnIndexByElement = new Map(columns.map((col, idx) => [col, idx]));
    const order = [];
    const columnMap = {};
    panels.forEach(panel => {
        const orderId = getElementOrderId(panel);
        if (!orderId) return;
        order.push(orderId);
        const parentColumn = panel.closest(".panel-column");
        const columnIndex = parentColumn ? columnIndexByElement.get(parentColumn) : undefined;
        if (typeof columnIndex === "number") {
            columnMap[orderId] = columnIndex;
        } else if (panel.parentElement === container) {
            columnMap[orderId] = "root";
        }
    });
    localStorage.setItem(PANEL_ORDER_KEY, JSON.stringify(order));
    localStorage.setItem(PANEL_COLUMNS_KEY, JSON.stringify(columnMap));
    // Keep legacy mini-game order key updated for compatibility.
    const miniOrder = panels
        .filter(p => p.classList.contains("mini-game-card"))
        .map(p => p.dataset.miniId)
        .filter(Boolean);
    localStorage.setItem(MINI_GAMES_ORDER_KEY, JSON.stringify(miniOrder));
}

export function restorePanelOrder() {
    const container = document.getElementById("panels-container");
    if (!container) return;
    const savedOrder = parseStoredOrder(PANEL_ORDER_KEY);
    const savedColumns = parseStoredOrder(PANEL_COLUMNS_KEY) || {};
    const columns = Array.from(container.querySelectorAll(".panel-column"));

    if (Array.isArray(savedOrder) && savedOrder.length > 0) {
        savedOrder.forEach(orderId => {
            let panel = null;
            if (typeof orderId === "string" && orderId.startsWith("mini:")) {
                const miniId = orderId.slice(5);
                panel = container.querySelector(`[data-mini-id="${miniId}"]`);
            } else {
                panel = document.getElementById(orderId);
            }
            if (!panel) return;
            const rawIndex = savedColumns[orderId];
            const parsedIndex = Number(rawIndex);
            let targetParent = null;
            if (Number.isInteger(parsedIndex) && columns[parsedIndex]) {
                targetParent = columns[parsedIndex];
            } else if (rawIndex === "root") {
                targetParent = container;
            }
            if (!targetParent) {
                targetParent = panel.closest(".panel-column") || container;
            }
            targetParent.appendChild(panel);
        });
    } else {
        savePanelOrder();
    }
}

export function saveMiniGameOrder() {
    const order = Array.from(document.querySelectorAll(".mini-game-card"))
        .map(card => card.dataset.miniId)
        .filter(Boolean);
    localStorage.setItem(MINI_GAMES_ORDER_KEY, JSON.stringify(order));
}

export function restoreMiniGameOrder() {
    const container = document.getElementById("panels-container");
    if (!container) return;
    // If combined order exists, it will govern placement.
    const combined = parseStoredOrder(PANEL_ORDER_KEY);
    if (Array.isArray(combined) && combined.some(x => typeof x === "string" && x.startsWith("mini:"))) {
        return;
    }
    const savedOrder = parseStoredOrder(MINI_GAMES_ORDER_KEY);
    if (!Array.isArray(savedOrder) || savedOrder.length === 0) {
        if (!localStorage.getItem(MINI_GAMES_ORDER_KEY) && container.querySelector(".mini-game-card")) {
            saveMiniGameOrder();
        }
        return;
    }
    savedOrder.forEach(id => {
        const card = container.querySelector(`[data-mini-id="${id}"]`);
        if (!card) return;
        const parent = card.closest(".panel-column") || container;
        parent.appendChild(card);
    });
}
