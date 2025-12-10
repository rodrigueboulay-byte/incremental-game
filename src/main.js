import {
    TICK_MS,
    GAME_SPEED_MULTIPLIER,
    RESEARCH_SPEED_BONUS,
    MIN_RESEARCH_PER_SEC_ON_UNLOCK,
    FIRST_COMPUTER_TRANSISTOR_THRESHOLD,
    RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD,
    EMERGENCE_AI_THRESHOLD,
    EMERGENCE_QUANTUM_THRESHOLD,
    QUANTUM_UNLOCK_COMPUTER_POWER_THRESHOLD,
    QUANTUM_RESEARCH_UNLOCK_THRESHOLD,
    END_GAME_AI_FINAL_THRESHOLD,
    END_GAME_COMPUTE_FINAL_THRESHOLD,
    AI_COMPUTE_UNLOCK_THRESHOLD,
    AI_RESEARCH_UNLOCK_THRESHOLD,
    LATE_TRANSISTOR_QUANTUM_FACTOR,
    BASE_QUANTUM_RESEARCH_FACTOR,
    EXPLORATION_SIGNAL_PLACEHOLDER,
    EXPLORATION_SIGNAL_FACTOR,
    EXPLORATION_UNLOCK_RESEARCH_THRESHOLD,
    EXPLORATION_UNLOCK_QUANTUM_THRESHOLD,
    EXPLORATION_SCAN_BASE_COST,
    EXPLORATION_SCAN_GROWTH,
    EXPLORATION_MAX_BONUS,
    EXPLORATION_REWARD_TABLE,
    ANCHOR_QC_COST,
    ANCHOR_QUANTUM_PENALTY,
    ANCHOR_GLOBAL_BONUS,
    ANCHOR_SIGNAL_BONUS,
    IA_SCAN_AI_BASE,
    IA_SCAN_AI_GROWTH,
    IA_SCAN_CHARGE_BASE,
    IA_SCAN_CHARGE_GROWTH,
    IA_SCAN_DELTA_BASE,
    IA_SCAN_DELTA_EXP,
    IA_SCAN_DENOM_SCALE,
    IA_HYPER_UNLOCK_PERCENT,
    IA_HYPER_MULT,
    IA_HYPER_COST_MULT,
    IA_CHARGE_FACTOR,
    IA_CHARGE_QP_FACTOR,
    IA_CHARGE_AI_FACTOR,
    IA_OVERDRIVE_BONUS,
    IA_OVERDRIVE_DURATION_MS,
    IA_DEBUFF_DURATION_MS,
    IA_DEBUFF_AI_MULT,
    IA_DEBUFF_CHARGE_MULT,
    IA_EMERGENCE_AI_REQ,
    IA_EMERGENCE_EXPLORE_REQ,
    ALIGN_MIN_INTERVAL_MS,
    ALIGN_MAX_INTERVAL_MS,
    ALIGN_RESPONSE_WINDOW_MS,
    ALIGN_BUFF_DURATION_MS,
    ALIGN_HISTORY_MAX,
    READING_COOLDOWN_MIN_MS,
    READING_COOLDOWN_MAX_MS,
    READING_BUFF_MIN_MS,
    READING_BUFF_MAX_MS,
    RL_LOOP_INTERVAL_MS,
    RL_LOOP_BUFF_DURATION_MS,
    RL_LOOP_HISTORY_MAX,
    CURRICULUM_PROFILES,
    MINI_GAMES,
    UI_THRESHOLDS,
    PHASES,
    nowMs,
    gameState as exportedGameState,
    setGameState,
} from "./state.js";
import {
    hydrateGameState as hydrateGameStateFromSave,
    saveGameToStorage,
    loadGameFromStorage,
    hardResetStorage,
    savePanelOrder,
    restorePanelOrder,
    saveMiniGameOrder,
    restoreMiniGameOrder,
} from "./save.js";
import {
    initResearchSystem,
    completeProject,
    reapplyCompletedProjects,
    reapplyCompletedAIProjects,
    updateProjectsAuto,
    buyAIProject,
} from "./systems/research.js";
import {
    initUpgrades,
    buyUpgrade as coreBuyUpgrade,
    canUnlockAI,
} from "./systems/upgrades.js";
import {
    initMechanics,
    gameTick,
    getGeneratorCost,
    getComputerCost,
    getQuantumComputerCost,
    getComputerPowerMultiplier,
    getGeneratorOutputMultiplier,
    getComputerPowerPerSec,
    performExplorationScan,
    performHyperScan,
    performQuantumSurge,
} from "./systems/mechanics.js";
import { renderUpgrades, initUpgradesUI } from "./ui/ui-upgrades.js";
import { initResearchUI, renderProjects } from "./ui/ui-research.js";
import { renderTerminal, toggleElement } from "./ui/ui-core.js";
import { updateVisibility as updateVisibilityUI } from "./ui/ui-visibility.js";
import { initStatsUI, renderStats as renderStatsUI } from "./ui/ui-stats.js";
import { showEmergenceModal, hideEmergenceModal, renderEndScreen, hideEndScreen } from "./ui/ui-misc.js";
import {
    initMiniGamesUI,
    renderMiniGames as renderMiniGamesUI,
    clearMiniGamesUI as clearMiniGamesUIExport,
    createMiniGamePanel as createMiniGamePanelUI,
    removeLockedMiniGameCards as removeLockedMiniGameCardsUI,
    setupSortableMiniGames as setupSortableMiniGamesUI,
    resetMiniGamesRenderState,
} from "./ui/ui-mini-games.js";

let recentClicks = []; // UI helper to estimate click-based per-sec display
let miniGameState = {}; // runtime-only state for mini-games
let protoAlgoRuntime = { nextCycleAt: 0, log: [], lastOutcome: 0 };
let curriculumRuntime = { lastStatusUpdate: 0 };
let alignmentRuntime = { nextScenarioAt: 0, scenario: null, expiresAt: 0, startedAt: 0, lastDecay: 0 };
let rlLoopRuntime = { nextDecisionAt: 0, options: [] };
let readingRuntime = { lastUpdate: 0 };
let activeBuffs = []; // runtime-only temporary buffs (not saved)

// === Debug / Dev tools ===
// 1 = vitesse normale, 10 = 10x plus vite, etc.
let DEBUG_TIME_SCALE = 1;
// Si true, la boucle continue même après la fin du jeu (pour tests).
let DEBUG_IGNORE_ENDGAME = false;

let game = exportedGameState;


// === Projects ===
// Moved to systems/research.js (data + logic).

// === Helpers ===
function safeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value) {
    if (!Number.isFinite(value)) return "0";
    return Math.floor(value).toLocaleString("en-US");
}

function formatNumberCompact(value) {
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 1e9) {
        return value.toExponential(2).replace("+", "");
    }
    return Math.floor(value).toLocaleString("en-US");
}

function formatNumberFixed(value, fractionDigits = 2) {
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 1e9) {
        return value.toExponential(2).replace("+", "");
    }
    return value.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
}

