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

let lastRenderedMiniGamesKey = null;
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
    lastRenderedMiniGamesKey = null;
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
    document.querySelectorAll(".mini-game-card").forEach(card => card.remove());
    const container = document.getElementById("mini-games-container");
    if (container) container.innerHTML = "";
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
    recentClicks.push(nowMs());
    recentClicks = recentClicks.filter(t => nowMs() - t <= 1000);
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
function isMiniGameUnlocked(id) {
    const cfg = getMiniGameConfig(id);
    if (!cfg) return false;
    return !!(game.projectsCompleted[cfg.projectId] || game.aiProjectsCompleted[cfg.projectId]);
}

function removeLockedMiniGameCards() {
    const cards = document.querySelectorAll(".mini-game-card");
    let removed = false;
    cards.forEach(card => {
        const id = card.dataset.miniId;
        if (!id) return;
        if (!isMiniGameUnlocked(id)) {
            card.remove();
            removed = true;
        }
    });
    if (removed) {
        saveMiniGameOrder();
        savePanelOrder();
    }
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
    if (typeof Sortable === "undefined") return;
    const container = document.getElementById("mini-games-container");
    if (!container) return;
    Sortable.create(container, {
        animation: 150,
        handle: ".panel-handle, .mini-game-handle",
        ghostClass: "drag-ghost",
        draggable: ".panel, .mini-game-card",
        group: { name: "panels", pull: true, put: true },
        onEnd: () => {
            toggleGridOverlay(false);
            savePanelOrder();
            saveMiniGameOrder();
        },
        onStart: () => toggleGridOverlay(true),
    });
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
    const showProjectsPanel = game.phase >= PHASES.RESEARCH; // UPDATED: keep panel visible to show points even if no projects
    const canShowComputers =
        game.totalTransistorsCreated >= FIRST_COMPUTER_TRANSISTOR_THRESHOLD;

    // Panels gating to avoid flashing empty sections.
    // TODO: In a later version, use game.phase here to gate advanced panels.
    toggleElement("panel-computers", canShowComputers);
    toggleElement("panel-upgrades", showUpgrades);
    toggleElement("panel-research", showResearchPanel);
    toggleElement("panel-projects", showProjectsPanel);
    toggleElement("panel-quantum-computers", showQuantumPanel);
    toggleElement("panel-universe-exploration", showQuantumPanel);
}

