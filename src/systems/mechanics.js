import {
    GAME_SPEED_MULTIPLIER,
    MIN_RESEARCH_PER_SEC_ON_UNLOCK,
    FIRST_COMPUTER_TRANSISTOR_THRESHOLD,
    RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD,
    BASE_QUANTUM_RESEARCH_FACTOR,
    EXPLORATION_SIGNAL_FACTOR,
    RESEARCH_SPEED_BONUS,
    EXPLORATION_UNLOCK_RESEARCH_THRESHOLD,
    EXPLORATION_UNLOCK_QUANTUM_THRESHOLD,
    IA_CHARGE_FACTOR,
    IA_CHARGE_QP_FACTOR,
    IA_CHARGE_AI_FACTOR,
    IA_DEBUFF_CHARGE_MULT,
    IA_DEBUFF_AI_MULT,
    EXPLORATION_MAX_BONUS,
    EXPLORATION_REWARD_TABLE,
    IA_SCAN_AI_BASE,
    IA_SCAN_AI_GROWTH,
    IA_SCAN_CHARGE_BASE,
    IA_SCAN_CHARGE_GROWTH,
    IA_SCAN_DELTA_BASE,
    IA_SCAN_DELTA_EXP,
    IA_SCAN_DENOM_SCALE,
    IA_HYPER_MULT,
    IA_HYPER_COST_MULT,
    IA_HYPER_UNLOCK_PERCENT,
    LATE_TRANSISTOR_QUANTUM_FACTOR,
    IA_OVERDRIVE_DURATION_MS,
    IA_OVERDRIVE_BONUS,
} from "../state.js";
import { nowMs } from "../state.js";

let getGameRef = () => null;
let getActiveBuffMultipliersRef = () => ({});
let getCurriculumMultipliersRef = () => ({
    compute: 1,
    transistors: 1,
    exploration: 1,
    iaCharge: 1,
    ai: 1,
    research: 1,
});
let logMessageRef = () => {};
let updateProjectsAutoRef = () => {};
let updateMiniGamesRef = () => {};
let maybeOfferEmergenceRef = () => {};
let maybeTriggerEndGameRef = () => {};
let maybeTriggerIAEmergenceRef = () => {};
let maybeFinishIADebuffRef = () => {};
let checkMilestonesRef = () => {};
let renderAllRef = () => {};
let getDebugTimeScaleRef = () => 1;
let getDebugIgnoreEndgameRef = () => false;

export function initMechanics({
    getGame,
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
    getDebugTimeScale,
    getDebugIgnoreEndgame,
} = {}) {
    if (typeof getGame === "function") getGameRef = getGame;
    if (typeof getActiveBuffMultipliers === "function") getActiveBuffMultipliersRef = getActiveBuffMultipliers;
    if (typeof getCurriculumMultipliers === "function") getCurriculumMultipliersRef = getCurriculumMultipliers;
    if (typeof logMessage === "function") logMessageRef = logMessage;
    if (typeof updateProjectsAuto === "function") updateProjectsAutoRef = updateProjectsAuto;
    if (typeof updateMiniGames === "function") updateMiniGamesRef = updateMiniGames;
    if (typeof maybeOfferEmergence === "function") maybeOfferEmergenceRef = maybeOfferEmergence;
    if (typeof maybeTriggerEndGame === "function") maybeTriggerEndGameRef = maybeTriggerEndGame;
    if (typeof maybeTriggerIAEmergence === "function") maybeTriggerIAEmergenceRef = maybeTriggerIAEmergence;
    if (typeof maybeFinishIADebuff === "function") maybeFinishIADebuffRef = maybeFinishIADebuff;
    if (typeof checkMilestones === "function") checkMilestonesRef = checkMilestones;
    if (typeof renderAll === "function") renderAllRef = renderAll;
    if (typeof getDebugTimeScale === "function") getDebugTimeScaleRef = getDebugTimeScale;
    if (typeof getDebugIgnoreEndgame === "function") getDebugIgnoreEndgameRef = getDebugIgnoreEndgame;
}

const getGame = () => getGameRef();