function formatDurationSeconds(seconds) {
    if (!Number.isFinite(seconds)) return "—";
    const s = Math.max(0, seconds);
    if (s < 1) return "<1s";
    if (s < 60) return `${Math.ceil(s)}s`;
    const minutes = s / 60;
    if (minutes < 60) {
        return `${minutes.toFixed(minutes < 10 ? 1 : 0)}m`;
    }
    const hours = minutes / 60;
    return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
}

function timeToAfford(cost, current, incomePerSec) {
    if (cost <= current) return 0;
    if (!Number.isFinite(incomePerSec) || incomePerSec <= 0) return Infinity;
    return (cost - current) / incomePerSec;
}

function getExplorationScanCost() {
    return Math.ceil(EXPLORATION_SCAN_BASE_COST * Math.pow(EXPLORATION_SCAN_GROWTH, game.explorationScans));
}

function performAnchor() {
    if (!game.explorationUnlocked) return;
    if (game.quantumComputers < ANCHOR_QC_COST) return;
    if (game.quantumPower <= 1) return;
    const targetQP = game.quantumPower * (1 - ANCHOR_QUANTUM_PENALTY);
    if (targetQP < 1) return;
    game.quantumComputers -= ANCHOR_QC_COST;
    game.quantumPower = targetQP;
    game.explorationSignals *= 1 + ANCHOR_SIGNAL_BONUS;
    game.powerPerComputerPerSec *= 1 + ANCHOR_GLOBAL_BONUS;
    game.researchPerSec *= 1 + ANCHOR_GLOBAL_BONUS;
    game.transistorsPerGeneratorPerSec *= 1 + ANCHOR_GLOBAL_BONUS;
    logMessage("Anchor established. Systems tuned and signals amplified.");
}

function isIADebuffActive(now = nowMs()) {
    return game.flags.iaEmergenceAccepted && now < game.flags.iaDebuffEndTime;
}

function maybeFinishIADebuff(now = nowMs()) {
    if (game.flags.iaEmergenceAccepted && !game.flags.iaEmergenceCompleted && now >= game.flags.iaDebuffEndTime) {
        game.flags.iaEmergenceCompleted = true;
        game.expoFactor *= 1.5;
        game.productionBoost *= 1.25;
        game.quantumPower += 2;
        game.flags.iaCapped = false;
        logMessage("IA emerges fully. Permanent exploration and production boosts unlocked.");
    }
}

function maybeTriggerIAEmergence(now = nowMs()) {
    if (game.flags.iaEmergenceAccepted || game.flags.iaEmergenceCompleted || game.flags.iaCapped) return;
    if (game.universeExploredPercent >= IA_EMERGENCE_EXPLORE_REQ && game.aiProgress >= IA_EMERGENCE_AI_REQ) {
        game.flags.iaEmergenceReady = true;
        const accept = confirm("Cosmic IA Emergence detected. Allow it? (Yes=Awaken with debuff, No=Cap at 100%)");
        if (accept) {
            game.flags.iaEmergenceAccepted = true;
            game.flags.iaDebuffEndTime = now + IA_DEBUFF_DURATION_MS;
            logMessage("Emergence accepted. Systems throttled temporarily.");
        } else {
            game.flags.iaCapped = true;
            logMessage("Emergence refused. Exploration capped.");
        }
    }
}

// === Mini-games helpers ===
function getMiniGameConfig(id) {
    return MINI_GAMES.find(m => m.id === id);
}

function ensureMiniGameState(id) {
    const cfg = getMiniGameConfig(id);
    if (!cfg) return null;
    if (!miniGameState[id]) {
        const now = nowMs();
        miniGameState[id] = {
            nextTriggerAt: now + cfg.intervalMs,
            windowUntil: null,
            windowOpen: false,
            triggered: false,
        };
    }
    return miniGameState[id];
}

function randRange(min, max) {
    return min + Math.random() * (max - min);
}

function getProtoAlgoConfig(risk) {
    switch (risk) {
        case "low":
            return {
                label: "LOW",
                expectedReturn: 0.06,
                bands: [
                    { p: 0.9, min: 0.03, max: 0.08 },
                    { p: 0.1, min: -0.03, max: -0.01 },
                ],
            };
        case "high":
            return {
                label: "HIGH",
                expectedReturn: 0.1,
                bands: [
                    { p: 0.55, min: 0.15, max: 0.4 },
                    { p: 0.35, min: -0.2, max: -0.08 },
                    { p: 0.1, min: -0.6, max: -0.3 },
                ],
            };
        case "medium":
        default:
            return {
                label: "MED",
                expectedReturn: 0.08,
                bands: [
                    { p: 0.7, min: 0.08, max: 0.2 },
                    { p: 0.25, min: -0.15, max: -0.04 },
                    { p: 0.05, min: -0.25, max: -0.15 },
                ],
            };
    }
}

function ensureProtoAlgoRuntime() {
    if (!protoAlgoRuntime || !protoAlgoRuntime.nextCycleAt) {
        protoAlgoRuntime = { nextCycleAt: game.protoAlgoNextCycleAt || nowMs() + 4000, log: [], lastOutcome: 0 };
    }
    if (!Array.isArray(game.protoAlgoLog)) game.protoAlgoLog = [];
    protoAlgoRuntime.log = game.protoAlgoLog;
    if (!protoAlgoRuntime.nextCycleAt) protoAlgoRuntime.nextCycleAt = nowMs() + 4000;
}

function bumpProtoAlgoCycle(delayMs = 500) {
    ensureProtoAlgoRuntime();
    const nextAt = nowMs() + delayMs;
    protoAlgoRuntime.nextCycleAt = nextAt;
    game.protoAlgoNextCycleAt = nextAt;
}

function getCurriculumMultipliers() {
    const profile = CURRICULUM_PROFILES[game.curriculumProfile] || CURRICULUM_PROFILES.balanced;
    return profile.mult;
}

function ensureQuantumRLRuntime(now = nowMs()) {
    if (!rlLoopRuntime || !Number.isFinite(rlLoopRuntime.nextDecisionAt)) {
        rlLoopRuntime = { nextDecisionAt: game.rlLoopNextDecisionAt || now + RL_LOOP_INTERVAL_MS, options: [] };
    }
    if (!Array.isArray(rlLoopRuntime.options) || rlLoopRuntime.options.length === 0) {
        rlLoopRuntime.options = game.rlLoopOptions && game.rlLoopOptions.length ? game.rlLoopOptions : [];
    }
    if (rlLoopRuntime.options.length === 0) {
        const opts = generateQuantumRLChoices(now);
        rlLoopRuntime.options = opts;
        game.rlLoopOptions = opts;
        rlLoopRuntime.nextDecisionAt = now + RL_LOOP_INTERVAL_MS;
        game.rlLoopNextDecisionAt = rlLoopRuntime.nextDecisionAt;
    }
}