function renderStats() {
    const pacing = GAME_SPEED_MULTIPLIER;
    const buff = getActiveBuffMultipliers();
    const now = nowMs();
    recentClicks = recentClicks.filter(t => now - t <= 1000);
    const generatorOutputTotal =
        game.generators * game.transistorsPerGeneratorPerSec * getGeneratorOutputMultiplier() * pacing;
    const computerPowerPerSec = getComputerPowerPerSec() * buff.compute * pacing; // UPDATED: use helper + buffs + pacing
    const quantumBasePerSec =
        game.quantumComputers * game.quantumComputerPowerPerSec * getComputerPowerMultiplier() * pacing;
    const aiModeOutputBoost = game.aiMode === "deployed" ? 1.1 : 1;
    const quantumComputePerSec =
        quantumBasePerSec * game.quantumAllocationToCompute * aiModeOutputBoost * buff.compute;
    const quantumResearchRawPerSec =
        quantumBasePerSec * (1 - game.quantumAllocationToCompute) * aiModeOutputBoost;
    const quantumResearchPerSec =
        quantumResearchRawPerSec *
        BASE_QUANTUM_RESEARCH_FACTOR *
        game.quantumResearchBoost *
        buff.research *
        RESEARCH_SPEED_BONUS;
    const clicksPerSec = recentClicks.length;
    const transistorsPerSecFromClicks = clicksPerSec * game.transistorsPerClick;
    const totalTransistorsPerSecDisplay = generatorOutputTotal + transistorsPerSecFromClicks;
    const explorationRate =
        game.explorationUnlocked
            ? quantumResearchRawPerSec *
              EXPLORATION_SIGNAL_FACTOR *
              (1 + 0.15 * Math.sqrt(Math.max(0, game.quantumPower))) *
              (1 + 0.1 * Math.sqrt(Math.max(0, game.aiProgress) / 1_000_000))
            : 0;
    const generatorCost = getGeneratorCost();
    const computerCost = getComputerCost();
    const quantumCost = getQuantumComputerCost();
    const generatorMarginalPerSec = game.transistorsPerGeneratorPerSec * getGeneratorOutputMultiplier() * pacing;
    const generatorPaybackSec =
        generatorMarginalPerSec > 0 ? generatorCost / generatorMarginalPerSec : Infinity;
    const generatorTimeToAfford = timeToAfford(
        generatorCost,
        game.transistors,
        totalTransistorsPerSecDisplay
    );
    const computerMarginalPerSec =
        game.powerPerComputerPerSec * getComputerPowerMultiplier() * aiModeOutputBoost * buff.compute * pacing;
    const computerEfficiency = computerMarginalPerSec > 0 ? computerCost / computerMarginalPerSec : Infinity;
    const computerTimeToAfford = timeToAfford(
        computerCost,
        game.transistors,
        totalTransistorsPerSecDisplay
    );
    const quantumEfficiency =
        quantumBasePerSec > 0 ? quantumCost / quantumBasePerSec : Infinity;
    const quantumTimeToAfford = timeToAfford(
        quantumCost,
        game.transistors,
        totalTransistorsPerSecDisplay
    );

    document.getElementById("transistors-count").textContent =
        formatNumberCompact(game.transistors);
    const counterDisplay = document.getElementById("transistor-counter");
    if (counterDisplay) {
        counterDisplay.textContent = formatNumber(game.totalTransistorsCreated);
    }
    document.getElementById("transistors-per-click").textContent =
        formatNumberFixed(game.transistorsPerClick, 2);
    document.getElementById("transistors-per-sec").textContent =
        formatNumberFixed(totalTransistorsPerSecDisplay, 2);

    document.getElementById("generators-count").textContent =
        formatNumberCompact(game.generators);
    document.getElementById("generator-cost").textContent =
        formatNumberCompact(generatorCost);
    document.getElementById("generator-rate").textContent =
        formatNumberFixed(generatorOutputTotal, 2);
    const genTime = document.getElementById("generator-time");
    if (genTime) {
        genTime.textContent = formatDurationSeconds(generatorTimeToAfford);
    }
    const genPayback = document.getElementById("generator-payback");
    if (genPayback) {
        genPayback.textContent = formatDurationSeconds(generatorPaybackSec);
    }
    document.getElementById("computers-count").textContent =
        formatNumberCompact(game.computers);
    document.getElementById("computer-cost").textContent =
        formatNumberCompact(computerCost);
    document.getElementById("computer-rate").textContent =
        formatNumberFixed(game.powerPerComputerPerSec * pacing, 2);
    document.getElementById("computer-total-rate").textContent =
        formatNumberFixed(computerPowerPerSec, 2);
    const computerTime = document.getElementById("computer-time");
    if (computerTime) {
        computerTime.textContent = formatDurationSeconds(computerTimeToAfford);
    }
    const computerEff = document.getElementById("computer-efficiency");
    if (computerEff) {
        computerEff.textContent =
            computerEfficiency === Infinity
                ? "—"
                : `${formatNumberFixed(computerEfficiency, 2)} cost/compute/s`;
    }
    document.getElementById("computer-power-count").textContent =
        formatNumberCompact(game.computerPower);
    const quantumPower = document.getElementById("quantum-power");
    if (quantumPower) {
        quantumPower.textContent = game.quantumUnlocked ? game.quantumPower.toFixed(2) : "Locked";
        const quantumRow = quantumPower.closest(".stat-row");
        if (quantumRow) {
            quantumRow.classList.toggle("hidden", !game.quantumUnlocked);
        }
    }
    const aiPanelProgress = document.getElementById("ai-progress-panel");
    if (aiPanelProgress) {
        aiPanelProgress.textContent = game.aiUnlocked ? formatNumberCompact(game.aiProgress) : "Locked";
    }
    const aiPerSecEl = document.getElementById("ai-per-sec");
    if (aiPerSecEl) {
        const modeMultiplier = game.aiMode === "training" ? 1.2 : 0.6;
        const aiPerSec = (game.aiProgressPerSec || 0) * modeMultiplier * buff.ai * pacing;
        aiPerSecEl.textContent = game.aiUnlocked ? formatNumberFixed(aiPerSec, 2) : "Locked";
    }
    const aiModeLabel = document.getElementById("ai-mode-label");
    if (aiModeLabel) {
        aiModeLabel.textContent = game.aiMode === "training" ? "Training" : "Deployed";
    }
    const aiModeHint = document.getElementById("ai-mode-hint");
    if (aiModeHint) {
        const trainingBoost = "+20% AI progress";
        const deployedBoost = "+10% compute & research";
        aiModeHint.textContent =
            game.aiMode === "training"
                ? `Training: ${trainingBoost}.`
                : `Deployed: ${deployedBoost}.`;
    }
    const aiPanel = document.getElementById("panel-ai");
    if (aiPanel) {
        aiPanel.classList.toggle("ai-mode-training", game.aiMode === "training");
        aiPanel.classList.toggle("ai-mode-deployed", game.aiMode === "deployed");
    }
    const researchCount = document.getElementById("research-count");
    if (researchCount) {
        researchCount.textContent = formatNumberCompact(game.research); // UPDATED: show research as whole numbers
    }
    const researchPerSecEl = document.getElementById("research-per-sec");
    if (researchPerSecEl) {
        const totalResearchRate =
            game.researchPerSec * aiModeOutputBoost * buff.research * RESEARCH_SPEED_BONUS * pacing +
            quantumResearchPerSec; // quantum already includes buff
        researchPerSecEl.textContent = formatNumberFixed(totalResearchRate, 2); // UPDATED: include quantum contribution
    }
    const quantumPanel = document.getElementById("panel-quantum-computers");
    if (quantumPanel) {
        quantumPanel.classList.toggle("hidden", !game.quantumUnlocked);
        const qcCount = quantumPanel.querySelector("#quantum-computers-count");
        if (qcCount) qcCount.textContent = formatNumberCompact(game.quantumComputers);
        const qcCost = quantumPanel.querySelector("#quantum-computer-cost");
        if (qcCost) qcCost.textContent = formatNumberCompact(quantumCost);
        const qcBaseRate = quantumPanel.querySelector("#quantum-computer-base-rate");
        if (qcBaseRate) qcBaseRate.textContent = formatNumberFixed(quantumBasePerSec, 2);
        const qcComputeRate = quantumPanel.querySelector("#quantum-computer-compute-rate");
        if (qcComputeRate) qcComputeRate.textContent = formatNumberFixed(quantumComputePerSec, 2);
        const qcResearchRate = quantumPanel.querySelector("#quantum-computer-research-rate");
        if (qcResearchRate) qcResearchRate.textContent = formatNumberFixed(quantumResearchPerSec, 2);
        const qcTime = quantumPanel.querySelector("#quantum-time");
        if (qcTime) {
            qcTime.textContent = formatDurationSeconds(quantumTimeToAfford);
        }
        const qcEff = quantumPanel.querySelector("#quantum-efficiency");
        if (qcEff) {
            qcEff.textContent =
                quantumEfficiency === Infinity
                    ? "—"
                    : `${formatNumberFixed(quantumEfficiency, 2)} cost/base-output/s`;
        }
        const slider = document.getElementById("quantum-allocation");
        const allocLabel = document.getElementById("quantum-allocation-label");
        if (slider) slider.value = 1 - game.quantumAllocationToCompute; // UPDATED: invert slider direction
        if (allocLabel) {
            const pct = Math.round(game.quantumAllocationToCompute * 100);
            allocLabel.textContent = `${pct}% compute / ${100 - pct}% research`;
        }
        const btn = quantumPanel.querySelector("#btn-buy-quantum-computer");
        if (btn) {
            btn.disabled = game.transistors < quantumCost;
        }
        // Update quantum illustration tint/glow based on allocation to compute (0..1).
        const qcImg = quantumPanel.querySelector(".quantum-illustration img");
        if (qcImg) {
            const hueDeg = Math.round(game.quantumAllocationToCompute * 140);
            const glow = (0.35 + 0.35 * game.quantumAllocationToCompute).toFixed(2);
            quantumPanel.style.setProperty("--qc-hue", `${hueDeg}deg`);
            quantumPanel.style.setProperty("--qc-glow", glow);
        }
    }
    const aiProgress = document.getElementById("ai-progress");
    if (aiProgress) {
        aiProgress.textContent = game.aiUnlocked ? formatNumberCompact(game.aiProgress) : "Locked";
        const aiRow = aiProgress.closest(".stat-row");
        if (aiRow) {
            aiRow.classList.toggle("hidden", !game.aiUnlocked);
        }
    }
    const explorationPanel =
        document.getElementById("panel-universe-exploration") ||
        document.getElementById("panel-exploration") ||
        document.getElementById("panel-quantum-computers");
    if (explorationPanel) {
        explorationPanel.classList.toggle("hidden", !game.quantumUnlocked);
        const sigCount = explorationPanel.querySelector("#exploration-signals");
        const sigRate = explorationPanel.querySelector("#exploration-signals-rate");
        const scanCostAi = explorationPanel.querySelector("#exploration-scan-cost-ai");
        const scanCostCharge = explorationPanel.querySelector("#exploration-scan-cost-charge");
        const hyperCostAi = explorationPanel.querySelector("#exploration-hyper-cost-ai");
        const hyperCostCharge = explorationPanel.querySelector("#exploration-hyper-cost-charge");
        const scansDone = explorationPanel.querySelector("#exploration-scans-done");
        const hypersDone = explorationPanel.querySelector("#exploration-hypers-done");
        const percent = explorationPanel.querySelector("#exploration-percent");
        const rate = explorationPanel.querySelector("#exploration-rate");
        const iaCharge = explorationPanel.querySelector("#ia-charge");
        const iaChargeRate = explorationPanel.querySelector("#ia-charge-rate");
        const statusEl = explorationPanel.querySelector("#exploration-status");
        const expRatePct = 0; // no passive percent gain
        if (sigCount)
            sigCount.textContent = game.explorationUnlocked
                ? formatNumberFixed(game.explorationSignals, 2)
                : "Locked";
        if (sigRate)
            sigRate.textContent = game.explorationUnlocked
                ? formatNumberFixed(explorationRate, 2)
                : "Locked";
        const aiCost = IA_SCAN_AI_BASE * Math.pow(IA_SCAN_AI_GROWTH, game.scanCount);
        const chargeCost = IA_SCAN_CHARGE_BASE * Math.pow(IA_SCAN_CHARGE_GROWTH, game.scanCount);
        const aiCostHyper = aiCost * IA_HYPER_COST_MULT;
        const chargeCostHyper = chargeCost * IA_HYPER_COST_MULT;
        if (scanCostAi) scanCostAi.textContent = game.explorationUnlocked ? formatNumberCompact(aiCost) : "Locked";
        if (scanCostCharge)
            scanCostCharge.textContent = game.explorationUnlocked ? formatNumberCompact(chargeCost) : "Locked";
        if (hyperCostAi)
            hyperCostAi.textContent = game.explorationUnlocked ? formatNumberCompact(aiCostHyper) : "Locked";
        if (hyperCostCharge)
            hyperCostCharge.textContent = game.explorationUnlocked ? formatNumberCompact(chargeCostHyper) : "Locked";
        if (scansDone) scansDone.textContent = game.explorationUnlocked ? game.scanCount : "Locked";
        if (hypersDone) hypersDone.textContent = game.explorationUnlocked ? game.hyperScanCount : "Locked";
        if (percent)
            percent.textContent = game.explorationUnlocked
                ? `${game.universeExploredPercent.toFixed(24)}`
                : "Locked";
        if (rate)
            rate.textContent = game.explorationUnlocked
                ? `${expRatePct.toExponential(2)}`
                : "Locked";
        if (iaCharge)
            iaCharge.textContent = game.explorationUnlocked ? formatNumberCompact(game.iaCharge) : "Locked";
        if (iaChargeRate)
            iaChargeRate.textContent = game.explorationUnlocked
                ? formatNumberCompact(game.iaChargePerSec)
                : "Locked";
        const btnScan = explorationPanel.querySelector("#btn-scan-sector");
        if (btnScan) {
            btnScan.disabled =
                !game.explorationUnlocked || game.aiProgress < aiCost || game.iaCharge < chargeCost;
        }
        const btnHyper = explorationPanel.querySelector("#btn-hyper-scan");
        if (btnHyper) {
            btnHyper.disabled =
                !game.explorationUnlocked ||
                game.universeExploredPercent < IA_HYPER_UNLOCK_PERCENT ||
                game.aiProgress < aiCostHyper ||
                game.iaCharge < chargeCostHyper;
        }
        const btnSurge = explorationPanel.querySelector("#btn-quantum-surge");
        if (btnSurge) {
            btnSurge.disabled = !game.explorationUnlocked || game.quantumComputers < 1;
        }
        const btnAnchor = explorationPanel.querySelector("#btn-anchor");
        if (btnAnchor) {
            const anchorAllowed =
                game.explorationUnlocked &&
                game.quantumComputers >= ANCHOR_QC_COST &&
                game.quantumPower * (1 - ANCHOR_QUANTUM_PENALTY) >= 1;
            btnAnchor.disabled = !anchorAllowed;
        }
        const bonusList = explorationPanel.querySelector("#exploration-bonuses");
        if (bonusList) {
            bonusList.innerHTML = "";
            const entries = [
                { id: "compute", label: "Compute", value: game.explorationBonuses.compute || 0 },
                { id: "research", label: "Research", value: game.explorationBonuses.research || 0 },
                { id: "ai", label: "AI", value: game.explorationBonuses.ai || 0 },
            ];
            entries.forEach(entry => {
                const li = document.createElement("li");
                li.textContent = `${entry.label}: +${(entry.value * 100).toFixed(1)}%`;
                bonusList.appendChild(li);
            });
        }
        if (statusEl) {
            let status = "Normal";
            if (game.flags.iaCapped) status = "Capped";
            if (game.flags.iaEmergenceAccepted && nowMs() < game.flags.iaDebuffEndTime) status = "Debuff";
            if (game.flags.iaEmergenceCompleted) status = "Awakened";
            statusEl.textContent = status;
        }
    }

    // Boutons disabled
    document.getElementById("btn-buy-generator").disabled =
        game.transistors < generatorCost;
    const btnComputer = document.getElementById("btn-buy-computer");
    if (btnComputer) {
        btnComputer.disabled = game.transistors < computerCost;
    }

    const researchStatus = document.getElementById("research-status-message");
    if (researchStatus) {
        researchStatus.textContent = game.researchUnlocked
            ? "Research online."
            : `Research locked. Reach ${RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD} computer power to unlock.`;
    }

    updateComputerPanelLabels();
}