export function getGeneratorCost() {
    const game = getGame();
    return Math.floor(game.generatorBaseCost * Math.pow(game.generatorCostMultiplier, game.generators));
}

export function getComputerCost() {
    const game = getGame();
    return Math.floor(game.computerBaseCost * Math.pow(game.computerCostMultiplier, game.computers));
}

export function getQuantumComputerCost() {
    const game = getGame();
    return Math.floor(
        game.quantumComputerBaseCost * Math.pow(game.quantumComputerCostMultiplier, game.quantumComputers)
    );
}

export function getComputerPowerMultiplier() {
    const game = getGame();
    const qp = Math.max(0, game.quantumPower);
    return 1 + 0.22 * Math.sqrt(qp);
}

export function getGeneratorOutputMultiplier() {
    const game = getGame();
    const quantumBoost = 1 + LATE_TRANSISTOR_QUANTUM_FACTOR * Math.sqrt(Math.max(0, game.quantumPower));
    const aiBoost = 1 + 0.25 * Math.sqrt(Math.max(0, game.aiProgress) / 1_000_000);
    const exploreBoost = 1 + (game.explorationBonuses?.compute || 0);
    const curriculum = getCurriculumMultipliersRef().transistors;
    const buff = getActiveBuffMultipliersRef();
    return Math.max(1, quantumBoost * aiBoost * exploreBoost * curriculum * (buff.generators || 1));
}

export function getComputerPowerPerSec() {
    const game = getGame();
    const aiModeBoost = game.aiMode === "deployed" ? 1.1 : 1;
    const exploreBoost = 1 + (game.explorationBonuses?.compute || 0);
    const protoBoost = game.protoAlgoMultiplier || 1;
    const curriculum = getCurriculumMultipliersRef().compute;
    return (
        game.computers *
        game.powerPerComputerPerSec *
        getComputerPowerMultiplier() *
        aiModeBoost *
        exploreBoost *
        protoBoost *
        curriculum
    );
}

export function getExplorationMultiplier(now = nowMs()) {
    const game = getGame();
    let mult = game.expoFactor || 1;
    if (now < game.flags.iaOverdriveEndTime) {
        mult *= IA_OVERDRIVE_BONUS;
    }
    if (game.flags.iaEmergenceAccepted && now < game.flags.iaDebuffEndTime) {
        mult *= IA_DEBUFF_CHARGE_MULT; // reduce exploration gain during debuff
    }
    return mult;
}

export function performExplorationScan(now = nowMs()) {
    const game = getGame();
    if (!game.explorationUnlocked) return;
    const aiCost = IA_SCAN_AI_BASE * Math.pow(IA_SCAN_AI_GROWTH, game.scanCount);
    const chargeCost = IA_SCAN_CHARGE_BASE * Math.pow(IA_SCAN_CHARGE_GROWTH, game.scanCount);
    if (game.aiProgress < aiCost || game.iaCharge < chargeCost) return;
    game.aiProgress -= aiCost;
    game.iaCharge -= chargeCost;
    game.scanCount += 1;
    game.explorationScans += 1;
    const deltaPercent =
        IA_SCAN_DELTA_BASE *
        Math.exp(IA_SCAN_DELTA_EXP * (game.universeExploredPercent / IA_SCAN_DENOM_SCALE)) /
        (1 + game.scanCount / 200);
    const mult = getExplorationMultiplier(now);
    game.universeExploredPercent += deltaPercent * mult;
    const reward = EXPLORATION_REWARD_TABLE[Math.floor(Math.random() * EXPLORATION_REWARD_TABLE.length)];
    applyExplorationReward(reward);
    logMessageRef(`Sector scanned: ${reward.label}.`);
}