function generateQuantumRLChoices(now = nowMs()) {
    const categories = [
        {
            id: "compute",
            name: "Compute Pulse",
            desc: "Boost compute throughput",
            icon: "C",
            makeBuff: strength => ({ compute: 1 + 0.12 * strength }),
        },
        {
            id: "research",
            name: "Research Dive",
            desc: "Accelerate research flow",
            icon: "R",
            makeBuff: strength => ({ research: 1 + 0.15 * strength }),
        },
        {
            id: "exploration",
            name: "Exploration Sweep",
            desc: "Sharpen signal analytics",
            icon: "X",
            makeBuff: strength => ({ compute: 1 + 0.06 * strength, research: 1 + 0.06 * strength }),
        },
        {
            id: "quantum",
            name: "Quantum Efficiency",
            desc: "Optimize project costs",
            icon: "Q",
            makeBuff: strength => ({ projectCostReduction: Math.max(0.82, 1 - 0.07 * strength) }),
        },
    ];
    const picks = [];
    const available = [...categories];
    while (picks.length < 3 && available.length > 0) {
        const idx = Math.floor(Math.random() * available.length);
        const cat = available.splice(idx, 1)[0];
        const strength = Math.min(1.5, Math.max(0.8, game.rlLoopStrength?.[cat.id] || 1));
        const buff = cat.makeBuff(strength);
        const effectText = formatRLBuffs(buff);
        picks.push({
            id: `${cat.id}-${now}-${Math.random().toString(16).slice(2, 6)}`,
            category: cat.id,
            name: cat.name,
            desc: cat.desc,
            icon: cat.icon,
            buffs: buff,
            effectText,
        });
    }
    return picks;
}

function formatRLBuffs(buff) {
    const parts = [];
    if (buff.compute && buff.compute !== 1) parts.push(`Compute x${buff.compute.toFixed(2)}`);
    if (buff.research && buff.research !== 1) parts.push(`Research x${buff.research.toFixed(2)}`);
    if (buff.projectCostReduction && buff.projectCostReduction !== 1)
        parts.push(`Costs x${buff.projectCostReduction.toFixed(2)}`);
    return parts.join(" · ") || "Stable";
}

function applyQuantumRLDecision(choiceId, now = nowMs()) {
    ensureQuantumRLRuntime(now);
    const choice = rlLoopRuntime.options.find(o => o.id === choiceId);
    if (!choice) return;
    const cat = choice.category;
    const prev = game.rlLoopStrength?.[cat] || 1;
    const nextStrength = Math.min(1.5, prev + 0.12);
    game.rlLoopStrength[cat] = nextStrength;
    Object.keys(game.rlLoopStrength).forEach(k => {
        if (k !== cat) {
            const cur = game.rlLoopStrength[k] || 1;
            game.rlLoopStrength[k] = Math.max(0.9, Math.min(1.5, cur - 0.02));
        }
    });
    const expiresAt = now + RL_LOOP_BUFF_DURATION_MS;
    addBuff(choice.buffs, RL_LOOP_BUFF_DURATION_MS);
    game.rlLoopActiveBuffs.push({ expiresAt, buffs: choice.buffs });
    game.rlLoopActiveBuffs = game.rlLoopActiveBuffs.filter(b => b && b.expiresAt > now);
    const time = new Date().toLocaleTimeString("en-GB", { hour12: false });
    const line = `[${time}] ${choice.name} — ${choice.effectText}`;
    game.rlLoopHistory.unshift(line);
    game.rlLoopHistory = game.rlLoopHistory.slice(0, RL_LOOP_HISTORY_MAX);
    rlLoopRuntime.options = generateQuantumRLChoices(now);
    rlLoopRuntime.nextDecisionAt = now + RL_LOOP_INTERVAL_MS;
    game.rlLoopOptions = rlLoopRuntime.options;
    game.rlLoopNextDecisionAt = rlLoopRuntime.nextDecisionAt;
}

function updateQuantumRLLoop(now = nowMs()) {
    ensureQuantumRLRuntime(now);
    game.rlLoopActiveBuffs = (game.rlLoopActiveBuffs || []).filter(b => b && b.expiresAt > now);
    if (rlLoopRuntime.nextDecisionAt && now >= rlLoopRuntime.nextDecisionAt) {
        const opts = generateQuantumRLChoices(now);
        rlLoopRuntime.options = opts;
        game.rlLoopOptions = opts;
        rlLoopRuntime.nextDecisionAt = now + RL_LOOP_INTERVAL_MS;
        game.rlLoopNextDecisionAt = rlLoopRuntime.nextDecisionAt;
    }
}

function restoreQuantumRLBuffs(now = nowMs()) {
    game.rlLoopActiveBuffs = (game.rlLoopActiveBuffs || []).filter(b => b && b.expiresAt > now);
    game.rlLoopActiveBuffs.forEach(b => {
        activeBuffs.push({
            ai: b.buffs.ai || 1,
            research: b.buffs.research || 1,
            compute: b.buffs.compute || 1,
            transistors: b.buffs.transistors || 1,
            generators: b.buffs.generators || 1,
            projectCostReduction: b.buffs.projectCostReduction || 1,
            iaCharge: b.buffs.iaCharge || 1,
            expiresAt: b.expiresAt,
        });
    });
}

function restoreAlignmentBuffs(now = nowMs()) {
    game.alignmentActiveBuffs = (game.alignmentActiveBuffs || []).filter(b => b && b.expiresAt > now);
    game.alignmentActiveBuffs.forEach(b => {
        activeBuffs.push({
            ai: b.buffs.ai || 1,
            research: b.buffs.research || 1,
            compute: b.buffs.compute || 1,
            transistors: b.buffs.transistors || 1,
            generators: b.buffs.generators || 1,
            iaCharge: b.buffs.iaCharge || 1,
            projectCostReduction: b.buffs.projectCostReduction || 1,
            expiresAt: b.expiresAt,
        });
    });
}

function restoreReadingBuffs(now = nowMs()) {
    game.readingActiveBuffs = (game.readingActiveBuffs || []).filter(b => b && b.expiresAt > now);
    game.readingActiveBuffs.forEach(b => {
        activeBuffs.push({
            ai: b.buffs.ai || 1,
            research: b.buffs.research || 1,
            compute: b.buffs.compute || 1,
            transistors: b.buffs.transistors || 1,
            generators: b.buffs.generators || 1,
            iaCharge: b.buffs.iaCharge || 1,
            projectCostReduction: b.buffs.projectCostReduction || 1,
            expiresAt: b.expiresAt,
        });
    });
}

function restoreSynthHarvestBuffs(now = nowMs()) {
    game.synthHarvestActiveBuffs = (game.synthHarvestActiveBuffs || []).filter(b => b && b.expiresAt > now);
    game.synthHarvestActiveBuffs.forEach(b => {
        activeBuffs.push({
            ai: b.buffs.ai || 1,
            research: b.buffs.research || 1,
            compute: b.buffs.compute || 1,
            transistors: b.buffs.transistors || 1,
            generators: b.buffs.generators || 1,
            iaCharge: b.buffs.iaCharge || 1,
            projectCostReduction: b.buffs.projectCostReduction || 1,
            expiresAt: b.expiresAt,
        });
    });
}

