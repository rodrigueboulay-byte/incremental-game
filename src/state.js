// === Configuration ===
export const TICK_MS = 100;
export const GAME_SPEED_MULTIPLIER = 4; // global pacing boost (forte accélération)
export const RESEARCH_SPEED_BONUS = 1.25; // persistent research throughput boost
export const MIN_RESEARCH_PER_SEC_ON_UNLOCK = 6; // ensure early research ramps faster
export const SAVE_KEY = "the_transistor_save_v1";
export const FIRST_COMPUTER_TRANSISTOR_THRESHOLD = 1_000; // seuil arbitraire pour le premier PC
export const RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD = 4_000;
export const EMERGENCE_AI_THRESHOLD = 1_000_000;
export const EMERGENCE_QUANTUM_THRESHOLD = 5;
export const QUANTUM_UNLOCK_COMPUTER_POWER_THRESHOLD = 40_000;
export const QUANTUM_RESEARCH_UNLOCK_THRESHOLD = 3_000;
export const END_GAME_AI_FINAL_THRESHOLD = 5_000_000;
export const END_GAME_COMPUTE_FINAL_THRESHOLD = 5_000_000_000;
export const AI_COMPUTE_UNLOCK_THRESHOLD = 100_000; // compute needed to unlock AI layer
export const AI_RESEARCH_UNLOCK_THRESHOLD = 50_000; // research needed to unlock AI layer
export const LATE_TRANSISTOR_QUANTUM_FACTOR = 3; // how strongly quantum boosts transistor fabs (base factor; see multiplier)
export const MAX_VISIBLE_UPGRADES_PER_CATEGORY = 3;
export const UPGRADE_VISIBILITY_COST_FACTOR = 3;
export const PROJECT_VISIBILITY_COST_FACTOR = 3;
export const MAX_VISIBLE_PROJECTS = 5;
export const BASE_QUANTUM_RESEARCH_FACTOR = 1.2;
export const EXPLORATION_SIGNAL_PLACEHOLDER = true; // Hook pour le futur système d'exploration
export const EXPLORATION_SIGNAL_FACTOR = 0.02; // ratio du flux QC recherche converti en signaux
export const EXPLORATION_UNLOCK_RESEARCH_THRESHOLD = 20_000_000;
export const EXPLORATION_UNLOCK_QUANTUM_THRESHOLD = 5;
export const EXPLORATION_SCAN_BASE_COST = 100;
export const EXPLORATION_SCAN_GROWTH = 2;
export const EXPLORATION_MAX_BONUS = 2.0; // +200% cap par type
export const EXPLORATION_REWARD_TABLE = [
    { id: "compute", label: "Compute node", bonus: 0.05 },
    { id: "research", label: "Research observatory", bonus: 0.05 },
    { id: "ai", label: "AI co-processor", bonus: 0.04 },
    { id: "quantum", label: "Quantum beacon", bonus: 0.03 },
];
export const ANCHOR_QC_COST = 1;
export const ANCHOR_QUANTUM_PENALTY = 0.1;
export const ANCHOR_GLOBAL_BONUS = 0.12;
export const ANCHOR_SIGNAL_BONUS = 0.05;
export const IA_SCAN_AI_BASE = 50_000;
export const IA_SCAN_AI_GROWTH = 1.9;
export const IA_SCAN_CHARGE_BASE = 1_000_000;
export const IA_SCAN_CHARGE_GROWTH = 1.4;
export const IA_SCAN_DELTA_BASE = 1e-21;
export const IA_SCAN_DELTA_EXP = 0.08;
export const IA_SCAN_DENOM_SCALE = 0.001;
export const IA_HYPER_UNLOCK_PERCENT = 1e-9;
export const IA_HYPER_MULT = 100;
export const IA_HYPER_COST_MULT = 10;
export const IA_CHARGE_FACTOR = 0.05;
export const IA_CHARGE_QP_FACTOR = 0.2;
export const IA_CHARGE_AI_FACTOR = 0.15;
export const IA_OVERDRIVE_BONUS = 6; // +500% => x6
export const IA_OVERDRIVE_DURATION_MS = 10 * 60 * 1000;
export const IA_DEBUFF_DURATION_MS = 10 * 60 * 1000;
export const IA_DEBUFF_AI_MULT = 0.3; // -70%
export const IA_DEBUFF_CHARGE_MULT = 0.5; // -50%
export const IA_EMERGENCE_AI_REQ = 1_000_000;
export const IA_EMERGENCE_EXPLORE_REQ = 1e-12;
export const ALIGN_MIN_INTERVAL_MS = 45_000;
export const ALIGN_MAX_INTERVAL_MS = 90_000;
export const ALIGN_RESPONSE_WINDOW_MS = 4_000;
export const ALIGN_BUFF_DURATION_MS = 30_000;
export const ALIGN_HISTORY_MAX = 5;
export const READING_COOLDOWN_MIN_MS = 120_000;
export const READING_COOLDOWN_MAX_MS = 300_000;
export const READING_BUFF_MIN_MS = 30_000;
export const READING_BUFF_MAX_MS = 90_000;
export const RL_LOOP_INTERVAL_MS = 24000;
export const RL_LOOP_BUFF_DURATION_MS = 120000;
export const RL_LOOP_HISTORY_MAX = 5;
export const CURRICULUM_PROFILES = {
    compute: {
        id: "compute",
        label: "Compute-Focused",
        mult: { compute: 1.3, research: 0.9, transistors: 1, exploration: 1, iaCharge: 1, ai: 1 },
        bonuses: "+30% compute",
        penalties: "-10% research",
    },
    research: {
        id: "research",
        label: "Research-Focused",
        mult: { compute: 0.85, research: 1.4, transistors: 1, exploration: 1, iaCharge: 1, ai: 1 },
        bonuses: "+40% research",
        penalties: "-15% compute",
    },
    balanced: {
        id: "balanced",
        label: "Balanced",
        mult: { compute: 1.1, research: 1.1, transistors: 1.1, exploration: 1.1, iaCharge: 1.1, ai: 1.05 },
        bonuses: "+10% all",
        penalties: "Minor draw",
    },
    exploration: {
        id: "exploration",
        label: "Exploration-Focused",
        mult: { compute: 1, research: 1, transistors: 1, exploration: 1.2, iaCharge: 1.8, ai: 0.8 },
        bonuses: "+80% IA charge, +20% exploration signals",
        penalties: "-20% AI/sec",
    },
};
export const MINI_GAMES = [
    {
        id: "mg_proto_algo",
        projectId: "proto_algorithm",
        title: "Primitive Algorithm Pulse",
        description: "Kick a crude routine to spike compute briefly.",
        intervalMs: 18_000,
        windowMs: 5_000,
        buffDurationMs: 45_000,
        buffs: { compute: 1.15, research: 1.05 },
        autoUpgradeId: null,
    },
    {
        id: "mg_curriculum",
        projectId: "ai_curriculum",
        title: "Curriculum Pulse",
        description: "Sync a training pulse to boost AI progress.",
        intervalMs: 20_000, // faster
        windowMs: 6_000, // slightly longer window
        buffDurationMs: 90_000, // longer buff
        buffs: { ai: 1.5 }, // stronger boost
        autoUpgradeId: "ai_auto_sync",
    },
    {
        id: "mg_synth_harvest",
        projectId: "ai_synthetic_data",
        title: "Synthetic Harvest",
        description: "Collect the freshest synthetic dataset for dual boosts.",
        intervalMs: 30_000,
        windowMs: 7_000,
        buffDurationMs: 90_000,
        buffs: { ai: 1.25, research: 1.25 },
        autoUpgradeId: "ai_auto_collect",
    },
    {
        id: "mg_quantum_rl",
        projectId: "ai_quantum_rl",
        title: "Quantum RL Loop",
        description: "Deploy a quantum policy to spike AI and compute.",
        intervalMs: 40_000,
        windowMs: 7_000,
        buffDurationMs: 90_000,
        buffs: { ai: 1.4, compute: 1.35 },
        autoUpgradeId: "ai_auto_deploy",
    },
    {
        id: "mg_alignment",
        projectId: "ai_alignment",
        title: "Alignment Check",
        description: "Validate alignment to stabilize progress and costs.",
        intervalMs: 35_000,
        windowMs: 6_000,
        buffDurationMs: 90_000,
        buffs: { ai: 1.2, projectCostReduction: 0.85 },
        autoUpgradeId: "ai_auto_validate",
    },
    {
        id: "mg_reading",
        projectId: "ai_reading",
        title: "Reading Burst",
        description: "Let the model digest a corpus for research velocity.",
        intervalMs: 28_000,
        windowMs: 6_000,
        buffDurationMs: 90_000,
        buffs: { research: 1.4 },
        autoUpgradeId: "ai_auto_read",
    },
];
export const UI_THRESHOLDS = {
    transistors: 1,
    production: 10,
    terminal: 800,
    upgrades: 1000,
};
export const PANEL_ORDER_KEY = "panel_order";
export const PANEL_COLUMNS_KEY = "panel_column_map";
export const MINI_GAMES_ORDER_KEY = "mini_games_order";