export function performHyperScan(now = nowMs()) {
    const game = getGame();
    if (!game.explorationUnlocked) return;
    if (game.universeExploredPercent < IA_HYPER_UNLOCK_PERCENT) return;
    const aiCost = IA_SCAN_AI_BASE * IA_HYPER_COST_MULT * Math.pow(IA_SCAN_AI_GROWTH, game.scanCount);
    const chargeCost = IA_SCAN_CHARGE_BASE * IA_HYPER_COST_MULT * Math.pow(IA_SCAN_CHARGE_GROWTH, game.scanCount);
    if (game.aiProgress < aiCost || game.iaCharge < chargeCost) return;
    game.aiProgress -= aiCost;
    game.iaCharge -= chargeCost;
    game.scanCount += 1;
    game.hyperScanCount += 1;
    game.explorationHypers += 1;
    game.explorationScans += 1;
    const baseDelta =
        IA_SCAN_DELTA_BASE *
        Math.exp(IA_SCAN_DELTA_EXP * (game.universeExploredPercent / IA_SCAN_DENOM_SCALE)) /
        (1 + game.scanCount / 200);
    const mult = getExplorationMultiplier(now);
    game.universeExploredPercent += baseDelta * IA_HYPER_MULT * mult;
    const reward = EXPLORATION_REWARD_TABLE[Math.floor(Math.random() * EXPLORATION_REWARD_TABLE.length)];
    applyExplorationReward(reward);
    logMessageRef(`Hyper scan complete: ${reward.label}.`);
}

export function applyExplorationReward(reward) {
    const game = getGame();
    if (!reward) return;
    if (reward.id === "quantum") {
        game.quantumPower *= 1 + reward.bonus;
        return;
    }
    const key = reward.id;
    const current = game.explorationBonuses?.[key] || 0;
    const capped = Math.min(EXPLORATION_MAX_BONUS, current + reward.bonus);
    game.explorationBonuses = {
        ...game.explorationBonuses,
        [key]: capped,
    };
}

export function performQuantumSurge(now = nowMs()) {
    const game = getGame();
    if (!game.explorationUnlocked) return;
    if (game.quantumComputers < 1) return;
    game.quantumComputers -= 1;
    game.flags.iaOverdriveEndTime = now + IA_OVERDRIVE_DURATION_MS;
    logMessageRef("Quantum surge initiated. Exploration boosted.");
}