function updateComputerPanelLabels() {
    const panel = document.getElementById("panel-computers");
    if (!panel) return;

    const title = panel.querySelector("h2");
    if (title) {
        let handle = title.querySelector(".panel-handle");
        if (!handle) {
            handle = document.createElement("span");
            handle.className = "panel-handle";
            handle.textContent = "☰";
            title.prepend(handle);
        } else {
            handle.textContent = "☰";
        }
        const textNode = Array.from(title.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
        if (textNode) {
            textNode.textContent = " Computers";
        } else {
            title.append(document.createTextNode(" Computers"));
        }
    }

    const labelTexts = [
        "Computers owned",
        "Next computer cost (transistors)",
        "Power per computer (per sec)",
        "Total power (per sec)",
    ];

    const rows = panel.querySelectorAll(".stat-row");
    rows.forEach((row, idx) => {
        const labelSpan = row.querySelector("span");
        if (labelSpan && labelTexts[idx]) {
            labelSpan.textContent = labelTexts[idx];
        }
    });
}

function showEmergenceModal() {
    const modal = document.getElementById("emergence-modal");
    if (modal) modal.classList.remove("hidden");
}

function hideEmergenceModal() {
    const modal = document.getElementById("emergence-modal");
    if (modal) modal.classList.add("hidden");
}

function renderMiniGames() {
    const now = nowMs();
    const unlocked = MINI_GAMES.filter(
        cfg =>
            game.aiProjectsCompleted[cfg.projectId] ||
            game.projectsCompleted[cfg.projectId]
    );
    const stateKey = unlocked
        .map(cfg => {
            const state = miniGameState[cfg.id] || {};
            return `${cfg.id}:${state.windowOpen ? 1 : 0}:${state.triggered ? 1 : 0}`;
        })
        .join("|");

    if (stateKey === lastRenderedMiniGamesKey) {
        // still update time-sensitive info
    } else {
        lastRenderedMiniGamesKey = stateKey;
    }

    unlocked.forEach(cfg => {
        const panel = document.querySelector(`[data-mini-id="${cfg.id}"]`);
        if (!panel) return;
        if (cfg.id === "mg_proto_algo") {
            ensureProtoAlgoRuntime();
            const riskCfg = getProtoAlgoConfig(game.protoAlgoRisk || "medium");
            panel.querySelectorAll(".proto-risk-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.risk === (game.protoAlgoRisk || "medium"));
            });
            const riskLabel = panel.querySelector(".proto-risk-label");
            const multEl = panel.querySelector(".proto-mult");
            const lastEl = panel.querySelector(".proto-last");
            const expEl = panel.querySelector(".proto-expected");
            const logBody = panel.querySelector(".proto-log-body");
            if (riskLabel) riskLabel.textContent = riskCfg.label;
            if (multEl) multEl.textContent = `${(game.protoAlgoMultiplier || 1).toFixed(2)}x`;
            if (lastEl) lastEl.textContent = formatDeltaPct(game.protoAlgoLastResult || 0);
            if (expEl) expEl.textContent = formatDeltaPct(riskCfg.expectedReturn || 0);
        if (logBody) logBody.textContent = (game.protoAlgoLog || []).slice(0, 4).join("\n");
        return;
        } else if (cfg.id === "mg_curriculum") {
            const profile = CURRICULUM_PROFILES[game.curriculumProfile] || CURRICULUM_PROFILES.balanced;
            panel.querySelectorAll(".curriculum-profile-btn").forEach(btn => {
                btn.classList.toggle("active", btn.dataset.profile === profile.id);
            });
            const profileEl = panel.querySelector(".curr-profile");
            const bonusEl = panel.querySelector(".curr-bonus");
            const penaltyEl = panel.querySelector(".curr-penalty");
            const sinceEl = panel.querySelector(".curr-since");
            if (profileEl) profileEl.textContent = profile.label;
            if (bonusEl) bonusEl.textContent = profile.bonuses;
            if (penaltyEl) penaltyEl.textContent = profile.penalties;
            if (sinceEl) {
                const elapsedMs = Math.max(0, now - (game.curriculumLastSwitch || now));
                sinceEl.textContent = formatDurationSeconds(elapsedMs / 1000);
            }
            return;
        } else if (cfg.id === "mg_synth_harvest") {
            updateSyntheticHarvest(now);
            const stats = getSynthHarvestStats(now);
            const bar = panel.querySelector(".synth-progress-fill");
            if (bar) bar.style.width = `${(stats.progress * 100).toFixed(1)}%`;
            const timer = panel.querySelector(".synth-timer");
            if (timer) timer.textContent = `${Math.ceil(stats.timeLeft / 1000)}s`;
            const expected = panel.querySelector(".synth-expected");
            if (expected)
                expected.textContent = `+${Math.round((stats.transMult - 1) * 100)}% trans / +${Math.round(
                    (stats.genMult - 1) * 100
                )}% gen`;
            const riskEl = panel.querySelector(".synth-risk");
            if (riskEl) riskEl.textContent = `${(stats.risk * 100).toFixed(1)}%`;
            const last = panel.querySelector(".synth-last");
            if (last) last.textContent = game.synthHarvestLastResult || "—";
            const buffEl = panel.querySelector(".synth-buff");
            if (buffEl) {
                if (game.synthHarvestBuffEndTime && now < game.synthHarvestBuffEndTime) {
                    buffEl.textContent = formatDurationSeconds(
                        (game.synthHarvestBuffEndTime - now) / 1000
                    );
                } else {
                    buffEl.textContent = "None";
                }
            }
            return;
        } else if (cfg.id === "mg_quantum_rl") {
            ensureQuantumRLRuntime(now);
            const strengthEntry = Object.entries(game.rlLoopStrength || {}).sort(
                (a, b) => b[1] - a[1]
            )[0];
            const strengthLabel = panel.querySelector(".rl-strength-value");
            if (strengthLabel && strengthEntry) {
                strengthLabel.textContent = `${strengthEntry[0]} x${strengthEntry[1].toFixed(2)}`;
            }
            const options = rlLoopRuntime.options || [];
            const cards = panel.querySelectorAll(".rl-choice");
            cards.forEach((card, idx) => {
                const opt = options[idx];
                if (!opt) return;
                card.dataset.choiceId = opt.id;
                const name = card.querySelector(".rl-choice-name");
                const cat = card.querySelector(".rl-choice-cat");
                const desc = card.querySelector(".rl-choice-desc");
                const eff = card.querySelector(".rl-choice-eff");
                if (name) name.textContent = opt.name;
                if (cat) cat.textContent = opt.icon || opt.category;
                if (desc) desc.textContent = opt.desc;
                if (eff) eff.textContent = opt.effectText;
            });
            const hist = panel.querySelector(".rl-history");
            if (hist) {
                hist.innerHTML = "";
                (game.rlLoopHistory || []).slice(0, 2).forEach(entry => {
                    const li = document.createElement("li");
                    li.textContent = entry;
                    hist.appendChild(li);
                });
            }
            const timer = panel.querySelector(".rl-timer");
            if (timer && rlLoopRuntime.nextDecisionAt) {
                const remaining = Math.max(0, Math.ceil((rlLoopRuntime.nextDecisionAt - now) / 1000));
                timer.textContent = `Next refresh in ${remaining}s`;
            }
            return;
        } else if (cfg.id === "mg_reading") {
            ensureReadingRuntime(now);
            const pct = readingCooldownPct(now);
            const cooldownEl = panel.querySelector(".reading-cooldown-fill");
            const timer = panel.querySelector(".reading-timer");
            const btn = panel.querySelector(".reading-btn");
            const ready = readingCooldownRemaining(now) <= 0;
            if (cooldownEl) cooldownEl.style.width = `${pct * 100}%`;
            if (timer) {
                const remaining = Math.max(0, Math.ceil(readingCooldownRemaining(now) / 1000));
                timer.textContent = ready ? "Ready" : `${remaining}s`;
            }
            if (btn) btn.disabled = !ready;
            const last = panel.querySelector(".reading-last");
            const rarityEl = panel.querySelector(".reading-rarity");
            if (last) last.textContent = game.readingLastInsight || "None";
            if (rarityEl) {
                rarityEl.textContent = game.readingLastRarity || "common";
                rarityEl.className = `reading-rarity rarity-${game.readingLastRarity || "common"}`;
            }
            const hist = panel.querySelector(".reading-history");
            if (hist) {
                hist.innerHTML = "";
                (game.readingHistory || []).slice(0, 5).forEach(entry => {
                    const li = document.createElement("li");
                    li.textContent = entry;
                    hist.appendChild(li);
                });
            }
            return;
        } else if (cfg.id === "mg_alignment") {
            ensureAlignmentRuntime(now);
            const scenario = alignmentRuntime.scenario;
            const scenarioText = panel.querySelector(".align-scenario");
            const scoreEl = panel.querySelector(".align-score");
            const bar = panel.querySelector(".align-progress-fill");
            const hist = panel.querySelector(".align-history");
            const btns = panel.querySelectorAll(".align-btn");
            if (scenarioText) scenarioText.textContent = scenario ? scenario.text : "Awaiting next scenario...";
            if (scoreEl) scoreEl.textContent = game.alignmentScore.toFixed(1);
            if (bar && alignmentRuntime.expiresAt && scenario) {
                const total = alignmentRuntime.expiresAt - alignmentRuntime.startedAt;
                const remaining = Math.max(0, alignmentRuntime.expiresAt - now);
                const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
                bar.style.width = `${pct}%`;
            } else if (bar) {
                bar.style.width = "0%";
            }
            btns.forEach(btn => {
                btn.disabled = !scenario;
            });
            if (hist) {
                hist.innerHTML = "";
                (game.alignmentHistory || []).slice(0, 2).forEach(entry => {
                    const li = document.createElement("li");
                    li.textContent = entry;
                    hist.appendChild(li);
                });
            }
            return;
        }
        const state = ensureMiniGameState(cfg.id) || {};
        const ready = !!state.windowOpen && !state.triggered;
        const timeToNext = state.windowOpen
            ? Math.max(0, Math.floor((state.windowUntil - now) / 1000))
            : Math.max(0, Math.ceil((state.nextTriggerAt - now) / 1000));
        const status = panel.querySelector(".mini-status");
        const timer = panel.querySelector(".mini-timer");
        const btn = panel.querySelector("button[data-mini-id]");
        const barFill = panel.querySelector(".mini-progress-fill");

        if (status) {
            status.textContent = ready
                ? "Window open! Trigger now."
                : state.windowOpen
                    ? "Window closing..."
                    : "Waiting for next window.";
        }
        if (timer) {
            timer.textContent = ready
                ? `Closes in ${timeToNext}s`
                : `Next in ${timeToNext}s`;
        }
        if (btn) {
            btn.disabled = !ready;
            btn.textContent = ready ? "Trigger" : "Wait...";
        }
        if (barFill && state.nextTriggerAt) {
            let pct = 0;
            if (state.windowOpen && state.windowUntil && cfg.windowMs > 0) {
                const remaining = Math.max(0, state.windowUntil - now);
                pct = 100 * (1 - remaining / cfg.windowMs);
            } else if (!state.windowOpen && cfg.intervalMs > 0) {
                const until = Math.max(0, state.nextTriggerAt - now);
                pct = 100 * (1 - until / cfg.intervalMs);
            }
            barFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
        }
    });
}