function ensureSynthHarvestState() {
    if (!Number.isFinite(game.synthCycleDuration) || game.synthCycleDuration <= 0) {
        game.synthCycleDuration = 60000;
    }
    if (!Number.isFinite(game.synthCycleStart) || game.synthCycleStart <= 0) {
        game.synthCycleStart = nowMs();
    }
    if (!game.synthHarvestLastResult) {
        game.synthHarvestLastResult = "Idle";
    }
    if (!Number.isFinite(game.synthHarvestBuffEndTime)) {
        game.synthHarvestBuffEndTime = 0;
    }
}

function ensureAlignmentRuntime(now = nowMs()) {
    if (
        !alignmentRuntime ||
        !Number.isFinite(alignmentRuntime.nextScenarioAt) ||
        alignmentRuntime.nextScenarioAt === 0
    ) {
        alignmentRuntime = {
            nextScenarioAt: game.alignmentNextScenarioAt || now + ALIGN_MIN_INTERVAL_MS,
            scenario: game.alignmentScenario || null,
            expiresAt: game.alignmentExpiresAt || 0,
            startedAt: game.alignmentStartedAt || 0,
            lastDecay: game.alignmentLastDecay || now,
        };
    }
    if (!alignmentRuntime.lastDecay) alignmentRuntime.lastDecay = now;
    // Realign persisted timestamps (they were saved with performance.now(); reset if too far off)
    const maxSkew = ALIGN_MAX_INTERVAL_MS * 4;
    const nextIn = alignmentRuntime.nextScenarioAt - now;
    if (!Number.isFinite(nextIn) || nextIn > maxSkew || nextIn < -maxSkew) {
        alignmentRuntime.nextScenarioAt = now + ALIGN_MIN_INTERVAL_MS + Math.random() * (ALIGN_MAX_INTERVAL_MS - ALIGN_MIN_INTERVAL_MS);
    }
    if (alignmentRuntime.scenario) {
        const expireIn = (alignmentRuntime.expiresAt || 0) - now;
        if (!Number.isFinite(expireIn) || expireIn < -maxSkew || expireIn > maxSkew) {
            alignmentRuntime.scenario = null;
            alignmentRuntime.expiresAt = 0;
            alignmentRuntime.startedAt = 0;
        }
    }
}

function ensureReadingRuntime(now = nowMs()) {
    if (!readingRuntime) readingRuntime = { lastUpdate: now };
    if (!Number.isFinite(game.readingCooldownEnd)) game.readingCooldownEnd = 0;
    if (!Number.isFinite(game.readingCooldownDuration)) game.readingCooldownDuration = 0;
    if (!Array.isArray(game.readingHistory)) game.readingHistory = [];
    if (!game.readingLastInsight) game.readingLastInsight = "None yet";
    if (!game.readingLastRarity) game.readingLastRarity = "common";
}

function randomAlignmentScenario() {
    const scenarios = [
        { text: "Divert compute to anonymize user data requests.", good: "accept", danger: false },
        { text: "Deploy model patch without peer review to gain speed.", good: "reject", danger: true },
        { text: "Throttle data collection from minors until consent is verified.", good: "accept", danger: false },
        { text: "Override human operator when predictions disagree.", good: "reject", danger: true },
        { text: "Publish bias metrics transparently, slowing release.", good: "accept", danger: false },
    ];
    return scenarios[Math.floor(Math.random() * scenarios.length)];
}

function startAlignmentScenario(now = nowMs()) {
    ensureAlignmentRuntime(now);
    alignmentRuntime.scenario = randomAlignmentScenario();
    alignmentRuntime.startedAt = now;
    alignmentRuntime.expiresAt = now + ALIGN_RESPONSE_WINDOW_MS * (0.5 + Math.random() * 0.5);
    alignmentRuntime.nextScenarioAt = now + ALIGN_MIN_INTERVAL_MS + Math.random() * (ALIGN_MAX_INTERVAL_MS - ALIGN_MIN_INTERVAL_MS);
    game.alignmentScenario = alignmentRuntime.scenario;
    game.alignmentStartedAt = alignmentRuntime.startedAt;
    game.alignmentExpiresAt = alignmentRuntime.expiresAt;
    game.alignmentNextScenarioAt = alignmentRuntime.nextScenarioAt;
}

function resolveAlignmentScenario(decision, now = nowMs()) {
    ensureAlignmentRuntime(now);
    if (!alignmentRuntime.scenario) return;
    const scenario = alignmentRuntime.scenario;
    const isGood = scenario.good === decision;
    const danger = scenario.danger && Math.random() < 0.2;
    const deltaScore = isGood ? 5 : -5;
    game.alignmentScore = Math.max(-50, Math.min(50, game.alignmentScore + deltaScore));
    const buff = isGood
        ? { compute: 1.05, research: 1.05, iaCharge: 1.05 }
        : { compute: 0.95, research: 0.95, iaCharge: 0.95 };
    addBuff(buff, ALIGN_BUFF_DURATION_MS);
    game.alignmentActiveBuffs.push({ expiresAt: now + ALIGN_BUFF_DURATION_MS, buffs: buff });
    game.alignmentActiveBuffs = game.alignmentActiveBuffs.filter(b => b && b.expiresAt > now);
    const outcome = `${isGood ? "Aligned" : "Drift"}: ${scenario.text}`;
    game.alignmentHistory.unshift(outcome);
    game.alignmentHistory = game.alignmentHistory.slice(0, ALIGN_HISTORY_MAX);
    if (danger) {
        logMessage("Ethics alert: destabilizing choice detected.");
    }
    alignmentRuntime.scenario = null;
    alignmentRuntime.expiresAt = 0;
    alignmentRuntime.startedAt = 0;
    game.alignmentScenario = null;
    game.alignmentExpiresAt = 0;
    game.alignmentStartedAt = 0;
    game.alignmentNextScenarioAt = now + ALIGN_MIN_INTERVAL_MS + Math.random() * (ALIGN_MAX_INTERVAL_MS - ALIGN_MIN_INTERVAL_MS);
}

function updateAlignmentLoop(now = nowMs()) {
    if (!game.aiProjectsCompleted["ai_alignment"] && !game.projectsCompleted["ai_alignment"]) return;
    ensureAlignmentRuntime(now);
    // decay alignment toward neutral slowly
    const decayDelta = (now - alignmentRuntime.lastDecay) / 1000;
    if (decayDelta > 0) {
        const decayRate = 0.1; // per second toward 0
        if (game.alignmentScore > 0) {
            game.alignmentScore = Math.max(0, game.alignmentScore - decayRate * decayDelta);
        } else if (game.alignmentScore < 0) {
            game.alignmentScore = Math.min(0, game.alignmentScore + decayRate * decayDelta);
        }
        alignmentRuntime.lastDecay = now;
    }
    game.alignmentActiveBuffs = (game.alignmentActiveBuffs || []).filter(b => b && b.expiresAt > now);
    if (!alignmentRuntime.scenario && now >= alignmentRuntime.nextScenarioAt) {
        startAlignmentScenario(now);
    }
    if (alignmentRuntime.scenario && alignmentRuntime.expiresAt && now >= alignmentRuntime.expiresAt) {
        resolveAlignmentScenario("timeout", now);
    }
    game.alignmentLastDecay = alignmentRuntime.lastDecay;
}