export function gameTick() {
    const game = getGame();
    // Allow bypassing the end-state for late-game testing when enabled.
    if (game.flags.gameEnded && !getDebugIgnoreEndgameRef()) {
        return;
    }

    const now = nowMs();
    const baseDeltaSec = (now - game.lastTick) / 1000;
    game.lastTick = now;
    const deltaSec = baseDeltaSec * getDebugTimeScaleRef() * GAME_SPEED_MULTIPLIER;
    const buff = getActiveBuffMultipliersRef(now);

    // Production via generators
    const generatorMultiplier = getGeneratorOutputMultiplier();
    const fromGenerators =
        game.generators *
        game.transistorsPerGeneratorPerSec *
        generatorMultiplier *
        game.productionBoost *
        (buff.transistors || 1) *
        deltaSec;
    game.transistors += fromGenerators;
    game.totalTransistorsCreated += fromGenerators;
    const aiModeOutputBoost = game.aiMode === "deployed" ? 1.1 : 1;
    const powerFromComputers =
        getComputerPowerPerSec() *
        deltaSec *
        buff.compute *
        game.productionBoost;
    const quantumBaseOutput =
        game.quantumComputers *
        game.quantumComputerPowerPerSec *
        getComputerPowerMultiplier() *
        game.productionBoost *
        deltaSec;
    const quantumToCompute = quantumBaseOutput * game.quantumAllocationToCompute * aiModeOutputBoost * buff.compute;
    const quantumToResearch = quantumBaseOutput * (1 - game.quantumAllocationToCompute) * aiModeOutputBoost;
    game.computerPower += powerFromComputers;
    game.computerPower += quantumToCompute;
    game.lifetimeComputerPower += powerFromComputers;
    game.lifetimeComputerPower += quantumToCompute;

    if (!game.researchUnlocked && game.computerPower >= RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD) {
        game.researchUnlocked = true;
        if (game.researchPerSec < MIN_RESEARCH_PER_SEC_ON_UNLOCK) {
            game.researchPerSec = MIN_RESEARCH_PER_SEC_ON_UNLOCK;
        }
        if (game.flags.terminalUnlocked) {
            logMessageRef("[197x] Computation repurposed for R&D.");
            logMessageRef("Research module online.");
        }
    }

    let quantumResearchOutput = 0;
    if (game.researchUnlocked && game.researchPerSec > 0) {
        const exploreResearchBoost = 1 + (game.explorationBonuses?.research || 0);
        const curriculumResearch = getCurriculumMultipliersRef().research;
        const gainedResearch =
            game.researchPerSec * aiModeOutputBoost * deltaSec * exploreResearchBoost;
        const quantumResearchGain =
            quantumToResearch * BASE_QUANTUM_RESEARCH_FACTOR * game.quantumResearchBoost;
        quantumResearchOutput = quantumResearchGain;
        const totalResearchGain =
            (gainedResearch + quantumResearchGain) *
            buff.research *
            RESEARCH_SPEED_BONUS *
            curriculumResearch;
        game.research += totalResearchGain;
        game.lifetimeResearch += totalResearchGain;
    }

    if (game.aiUnlocked && game.aiProgressPerSec) {
        const modeMultiplier = game.aiMode === "training" ? 1.2 : 0.6;
        const exploreAIBoost = 1 + (game.explorationBonuses?.ai || 0);
        let aiGainMult = getCurriculumMultipliersRef().ai;
        if (game.flags.iaEmergenceAccepted && now < game.flags.iaDebuffEndTime) {
            aiGainMult *= IA_DEBUFF_AI_MULT;
        }
        const gainedAI =
            game.aiProgressPerSec * modeMultiplier * deltaSec * buff.ai * exploreAIBoost * aiGainMult;
        game.aiProgress += gainedAI;
        game.lifetimeAIProgress += gainedAI;
    }

    if (game.quantumUnlocked) {
        const qp = Math.max(0, game.quantumPower);
        const aiProg = Math.max(0, game.aiProgress);
        let iaChargePerSec =
            quantumResearchOutput *
            IA_CHARGE_FACTOR *
            (1 + IA_CHARGE_QP_FACTOR * Math.sqrt(qp)) *
            (1 + IA_CHARGE_AI_FACTOR * Math.sqrt(aiProg / 1_000_000));
        iaChargePerSec *= getCurriculumMultipliersRef().iaCharge;
        iaChargePerSec *= buff.iaCharge || 1;
        if (game.flags.iaEmergenceAccepted && now < game.flags.iaDebuffEndTime) {
            iaChargePerSec *= IA_DEBUFF_CHARGE_MULT;
        }
        game.iaChargePerSec = iaChargePerSec;
        game.iaCharge += iaChargePerSec * deltaSec;
    }

    if (game.explorationUnlocked) {
        const qp = Math.max(0, game.quantumPower);
        const aiProgress = Math.max(0, game.aiProgress);
        const signalMultiplier = (1 + 0.15 * Math.sqrt(qp)) * (1 + 0.1 * Math.sqrt(aiProgress / 1_000_000));
        const curriculumExplore = getCurriculumMultipliersRef().exploration;
        const signalsGain =
            quantumToResearch * EXPLORATION_SIGNAL_FACTOR * signalMultiplier * curriculumExplore;
        game.explorationSignals += signalsGain;
    } else if (
        game.quantumUnlocked &&
        game.quantumPower >= EXPLORATION_UNLOCK_QUANTUM_THRESHOLD &&
        game.research >= EXPLORATION_UNLOCK_RESEARCH_THRESHOLD
    ) {
        game.explorationUnlocked = true;
        game.explorationSignals = Math.max(game.explorationSignals, 50);
        logMessageRef("Deep space scanners online. Exploration unlocked.");
    }

    if (game.flags.iaCapped && game.universeExploredPercent > 100) {
        game.universeExploredPercent = 100;
    }

    maybeTriggerIAEmergenceRef(now);
    maybeFinishIADebuffRef(now);

    updateProjectsAutoRef();
    updateMiniGamesRef(now);
    maybeOfferEmergenceRef();
    maybeTriggerEndGameRef();

    checkMilestonesRef();
    renderAllRef();
}