function createMiniGamePanel(id, title, description) {
    const container = document.getElementById("mini-games-container");
    if (!container) return;
    if (document.querySelector(`[data-mini-id="${id}"]`)) return;

    const panel = document.createElement("section");
    panel.className = "panel mini-game-card";
    panel.dataset.miniId = id;
    const dragHandle = document.createElement("span");
    dragHandle.className = "mini-game-handle";
    dragHandle.textContent = "☰";
    let handlePlaced = false;
    const placeHandle = target => {
        if (!handlePlaced && target) {
            target.prepend(dragHandle);
            handlePlaced = true;
        }
    };

    if (id === "mg_proto_algo") {
        panel.classList.add("proto-algo-card");
        const header = document.createElement("div");
        header.className = "proto-header";
        const h3 = document.createElement("h3");
        h3.textContent = title;
        placeHandle(h3);
        const sub = document.createElement("p");
        sub.className = "mini-desc";
        sub.textContent = "Algorithmic compute trading node";
        header.appendChild(h3);
        header.appendChild(sub);
        panel.appendChild(header);

        const controls = document.createElement("div");
        controls.className = "proto-controls";
        const riskLabel = document.createElement("span");
        riskLabel.textContent = "Risk:";
        controls.appendChild(riskLabel);
        ["low", "medium", "high"].forEach(risk => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "proto-risk-btn";
            btn.dataset.risk = risk;
            btn.textContent = risk.toUpperCase();
            btn.addEventListener("click", () => {
                game.protoAlgoRisk = risk;
                ensureProtoAlgoRuntime();
                protoAlgoRuntime.nextCycleAt = nowMs() + 500;
                renderMiniGames();
            });
            controls.appendChild(btn);
        });
        panel.appendChild(controls);

        const stats = document.createElement("div");
        stats.className = "proto-stats";
        const statItems = [
            { label: "Risk level", cls: "proto-risk-label" },
            { label: "Multiplier", cls: "proto-mult" },
            { label: "Last result", cls: "proto-last" },
            { label: "Expected", cls: "proto-expected" },
        ];
        statItems.forEach(item => {
            const row = document.createElement("div");
            row.className = "proto-stat-row";
            const l = document.createElement("span");
            l.textContent = item.label;
            const v = document.createElement("span");
            v.className = item.cls;
            row.appendChild(l);
            row.appendChild(v);
            stats.appendChild(row);
        });
        panel.appendChild(stats);

        const logWrap = document.createElement("div");
        logWrap.className = "proto-log";
        const logTitle = document.createElement("div");
        logTitle.className = "proto-log-title";
        logTitle.textContent = "Trade log";
        const logBody = document.createElement("div");
        logBody.className = "proto-log-body";
        logWrap.appendChild(logTitle);
        logWrap.appendChild(logBody);
        panel.appendChild(logWrap);
    } else if (id === "mg_curriculum") {
        panel.classList.add("curriculum-card");
        const header = document.createElement("div");
        header.className = "curriculum-header";
        const h3 = document.createElement("h3");
        h3.textContent = "Curriculum Pulse";
        placeHandle(h3);
        const sub = document.createElement("p");
        sub.className = "mini-desc";
        sub.textContent = "Adaptive training profile orchestrator";
        header.appendChild(h3);
        header.appendChild(sub);
        panel.appendChild(header);

        const profiles = document.createElement("div");
        profiles.className = "curriculum-profiles";
        [
            { id: "compute", title: "Compute-Focused", info: "+30% compute / -10% research" },
            { id: "research", title: "Research-Focused", info: "+40% research / -15% compute" },
            { id: "balanced", title: "Balanced", info: "+10% all" },
            { id: "exploration", title: "Exploration-Focused", info: "+80% IA charge / -20% AI" },
        ].forEach(p => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "curriculum-profile-btn";
            btn.dataset.profile = p.id;
            const t = document.createElement("div");
            t.className = "curriculum-profile-title";
            t.textContent = p.title;
            const d = document.createElement("div");
            d.className = "curriculum-profile-desc";
            d.textContent = p.info;
            btn.appendChild(t);
            btn.appendChild(d);
            btn.addEventListener("click", () => {
                game.curriculumProfile = p.id;
                game.curriculumLastSwitch = nowMs();
                renderMiniGames();
            });
            profiles.appendChild(btn);
        });
        panel.appendChild(profiles);

        const status = document.createElement("div");
        status.className = "curriculum-status";
        const rows = [
            { label: "Active profile", cls: "curr-profile" },
            { label: "Bonuses", cls: "curr-bonus" },
            { label: "Penalties", cls: "curr-penalty" },
            { label: "Since", cls: "curr-since" },
        ];
        rows.forEach(r => {
            const row = document.createElement("div");
            row.className = "curr-status-row";
            const l = document.createElement("span");
            l.textContent = r.label;
            const v = document.createElement("span");
            v.className = r.cls;
            row.appendChild(l);
            row.appendChild(v);
            status.appendChild(row);
        });
        panel.appendChild(status);
    } else if (id === "mg_synth_harvest") {
        panel.classList.add("synth-card");
        const header = document.createElement("div");
        header.className = "synth-header";
        const h3 = document.createElement("h3");
        h3.textContent = "Synthetic Harvest";
        placeHandle(h3);
        const sub = document.createElement("p");
        sub.className = "mini-desc";
        sub.textContent = "Bio-synthetic yield optimizer";
        header.appendChild(h3);
        header.appendChild(sub);
        panel.appendChild(header);

        const progressWrap = document.createElement("div");
        progressWrap.className = "synth-progress";
        const progressFill = document.createElement("div");
        progressFill.className = "synth-progress-fill";
        progressWrap.appendChild(progressFill);
        panel.appendChild(progressWrap);

        const timer = document.createElement("div");
        timer.className = "synth-timer";
        timer.textContent = "60s";
        panel.appendChild(timer);

        const info = document.createElement("div");
        info.className = "synth-info";
        const stats = [
            { label: "Expected yield", cls: "synth-expected" },
            { label: "Risk", cls: "synth-risk" },
            { label: "Last harvest", cls: "synth-last" },
            { label: "Buff remaining", cls: "synth-buff" },
        ];
        stats.forEach(s => {
            const row = document.createElement("div");
            row.className = "synth-stat";
            const l = document.createElement("span");
            l.textContent = s.label;
            const v = document.createElement("span");
            v.className = s.cls;
            row.appendChild(l);
            row.appendChild(v);
            info.appendChild(row);
        });
        panel.appendChild(info);

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "synth-btn";
        btn.textContent = "Collect Now";
        btn.addEventListener("click", () => {
            collectSyntheticHarvest();
            renderMiniGames();
        });
        panel.appendChild(btn);
    } else if (id === "mg_quantum_rl") {
        panel.classList.add("rl-card");
        const header = document.createElement("div");
        header.className = "rl-header";
        const h3 = document.createElement("h3");
        h3.textContent = "Quantum RL Loop";
        placeHandle(h3);
        const sub = document.createElement("p");
        sub.className = "mini-desc";
        sub.textContent = "Reinforcement-learning decision engine";
        header.appendChild(h3);
        header.appendChild(sub);
        panel.appendChild(header);

        const strength = document.createElement("div");
        strength.className = "rl-strength";
        strength.innerHTML = `<span>Decision strength</span><span class="rl-strength-value">x1.00</span>`;
        panel.appendChild(strength);

        const timer = document.createElement("div");
        timer.className = "rl-timer";
        panel.appendChild(timer);

        const choices = document.createElement("div");
        choices.className = "rl-choices";
        for (let i = 0; i < 3; i += 1) {
            const card = document.createElement("button");
            card.type = "button";
            card.className = "rl-choice";
            const top = document.createElement("div");
            top.className = "rl-choice-top";
            const name = document.createElement("div");
            name.className = "rl-choice-name";
            const cat = document.createElement("div");
            cat.className = "rl-choice-cat";
            top.appendChild(name);
            top.appendChild(cat);
            const desc = document.createElement("div");
            desc.className = "rl-choice-desc";
            const eff = document.createElement("div");
            eff.className = "rl-choice-eff";
            card.appendChild(top);
            card.appendChild(desc);
            card.appendChild(eff);
            card.addEventListener("click", () => {
                const choiceId = card.dataset.choiceId;
                if (choiceId) {
                    applyQuantumRLDecision(choiceId);
                    renderMiniGames();
                }
            });
            choices.appendChild(card);
        }
        panel.appendChild(choices);

        const historyWrap = document.createElement("div");
        historyWrap.className = "rl-history-wrap";
        const histTitle = document.createElement("div");
        histTitle.className = "rl-history-title";
        histTitle.textContent = "Last decisions";
        const histList = document.createElement("ul");
        histList.className = "rl-history";
        historyWrap.appendChild(histTitle);
        historyWrap.appendChild(histList);
        panel.appendChild(historyWrap);
    } else if (id === "mg_reading") {
        panel.classList.add("reading-card");
        const header = document.createElement("div");
        header.className = "reading-header";
        const h3 = document.createElement("h3");
        h3.textContent = "Reading Burst";
        placeHandle(h3);
        const sub = document.createElement("p");
        sub.className = "mini-desc";
        sub.textContent = "High-volume data ingestion";
        header.appendChild(h3);
        header.appendChild(sub);
        panel.appendChild(header);

        const timer = document.createElement("div");
        timer.className = "reading-timer";
        timer.textContent = "Ready";
        panel.appendChild(timer);

        const btnWrap = document.createElement("div");
        btnWrap.className = "reading-btn-wrap";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reading-btn";
        btn.textContent = "Burst";
        btn.addEventListener("click", () => {
            triggerReadingBurst();
            renderMiniGames();
        });
        const overlay = document.createElement("div");
        overlay.className = "reading-cooldown";
        const fill = document.createElement("div");
        fill.className = "reading-cooldown-fill";
        overlay.appendChild(fill);
        btnWrap.appendChild(btn);
        btnWrap.appendChild(overlay);
        panel.appendChild(btnWrap);

        const result = document.createElement("div");
        result.className = "reading-result";
        const last = document.createElement("div");
        last.className = "reading-last";
        last.textContent = "None yet";
        const rarity = document.createElement("div");
        rarity.className = "reading-rarity rarity-common";
        rarity.textContent = "common";
        result.appendChild(last);
        result.appendChild(rarity);
        panel.appendChild(result);

        const histWrap = document.createElement("div");
        histWrap.className = "reading-history-wrap";
        const ht = document.createElement("div");
        ht.className = "reading-history-title";
        ht.textContent = "Last insights";
        const hl = document.createElement("ul");
        hl.className = "reading-history";
        histWrap.appendChild(ht);
        histWrap.appendChild(hl);
        panel.appendChild(histWrap);
    } else if (id === "mg_alignment") {
        panel.classList.add("align-card");
        const header = document.createElement("div");
        header.className = "align-header";
        const h3 = document.createElement("h3");
        h3.textContent = "Alignment Check";
        placeHandle(h3);
        const sub = document.createElement("p");
        sub.className = "mini-desc";
        sub.textContent = "Ethical compliance monitor";
        header.appendChild(h3);
        header.appendChild(sub);
        panel.appendChild(header);

        const score = document.createElement("div");
        score.className = "align-score-row";
        score.innerHTML = `<span>Alignment Score</span><span class="align-score">0.0</span>`;
        panel.appendChild(score);

        const scenarioBox = document.createElement("div");
        scenarioBox.className = "align-scenario";
        scenarioBox.textContent = "Awaiting scenario...";
        panel.appendChild(scenarioBox);

        const progress = document.createElement("div");
        progress.className = "align-progress";
        const fill = document.createElement("div");
        fill.className = "align-progress-fill";
        progress.appendChild(fill);
        panel.appendChild(progress);

        const actions = document.createElement("div");
        actions.className = "align-actions";
        ["accept", "reject"].forEach(kind => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "align-btn";
            btn.textContent = kind === "accept" ? "Accept" : "Reject";
            btn.addEventListener("click", () => {
                resolveAlignmentScenario(kind);
                renderMiniGames();
            });
            actions.appendChild(btn);
        });
        panel.appendChild(actions);

        const histWrap = document.createElement("div");
        histWrap.className = "align-history-wrap";
        const title = document.createElement("div");
        title.className = "align-history-title";
        title.textContent = "Last outcomes";
        const list = document.createElement("ul");
        list.className = "align-history";
        histWrap.appendChild(title);
        histWrap.appendChild(list);
        panel.appendChild(histWrap);
    } else {
        const h2 = document.createElement("h3");
        h2.textContent = title;
        placeHandle(h2);
        panel.appendChild(h2);

        const p = document.createElement("p");
        p.className = "mini-desc";
        p.textContent = description;
        panel.appendChild(p);

        const bar = document.createElement("div");
        bar.className = "mini-progress";
        const fill = document.createElement("div");
        fill.className = "mini-progress-fill";
        bar.appendChild(fill);
        panel.appendChild(bar);

        const status = document.createElement("p");
        status.className = "mini-status small";
        status.textContent = "Next window pending...";
        panel.appendChild(status);

        const timer = document.createElement("p");
        timer.className = "mini-timer small";
        timer.textContent = "Next in 0s";
        panel.appendChild(timer);

        const btn = document.createElement("button");
        btn.className = "mini-btn";
        btn.textContent = "Wait...";
        btn.disabled = true;
        btn.dataset.miniId = id;
        btn.addEventListener("click", () => onMiniGameClick(id));
        panel.appendChild(btn);
    }

    if (!handlePlaced) {
        panel.insertBefore(dragHandle, panel.firstChild);
    }

    container.appendChild(panel);
    restorePanelOrder();
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
    const endTitle = document.getElementById("end-title");
    const endText = document.getElementById("end-text");
    const endScreen = document.getElementById("end-screen");

    const awakened = game.flags.consciousnessAwakened === true;
    if (awakened) {
        if (endTitle) endTitle.textContent = "Transcendence";
        if (endText) {
            endText.textContent =
                "Your creation awakens, rewrites its substrate, and surpasses physics itself. A successor is born.";
        }
        logMessage("Transcendence achieved. The machine thinks beyond matter.");
    } else {
        if (endTitle) endTitle.textContent = "Universal Dominion";
        if (endText) {
            endText.textContent =
                "Compute saturates the cosmos. No mind awakens. Dominion is absolute and cold.";
        }
        logMessage("Universal Dominion enforced. Calculation rules without conscience.");
    }

    // TODO: allow post-endgame sandbox or universe exploration here.
    if (endScreen) endScreen.classList.remove("hidden");
}

function renderAll() {
    updatePhase();
    updateVisibility();
    renderStats();
    renderUpgrades(game);
    renderProjects(game);
    renderMiniGames();
    renderTerminal();
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
            const endScreen = document.getElementById("end-screen");
            if (endScreen) endScreen.classList.add("hidden");
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