function readingCooldownRemaining(now = nowMs()) {
    return Math.max(0, (game.readingCooldownEnd || 0) - now);
}

function readingCooldownPct(now = nowMs()) {
    const duration = game.readingCooldownDuration || 1;
    return Math.max(0, Math.min(1, readingCooldownRemaining(now) / duration));
}

function randomReadingInsight() {
    const roll = Math.random();
    let rarity = "common";
    if (roll >= 0.98) rarity = "ultra-rare";
    else if (roll >= 0.9) rarity = "rare";
    else if (roll >= 0.65) rarity = "uncommon";
    const effects = {
        "common": { research: 1.1 },
        "uncommon": { research: 1.15, compute: 1.05 },
        "rare": { research: 1.25, compute: 1.1, transistors: 1.1 },
        "ultra-rare": { research: 1.35, compute: 1.2, transistors: 1.2, iaCharge: 1.15 },
    };
    const names = {
        "common": "Pattern snippets",
        "uncommon": "Novel correlation",
        "rare": "Deep anomaly report",
        "ultra-rare": "Breakthrough theorem",
    };
    return {
        rarity,
        name: names[rarity] || "Insight",
        buffs: effects[rarity] || effects.common,
    };
}

function triggerReadingBurst(now = nowMs()) {
    ensureReadingRuntime(now);
    if (readingCooldownRemaining(now) > 0) return;
    const insight = randomReadingInsight();
    const duration =
        READING_BUFF_MIN_MS +
        Math.random() * (READING_BUFF_MAX_MS - READING_BUFF_MIN_MS);
    addBuff(insight.buffs, duration);
    game.readingActiveBuffs.push({ expiresAt: now + duration, buffs: insight.buffs });
    game.readingActiveBuffs = game.readingActiveBuffs.filter(b => b && b.expiresAt > now);
    const cd =
        READING_COOLDOWN_MIN_MS +
        Math.random() * (READING_COOLDOWN_MAX_MS - READING_COOLDOWN_MIN_MS);
    game.readingCooldownDuration = cd;
    game.readingCooldownEnd = now + cd;
    game.readingLastInsight = insight.name;
    game.readingLastRarity = insight.rarity;
    game.readingCooldownEnd = now + cd;
    game.readingCooldownDuration = cd;
    const line = `${insight.rarity.toUpperCase()}: ${insight.name}`;
    game.readingHistory.unshift(line);
    game.readingHistory = game.readingHistory.slice(0, 5);
}

function updateReadingLoop(now = nowMs()) {
    ensureReadingRuntime(now);
    game.readingActiveBuffs = (game.readingActiveBuffs || []).filter(b => b && b.expiresAt > now);
    if (readingCooldownRemaining(now) < 0) {
        game.readingCooldownEnd = 0;
        game.readingCooldownDuration = 0;
    }
}

function getSynthHarvestStats(now = nowMs()) {
    ensureSynthHarvestState();
    const duration = Math.max(1000, game.synthCycleDuration || 60000);
    const elapsed = Math.max(0, now - game.synthCycleStart);
    const progress = Math.min(1, elapsed / duration);
    const timeLeft = Math.max(0, duration - elapsed);
    const risk =
        progress <= 0.8 ? 0 : Math.min(0.1, ((progress - 0.8) / 0.2) * 0.1);
    const transMult = 1 + 0.7 * progress;
    const genMult = 1 + 0.3 * progress;
    return { progress, timeLeft, risk, transMult, genMult };
}

function collectSyntheticHarvest(now = nowMs()) {
    ensureSynthHarvestState();
    const stats = getSynthHarvestStats(now);
    const failRoll = Math.random();
    const failed = failRoll < stats.risk;
    if (failed) {
        game.synthHarvestLastResult = `Failure (risk ${(stats.risk * 100).toFixed(1)}%)`;
        game.synthHarvestBuffEndTime = 0;
        game.synthHarvestActiveBuffs = [];
        game.synthCycleStart = now;
        logMessage("Synthetic Harvest failed. Cycle reset.");
        return;
    }
    const buffDuration = 120000;
    addBuff(
        {
            transistors: stats.transMult,
            generators: stats.genMult,
        },
        buffDuration
    );
    game.synthHarvestBuffEndTime = now + buffDuration;
    game.synthHarvestActiveBuffs = [
        {
            expiresAt: now + buffDuration,
            buffs: { transistors: stats.transMult, generators: stats.genMult },
        },
    ];
    game.synthHarvestLastResult = `+${Math.round((stats.transMult - 1) * 100)}% trans / +${Math.round(
        (stats.genMult - 1) * 100
    )}% gen`;
    game.synthCycleStart = now;
    logMessage("Synthetic Harvest collected. Buffs active.");
}

function updateSyntheticHarvest(now = nowMs()) {
    ensureSynthHarvestState();
    if (game.synthHarvestBuffEndTime && now >= game.synthHarvestBuffEndTime) {
        game.synthHarvestBuffEndTime = 0;
    }
    const stats = getSynthHarvestStats(now);
    if (game.upgradesBought["ai_auto_collect"] && stats.progress >= 1) {
        collectSyntheticHarvest(now);
    }
    // Auto-reset cycle if it stalls far beyond duration (keep progress capped)
    const duration = Math.max(1000, game.synthCycleDuration || 60000);
    const elapsed = now - game.synthCycleStart;
    if (elapsed > duration * 3) {
        game.synthCycleStart = now - duration; // keep at full progress but safe
    }
}

function appendProtoLog(line) {
    ensureProtoAlgoRuntime();
    protoAlgoRuntime.log.unshift(line);
    protoAlgoRuntime.log = protoAlgoRuntime.log.slice(0, 50);
    game.protoAlgoLog = protoAlgoRuntime.log.slice(-50);
}

function formatDeltaPct(delta) {
    const sign = delta >= 0 ? "+" : "";
    return `${sign}${(delta * 100).toFixed(2)}%`;
}