export const PHASES = {
    PRODUCTION: 0, // only transistor chain upgrades
    COMPUTERS: 1, // computer upgrades unlocked
    RESEARCH: 2, // research upgrades unlocked
    AI: 3, // AI upgrades unlocked
    QUANTUM: 4, // quantum upgrades unlocked
};

export function getGamePhase(game) {
    if (
        game.quantumUnlocked ||
        game.quantumPower > 0 ||
        game.research >= QUANTUM_RESEARCH_UNLOCK_THRESHOLD ||
        game.computerPower >= QUANTUM_UNLOCK_COMPUTER_POWER_THRESHOLD
    ) {
        return PHASES.QUANTUM;
    }
    if (game.aiUnlocked) {
        return PHASES.AI;
    }
    if (
        game.researchUnlocked ||
        game.research > 0 ||
        game.computerPower >= RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD * 0.75
    ) {
        return PHASES.RESEARCH;
    }
    if (
        game.computers > 0 ||
        game.computerPower >= FIRST_COMPUTER_TRANSISTOR_THRESHOLD ||
        game.totalTransistorsCreated >= UI_THRESHOLDS.terminal
    ) {
        return PHASES.COMPUTERS;
    }
    return PHASES.PRODUCTION;
}

export function nowMs() {
    return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

export function createDefaultGameState() {
    return {
        phase: 0,
        transistors: 0,
        transistorsPerClick: 1,
        totalTransistorsCreated: 0,
        computerPower: 0,
        lifetimeComputerPower: 0,
        computers: 0,
        computerBaseCost: 800,
        computerCostMultiplier: 1.25,
        powerPerComputerPerSec: 8,

        quantumComputers: 0,
        quantumComputerBaseCost: 8_000_000,
        quantumComputerCostMultiplier: 1.4,
        quantumComputerPowerPerSec: 300_000,
        quantumAllocationToCompute: 0.5,

        quantumPower: 0,
        quantumUnlocked: false,
        aiProgress: 0,
        lifetimeAIProgress: 0,
        aiUnlocked: false,
        aiMode: "training",
        aiProgressPerSec: 12,

        research: 0,
        researchPerSec: 0,
        lifetimeResearch: 0,
        researchUnlocked: false,
        saveVersion: "v1",
        quantumResearchBoost: 1,

        generators: 0,
        generatorBaseCost: 25,
        generatorCostMultiplier: 1.12,
        transistorsPerGeneratorPerSec: 10,

        projectsCompleted: {},
        projectEffectsApplied: {},
        aiProjectsCompleted: {},
        aiProjectEffectsApplied: {},

        upgradesBought: {},
        terminalLog: [],
        explorationSignals: 0,
        explorationUnlocked: false,
        explorationScans: 0,
        explorationHypers: 0,
        universeExploredPercent: 0,
        iaCharge: 0,
        iaChargePerSec: 0,
        scanCount: 0,
        hyperScanCount: 0,
        expoFactor: 1,
        productionBoost: 1,
        protoAlgoRisk: "medium",
        protoAlgoMultiplier: 1,
        protoAlgoLastResult: 0,
        protoAlgoLog: [],
        protoAlgoNextCycleAt: nowMs() + 4000,
        curriculumProfile: "balanced",
        curriculumLastSwitch: nowMs(),
        alignmentScore: 0,
        alignmentHistory: [],
        alignmentActiveBuffs: [],
        alignmentScenario: null,
        alignmentNextScenarioAt: nowMs() + ALIGN_MIN_INTERVAL_MS,
        alignmentExpiresAt: 0,
        alignmentStartedAt: 0,
        alignmentLastDecay: nowMs(),
        readingLastInsight: "None yet",
        readingLastRarity: "common",
        readingHistory: [],
        readingCooldownEnd: 0,
        readingCooldownDuration: 0,
        readingActiveBuffs: [],
        synthHarvestActiveBuffs: [],
        rlLoopHistory: [],
        rlLoopStrength: { compute: 1, research: 1, exploration: 1, quantum: 1 },
        rlLoopActiveBuffs: [],
        rlLoopOptions: [],
        rlLoopNextDecisionAt: 0,
        synthCycleStart: nowMs(),
        synthCycleDuration: 60000,
        synthHarvestLastResult: "Idle",
        synthHarvestBuffEndTime: 0,
        explorationBonuses: { compute: 0, research: 0, ai: 0 },
        flags: {
            firstComputerBuilt: false,
            terminalUnlocked: false,
            emergenceOffered: false,
            emergenceChosen: false,
            consciousnessAwakened: null,
            gameEnded: false,
            endAcknowledged: false,
            iaEmergenceReady: false,
            iaEmergenceAccepted: false,
            iaEmergenceCompleted: false,
            iaDebuffEndTime: 0,
            iaCapped: false,
            iaOverdriveEndTime: 0,
        },

        lastTick: nowMs(),
    };
}

export let gameState = createDefaultGameState();

export function setGameState(nextState) {
    gameState = nextState;
    return gameState;
}