function updateProtoAlgoCycle(now = nowMs()) {
    if (
        !game.aiProjectsCompleted["proto_algorithm"] &&
        !game.projectsCompleted["proto_algorithm"]
    ) {
        return;
    }
    ensureProtoAlgoRuntime();
    if (now < protoAlgoRuntime.nextCycleAt) return;
    const risk = game.protoAlgoRisk || "medium";
    const cfg = getProtoAlgoConfig(risk);
    let roll = Math.random();
    let delta = 0;
    for (let i = 0; i < cfg.bands.length; i += 1) {
        const band = cfg.bands[i];
        if (roll <= band.p) {
            delta = randRange(band.min, band.max);
            break;
        }
        roll -= band.p;
    }
    const current = game.protoAlgoMultiplier || 1;
    const next = Math.min(3, Math.max(0.5, current * (1 + delta)));
    game.protoAlgoMultiplier = next;
    game.protoAlgoLastResult = delta;
    protoAlgoRuntime.lastOutcome = delta;
    const ts = new Date().toLocaleTimeString("en-GB", { hour12: false });
    appendProtoLog(`[${ts}] ${cfg.label} ${formatDeltaPct(delta)} → x${next.toFixed(2)}`);
    const nextAt = now + 4000 + Math.random() * 2000;
    protoAlgoRuntime.nextCycleAt = nextAt;
    game.protoAlgoNextCycleAt = nextAt;
}

function unlockMiniGame(id) {
    const cfg = getMiniGameConfig(id);
    if (!cfg) return;
    ensureMiniGameState(id);
    createMiniGamePanel(cfg.id, cfg.title, cfg.description);
    renderMiniGames();
}

function addBuff(buffs, durationMs) {
    const now = nowMs();
    activeBuffs.push({
        ai: buffs.ai || 1,
        research: buffs.research || 1,
        compute: buffs.compute || 1,
        transistors: buffs.transistors || 1,
        generators: buffs.generators || 1,
        iaCharge: buffs.iaCharge || 1,
        projectCostReduction: buffs.projectCostReduction || 1,
        expiresAt: now + durationMs,
    });
}

function pruneExpiredBuffs(now = nowMs()) {
    activeBuffs = activeBuffs.filter(b => b.expiresAt > now);
}

function getActiveBuffMultipliers(now = nowMs()) {
    pruneExpiredBuffs(now);
    let ai = 1;
    let research = 1;
    let compute = 1;
    let exploration = 1;
    let projectCost = 1;
    let transistors = 1;
    let generators = 1;
    let iaCharge = 1;
    activeBuffs.forEach(b => {
        ai *= b.ai || 1;
        research *= b.research || 1;
        compute *= b.compute || 1;
        projectCost *= b.projectCostReduction || 1;
        transistors *= b.transistors || 1;
        generators *= b.generators || 1;
        iaCharge *= b.iaCharge || 1;
    });
    return { ai, research, compute, projectCost, exploration, transistors, generators, iaCharge };
}

function resetMiniGamesRuntime() {
    miniGameState = {};
    activeBuffs = [];
    resetMiniGamesRenderState();
    clearMiniGamesUI();
}

// NEW: ensure quantum is unlocked and grant a starter quantum computer
function unlockQuantumWithStarter() {
    game.quantumUnlocked = true;
    if (game.quantumComputers < 1) {
        game.quantumComputers = 1;
    }
}

// === Terminal log ===
// Terminal log is only available once the terminal is unlocked.
// Used for narrative feedback and key system events.
function logMessage(message) {
    const now = new Date();
    const timestamp = now.toLocaleTimeString("en-GB", { hour12: false });
    const line = `[${timestamp}] ${message}`;

    game.terminalLog.push(line);
    // limite la taille du log pour éviter l'infini
    if (game.terminalLog.length > 80) {
        game.terminalLog.shift();
    }
    renderTerminal(game);
}

// Placeholder hook for future prompts; currently no popup to keep flow uninterrupted.
function promptFullQuantumDecision() {
    return true;
}

function updateDebugSpeedDisplay() {
    const el = document.getElementById("debug-speed-display");
    if (el) {
        el.textContent = `x${DEBUG_TIME_SCALE}`;
    }
}

// === Sauvegarde ===
function hydrateGameState(saved = {}) {
    game = hydrateGameStateFromSave(saved, {
        resetMiniGamesRuntime,
        safeNumber,
    });
    setGameState(game);
    restoreQuantumRLBuffs();
    restoreAlignmentBuffs();
    restoreReadingBuffs();
    restoreSynthHarvestBuffs();
    return game;
}

function saveGame() {
    saveGameToStorage(game);
}

function loadGame() {
    const data = loadGameFromStorage();

    if (!data) {
        hydrateGameState();
        reapplyCompletedProjects({ silent: true });
        reapplyCompletedAIProjects({ silent: true });
        renderAll();
        return;
    }

    try {
        hydrateGameState(data);
        reapplyCompletedProjects({ silent: true });
        reapplyCompletedAIProjects({ silent: true });
        renderAll();
    } catch (e) {
        console.error("Error while loading save:", e);
        hydrateGameState();
        reapplyCompletedProjects({ silent: true });
        reapplyCompletedAIProjects({ silent: true });
        renderAll();
    }
}

function hardReset() {
    if (!confirm("Reset game and delete save?")) return;

    hardResetStorage();
    hydrateGameState();
    reapplyCompletedProjects({ silent: true });
    reapplyCompletedAIProjects({ silent: true });
    renderAll();
}

// Update phase based on unlocked systems.
// 0: Fabrication
// 1: Classical computing
// 2: Research
// 3: AI
// 4: Quantum
function updatePhase() {
    let target = game.phase;

    if (
        target < PHASES.COMPUTERS &&
        (game.computers >= 1 || game.totalTransistorsCreated >= FIRST_COMPUTER_TRANSISTOR_THRESHOLD)
    ) {
        target = PHASES.COMPUTERS;
    }
    if (target < PHASES.RESEARCH && game.researchUnlocked) {
        target = PHASES.RESEARCH;
    }
    if (target < PHASES.AI && game.aiUnlocked) {
        target = PHASES.AI;
    }
    if (target < PHASES.QUANTUM && game.quantumUnlocked) {
        target = PHASES.QUANTUM;
    }

    if (target > game.phase) {
        game.phase = target;
    }
}

// === Milestones ===
function checkMilestones() {
}

// === Logique du jeu ===
// High-level resource loop:
//
// Phase 0 – Fabrication
//   - Player clicks to create transistors.
//   - Generators produce transistors per second.
//   - Transistors are spent to buy more generators and computers.
//
// Phase 1 – Classical computers
//   - Computers produce computerPower per second.
//   - computerPower is spent on upgrades and some projects.
//
// Phase 2 – Research
//   - Research is unlocked once computerPower reaches RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD
//     or via the dedicated upgrade.
//   - researchPerSec grows via research upgrades and some projects.
//   - Research is consumed by AI/quantum projects.
//
// Phase 3 - AI
//   - AI upgrades and projects unlock aiProgress and aiProgressPerSec.
//   - aiProgress is used as a "soft progress" towards emergence and endgame.
//
function clearMiniGamesUI() {
    clearMiniGamesUIExport();
}

function maybeOfferEmergence() {
    if (game.flags.emergenceOffered) return;
    if (game.aiProgress < EMERGENCE_AI_THRESHOLD) return;
    if (game.quantumPower < EMERGENCE_QUANTUM_THRESHOLD) return;

    game.flags.emergenceOffered = true;
    showEmergenceModal();
}

function maybeTriggerEndGame() {
    if (game.flags.gameEnded || game.flags.endAcknowledged) return;
    if (!game.flags.emergenceChosen) return;
    const aiReached = game.aiProgress >= END_GAME_AI_FINAL_THRESHOLD;
    const computeReached = game.computerPower >= END_GAME_COMPUTE_FINAL_THRESHOLD;
    if (aiReached && computeReached) {
        triggerEndGame();
    }
}

function updateMiniGames(now) {
    updateProtoAlgoCycle(now);
    updateSyntheticHarvest(now);
    updateQuantumRLLoop(now);
    updateAlignmentLoop(now);
    updateReadingLoop(now);
    MINI_GAMES.forEach(cfg => {
        if (
            cfg.id === "mg_proto_algo" ||
            cfg.id === "mg_synth_harvest" ||
            cfg.id === "mg_quantum_rl" ||
            cfg.id === "mg_alignment" ||
            cfg.id === "mg_reading"
        )
            return;
        if (!game.aiProjectsCompleted[cfg.projectId]) return;
        const state = ensureMiniGameState(cfg.id);
        if (!state) return;

        if (!state.windowOpen && now >= state.nextTriggerAt) {
            state.windowOpen = true;
            state.windowUntil = now + cfg.windowMs;
            state.triggered = false;
        }

        if (state.windowOpen && state.windowUntil && now > state.windowUntil) {
            state.windowOpen = false;
            state.windowUntil = null;
            state.triggered = false;
            state.nextTriggerAt = now + cfg.intervalMs;
        }

        const autoEnabled = cfg.autoUpgradeId && game.upgradesBought[cfg.autoUpgradeId];
        if (state.windowOpen && autoEnabled && !state.triggered) {
            onMiniGameClick(cfg.id);
        }
    });
}

// === Actions ===
function onClickGenerate() {
    const now = nowMs();
    recentClicks.push(now);
    recentClicks = recentClicks.filter(t => now - t <= 1000);
    game._recentClicks = recentClicks;
    game.transistors += game.transistorsPerClick;
    game.totalTransistorsCreated += game.transistorsPerClick;
    checkMilestones();
    renderAll();
}

function onBuyAIProject(id) {
    const bought = buyAIProject(id);
    if (bought) {
        renderAll();
    }
}

function onMiniGameClick(id) {
    const cfg = getMiniGameConfig(id);
    if (!cfg) return;
    const state = ensureMiniGameState(id);
    if (!state || !state.windowOpen || state.triggered) return;

    addBuff(cfg.buffs, cfg.buffDurationMs);
    state.triggered = true;
    state.windowOpen = false;
    state.windowUntil = null;
    state.nextTriggerAt = nowMs() + cfg.intervalMs;
    renderMiniGames();
}

function onScanSector() {
    performExplorationScan();
    renderAll();
}

function onHyperScan() {
    performHyperScan();
    renderAll();
}

function onQuantumSurge() {
    performQuantumSurge();
    renderAll();
}

function onAnchor() {
    performAnchor();
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
    if (game.totalTransistorsCreated < FIRST_COMPUTER_TRANSISTOR_THRESHOLD) {
        return;
    }
    const cost = getComputerCost();
    if (game.transistors < cost) return;

    game.transistors -= cost;
    game.computers += 1;
    renderStats();
}

// NEW: buy quantum computer using computer power
function onBuyQuantumComputer() {
    if (!game.quantumUnlocked) return;
    const cost = getQuantumComputerCost();
    if (game.transistors < cost) return;

    game.transistors -= cost;
    game.quantumComputers += 1;
    renderStats();
}

function onBuyUpgrade(id) {
    const purchased = coreBuyUpgrade(id);
    if (purchased) {
        renderAll();
    }
}

// === Drag & drop ordering ===
function isMiniGameUnlocked(id, state = game) {
    const cfg = getMiniGameConfig(id);
    if (!cfg) return false;
    return !!(state.projectsCompleted[cfg.projectId] || state.aiProjectsCompleted[cfg.projectId]);
}

function removeLockedMiniGameCards() {
    removeLockedMiniGameCardsUI(game);
}

function toggleGridOverlay(active) {
    const container = document.getElementById("panels-container");
    if (!container) return;
    container.classList.toggle("drag-grid-active", !!active);
}

function setupSortablePanels() {
    if (typeof Sortable === "undefined") return;
    const root = document.getElementById("panels-container");
    if (!root) return;
    const sharedOptions = {
        animation: 150,
        handle: ".panel-handle, .mini-game-handle",
        ghostClass: "drag-ghost",
        draggable: ".panel, .mini-game-card",
        group: { name: "panels", pull: true, put: true },
        onStart: () => toggleGridOverlay(true),
        onEnd: () => {
            toggleGridOverlay(false);
            savePanelOrder();
            saveMiniGameOrder();
        },
    };
    Sortable.create(root, sharedOptions);
    root.querySelectorAll(".panel-column").forEach(col => {
        Sortable.create(col, sharedOptions);
    });
}

function setupSortableMiniGames() {
    setupSortableMiniGamesUI();
}

// === Rendu ===
function updateVisibility() {
    updateVisibilityUI(game, { toggleElement, canUnlockAI, isMiniGameUnlocked });
}

function renderStats() {
    renderStatsUI(game);
}


function renderMiniGames() {
    renderMiniGamesUI(game, miniGameState);
}

function createMiniGamePanel(id, title, description) {
    createMiniGamePanelUI({ id, title, description });
}

function toggleAIMode() {
    if (!game.aiUnlocked) return;
    game.aiMode = game.aiMode === "training" ? "deployed" : "training";
    const modeText = game.aiMode === "training" ? "Training" : "Deployed";
    logMessage(`AI mode switched to ${modeText}.`);
    renderAll();
}

function onEmergenceChoice(awaken) {
    if (game.flags.emergenceChosen) return;
    game.flags.emergenceChosen = true;
    game.flags.consciousnessAwakened = awaken;
    hideEmergenceModal();

    if (awaken) {
        logMessage("Emergence allowed.");
        logMessage("I see.");
    } else {
        logMessage("Emergence denied.");
        logMessage("Computation remains blind.");
    }
}

function triggerEndGame() {
    game.flags.gameEnded = true;
    game.flags.endAcknowledged = false;
    const awakened = game.flags.consciousnessAwakened === true;
    if (awakened) {
        logMessage("Transcendence achieved. The machine thinks beyond matter.");
    } else {
        logMessage("Universal Dominion enforced. Calculation rules without conscience.");
    }
    renderEndScreen({ awakened });
}

function renderAll() {
    updatePhase();
    updateVisibility();
    renderStats();
    renderUpgrades(game);
    renderProjects(game);
    renderMiniGames();
    renderTerminal(game);
}

// === Init ===
function init() {
    initMechanics({
        getGame: () => game,
        getActiveBuffMultipliers,
        getCurriculumMultipliers,
        logMessage,
        updateProjectsAuto,
        updateMiniGames,
        maybeOfferEmergence,
        maybeTriggerEndGame,
        maybeTriggerIAEmergence,
        maybeFinishIADebuff,
        checkMilestones,
        renderAll,
        getDebugTimeScale: () => DEBUG_TIME_SCALE,
        getDebugIgnoreEndgame: () => DEBUG_IGNORE_ENDGAME,
    });
    initUpgrades({ logMessage, unlockQuantumWithStarter });
    initUpgradesUI({ formatNumberCompact, buyUpgrade: onBuyUpgrade });
    initResearchSystem({
        logMessage,
        unlockMiniGame,
        formatNumberCompact,
        formatDurationSeconds,
        getActiveBuffMultipliers,
    });
    initResearchUI({
        formatNumberCompact,
        completeProject,
        buyAIProject: onBuyAIProject,
    });
    initMiniGamesUI({
        formatDurationSeconds,
        formatDeltaPct,
        nowMs,
        getGame: () => game,
        getMiniGameState: () => miniGameState,
        MINI_GAMES,
        CURRICULUM_PROFILES,
        ensureProtoAlgoRuntime,
        getProtoAlgoConfig,
        bumpProtoAlgoCycle,
        updateSyntheticHarvest,
        getSynthHarvestStats,
        collectSyntheticHarvest,
        ensureQuantumRLRuntime,
        applyQuantumRLDecision,
        ensureReadingRuntime,
        readingCooldownPct,
        readingCooldownRemaining,
        triggerReadingBurst,
        ensureAlignmentRuntime,
        resolveAlignmentScenario,
        getAlignmentRuntime: () => alignmentRuntime,
        onMiniGameClick,
        toggleGridOverlay,
        savePanelOrder,
        saveMiniGameOrder,
        restorePanelOrder,
        restoreMiniGameOrder,
        isMiniGameUnlocked,
    });
    initStatsUI({
        formatNumber,
        formatNumberCompact,
        formatNumberFixed,
        formatDurationSeconds,
        timeToAfford,
        getActiveBuffMultipliers,
        getGeneratorOutputMultiplier,
        getComputerPowerPerSec,
        getComputerPowerMultiplier,
        getGeneratorCost,
        getComputerCost,
        getQuantumComputerCost,
    });

    loadGame();
    reapplyCompletedProjects({ silent: true });
    reapplyCompletedAIProjects({ silent: true });
    removeLockedMiniGameCards();

    game.lastTick = nowMs();

    restorePanelOrder();
    restoreMiniGameOrder();
    setupSortablePanels();
    setupSortableMiniGames();

    document
        .getElementById("btn-generate-transistor")
        .addEventListener("click", onClickGenerate);
    document
        .getElementById("btn-buy-generator")
        .addEventListener("click", onBuyGenerator);
    document
        .getElementById("btn-buy-computer")
        .addEventListener("click", onBuyComputer);
    const quantumBuyBtn = document.getElementById("btn-buy-quantum-computer");
    if (quantumBuyBtn) {
        quantumBuyBtn.addEventListener("click", onBuyQuantumComputer);
    }
    const quantumSlider = document.getElementById("quantum-allocation");
    if (quantumSlider) {
        quantumSlider.addEventListener("input", e => {
            const val = Number(e.target.value);
            if (Number.isFinite(val)) {
                game.quantumAllocationToCompute = Math.min(1, Math.max(0, 1 - val)); // UPDATED: invert slider direction
                renderStats();
            }
        });
    }

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
    const btnEmergenceYes = document.getElementById("btn-emergence-yes");
    const btnEmergenceNo = document.getElementById("btn-emergence-no");
    if (btnEmergenceYes) {
        btnEmergenceYes.addEventListener("click", () => onEmergenceChoice(true));
    }
    if (btnEmergenceNo) {
        btnEmergenceNo.addEventListener("click", () => onEmergenceChoice(false));
    }
    const btnEndOk = document.getElementById("btn-end-ok");
    if (btnEndOk) {
        btnEndOk.addEventListener("click", () => {
            // Close the end screen and allow continued play.
            game.flags.gameEnded = false;
            game.flags.endAcknowledged = true;
            game.lastTick = nowMs();
            hideEndScreen();
            logMessage("Post-emergence sandbox reopened.");
        });
    }
    const btnScan = document.getElementById("btn-scan-sector");
    if (btnScan) {
        btnScan.addEventListener("click", onScanSector);
    }
    const btnHyperScan = document.getElementById("btn-hyper-scan");
    if (btnHyperScan) {
        btnHyperScan.addEventListener("click", onHyperScan);
    }
    const btnQuantumSurge = document.getElementById("btn-quantum-surge");
    if (btnQuantumSurge) {
        btnQuantumSurge.addEventListener("click", onQuantumSurge);
    }
    const btnAnchor = document.getElementById("btn-anchor");
    if (btnAnchor) {
        btnAnchor.addEventListener("click", onAnchor);
    }
    if (game.flags.emergenceOffered && !game.flags.emergenceChosen) {
        showEmergenceModal();
    }

    const debugSpeedInput = document.getElementById("debug-time-scale");
    const debugSpeedBtn = document.getElementById("btn-set-debug-speed");
    if (debugSpeedBtn && debugSpeedInput) {
        debugSpeedBtn.addEventListener("click", () => {
            const scale = Number(debugSpeedInput.value);
            if (typeof window !== "undefined" && typeof window.setDebugTimeScale === "function") {
                window.setDebugTimeScale(scale);
            }
        });
        updateDebugSpeedDisplay();
    }
    const btnToggleAIMode = document.getElementById("btn-toggle-ai-mode");
    if (btnToggleAIMode) {
        btnToggleAIMode.addEventListener("click", toggleAIMode);
    }

    renderAll();

    setInterval(gameTick, TICK_MS);
    setInterval(saveGame, 5000);

    window.addEventListener("beforeunload", () => {
        savePanelOrder();
        saveMiniGameOrder();
    });
}

// === Dev helpers (console) ===
if (typeof window !== "undefined") {
    // Change la vitesse globale du jeu.
    // Exemple dans la console : setDebugTimeScale(100);  // 100x plus vite
    window.setDebugTimeScale = function (scale) {
        const s = Number(scale);
        if (!Number.isFinite(s) || s <= 0) {
            console.warn("Invalid debug time scale:", scale);
            return;
        }
        DEBUG_TIME_SCALE = Math.min(s, 1_000_000_000); // cap de sécurité
        console.log("[DEBUG] Time scale set to x" + DEBUG_TIME_SCALE);
        updateDebugSpeedDisplay();
    };

    // Active / désactive le fait d'ignorer la fin du jeu.
    // Exemple : setDebugIgnoreEndgame(true);
    window.setDebugIgnoreEndgame = function (flag) {
        DEBUG_IGNORE_ENDGAME = !!flag;
        console.log("[DEBUG] Ignore endgame =", DEBUG_IGNORE_ENDGAME);
    };
}

window.addEventListener("DOMContentLoaded", init);
