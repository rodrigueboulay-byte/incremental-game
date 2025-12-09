import {
    TICK_MS,
    GAME_SPEED_MULTIPLIER,
    RESEARCH_SPEED_BONUS,
    MIN_RESEARCH_PER_SEC_ON_UNLOCK,
    SAVE_KEY,
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
    MAX_VISIBLE_UPGRADES_PER_CATEGORY,
    UPGRADE_VISIBILITY_COST_FACTOR,
    PROJECT_VISIBILITY_COST_FACTOR,
    MAX_VISIBLE_PROJECTS,
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
    PANEL_ORDER_KEY,
    PANEL_COLUMNS_KEY,
    MINI_GAMES_ORDER_KEY,
    PHASES,
    nowMs,
    createDefaultGameState,
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

let lastRenderedUpgradesKey = null;
let lastRenderedQuantumUpgradesKey = null; // NEW: track quantum upgrades render
let lastRenderedProjectsKey = null;
let lastRenderedAIProjectsKey = null;
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

function getGamePhase(game) {
    if (
        game.quantumUnlocked ||
        game.quantumPower > 0 ||
        game.research >= QUANTUM_RESEARCH_UNLOCK_THRESHOLD ||
        game.computerPower >= QUANTUM_UNLOCK_COMPUTER_POWER_THRESHOLD
    ) {
        return PHASES.QUANTUM; // fixed typo that crashed upgrade rendering at quantum stage
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

// === Upgrades ===
const UPGRADES = [
    // Transistors
    {
        id: "dopage_silicium_1",
        category: "transistors",
        name: "Silicon Doping I",
        description: "+30% transistors per second.",
        costPower: 100,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.3;
        },
    },
    {
        id: "finger_training",
        category: "transistors",
        name: "Finger Training",
        description: "+2 transistors per click.",
        costPower: 50,
        apply: () => {
            game.transistorsPerClick += 2;
        },
    },
    {
        id: "haptic_clicks",
        category: "transistors",
        name: "Haptic Clicks",
        description: "+50% transistors per click.",
        costPower: 250,
        apply: () => {
            game.transistorsPerClick *= 1.5;
        },
    },
    {
        id: "ergonomic_switches",
        category: "transistors",
        name: "Ergonomic Switches",
        description: "+3 transistors per click.",
        costPower: 1_200,
        apply: () => {
            game.transistorsPerClick += 3;
        },
    },
    {
        id: "dopage_silicium_2",
        category: "transistors",
        name: "Silicon Doping II",
        description: "+30% transistors per second.",
        costPower: 500,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.3;
        },
    },
    {
        id: "purete_silicium",
        category: "transistors",
        name: "High-Purity Silicon",
        description: "+40% transistors per second.",
        costPower: 2500,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.4;
        },
    },
    {
        id: "photolitho_1",
        category: "transistors",
        name: "Basic Photolithography",
        description: "+50% transistors per second.",
        costPower: 12500,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.5;
        },
    },
    {
        id: "photolitho_2",
        category: "transistors",
        name: "Deep UV Photolithography",
        description: "+50% transistors per second.",
        costPower: 60000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.5;
        },
    },
    {
        id: "gravure_1um",
        category: "transistors",
        name: "1 um Process Node",
        description: "+60% transistors per second.",
        costPower: 300000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.6;
        },
    },
    {
        id: "gravure_90nm",
        category: "transistors",
        name: "90 nm Node",
        description: "+70% transistors per second.",
        costPower: 1500000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.7;
        },
    },
    {
        id: "gravure_14nm",
        category: "transistors",
        name: "14 nm Node",
        description: "+80% transistors per second.",
        costPower: 8000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.8;
        },
    },
    {
        id: "gravure_7nm",
        category: "transistors",
        name: "7 nm Node",
        description: "+90% transistors per second.",
        costPower: 40000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.9;
        },
    },
    {
        id: "gravure_3nm",
        category: "transistors",
        name: "3 nm Node",
        description: "+120% transistors per second.",
        costPower: 200000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 2.2;
        },
    },
    {
        id: "manual_overdrive",
        category: "transistors",
        name: "Manual Overdrive",
        description: "+5 transistors per click.",
        costPower: 15000,
        apply: () => {
            game.transistorsPerClick += 5;
        },
    },
    {
        id: "haptic_tuning",
        category: "transistors",
        name: "Haptic Tuning",
        description: "+50% transistors per click.",
        costPower: 450000,
        apply: () => {
            game.transistorsPerClick *= 1.5;
        },
    },
    {
        id: "quantum_tap",
        category: "transistors",
        name: "Quantum Tap Interface",
        description: "x3 transistors per click.",
        costPower: 35000000,
        apply: () => {
            game.transistorsPerClick *= 3;
        },
    },
    {
        id: "fab_autotune",
        category: "transistors",
        name: "Self-Calibrating Fabs",
        description: "+50% generator transistor output.",
        costPower: 120000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.5;
        },
    },
    {
        id: "cryo_fabs",
        category: "transistors",
        name: "Cryogenic Fabs",
        description: "x2 generator transistor output.",
        costPower: 650000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 2;
        },
    },
    {
        id: "self_replicating_lines",
        category: "transistors",
        name: "Self-Replicating Lines",
        description: "+150% generator transistor output.",
        costPower: 3000000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 2.5;
        },
    },
    {
        id: "photonic_etchers",
        category: "transistors",
        name: "Photonic Etchers",
        description: "x3 generator transistor output.",
        costPower: 18000000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 3;
        },
    },
    {
        id: "hyperconductive_fabs",
        category: "transistors",
        name: "Hyperconductive Fabs",
        description: "x5 generator transistor output.",
        costPower: 120_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 5;
        },
    },
    {
        id: "femto_etch",
        category: "transistors",
        name: "Femto-Scale Etching",
        description: "x8 generator transistor output.",
        costPower: 650_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 8;
        },
    },
    {
        id: "molecular_assemblers",
        category: "transistors",
        name: "Molecular Assemblers",
        description: "x12 generator transistor output.",
        costPower: 3_500_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 12;
        },
    },
    {
        id: "vacuum_nanofabs",
        category: "transistors",
        name: "Vacuum Nanofabs",
        description: "x20 generator transistor output.",
        costPower: 22_000_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 20;
        },
    },
    {
        id: "atomically_precise_fabs",
        category: "transistors",
        name: "Atomic Lattice Fabs",
        description: "x35 generator transistor output.",
        costPower: 140_000_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 35;
        },
    },
    {
        id: "planck_forge",
        category: "transistors",
        name: "Planck Forge",
        description: "x55 generator transistor output.",
        costPower: 900_000_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 55;
        },
    },
    {
        id: "quark_weaver",
        category: "transistors",
        name: "Quark Weaver",
        description: "x80 generator transistor output.",
        costPower: 5_500_000_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 80;
        },
    },
    {
        id: "vacuum_crystal",
        category: "transistors",
        name: "Vacuum Crystal Substrates",
        description: "x120 generator transistor output.",
        costPower: 36_000_000_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 120;
        },
    },
    {
        id: "zero_point_fabs",
        category: "transistors",
        name: "Zero-Point Fabs",
        description: "x200 generator transistor output.",
        costPower: 180_000_000_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 200;
        },
    },

    // Computers
    {
        id: "pipeline_basic",
        category: "computers",
        name: "Basic Pipeline",
        description: "+15% computer power / sec",
        costPower: 2000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.15;
        },
    },
    {
        id: "cache_l1",
        category: "computers",
        name: "L1 Cache",
        description: "+30% computer power / sec",
        costPower: 10000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.3;
        },
    },
    {
        id: "cache_l2",
        category: "computers",
        name: "L2 Cache",
        description: "+50% computer power / sec",
        costPower: 50000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.5;
        },
    },
    {
        id: "superscalar",
        category: "computers",
        name: "Superscalar",
        description: "+50% computer power / sec",
        costPower: 250000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.5;
        },
    },
    {
        id: "hyperthreading",
        category: "computers",
        name: "HyperThreading",
        description: "+70% computer power / sec",
        costPower: 1_200_000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.7;
        },
    },
    {
        id: "multi_core",
        category: "computers",
        name: "Dual Core Era",
        description: "+80% computer power / sec",
        costPower: 6_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.8;
        },
    },
    {
        id: "quad_core",
        category: "computers",
        name: "Quad Core Era",
        description: "x2 computer power / sec",
        costPower: 30_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 2;
        },
    },
    {
        id: "gpu_compute",
        category: "computers",
        name: "GPU Compute Units",
        description: "x2 computer power / sec",
        costPower: 180_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 2;
        },
    },
    {
        id: "tensor_units",
        category: "computers",
        name: "Tensor Units",
        description: "x2.5 computer power / sec",
        costPower: 1_000_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 2.5;
        },
    },
    {
        id: "cooling_extreme",
        category: "computers",
        name: "Extreme Cooling",
        description: "x3 computer power / sec",
        costPower: 6_000_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 3;
        },
    },
    {
        id: "optical_interconnects",
        category: "computers",
        name: "Optical Interconnects",
        description: "x3 computer power / sec.",
        costPower: 40_000_000_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 3;
        },
    },
    {
        id: "singular_cooling",
        category: "computers",
        name: "Singular Cooling",
        description: "x2 computer power / sec.",
        costPower: 150_000_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 2;
        },
    },
    {
        id: "quantum_activation",
        category: "computers",
        name: "Quantum Activation",
        description: "Unlock quantum systems and add 0.5 quantum power.",
        costPower: 25_000_000_000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower = Math.max(game.quantumPower, 0.5);
            logMessage("Quantum systems commissioned. Superposition ready.");
        },
    },

    // Research
    {
        id: "research_unlock",
        category: "research",
        name: "Research Lab",
        description: "Unlocks research and starts generating 10.0 research/sec.",
        costPower: 80000,
        apply: () => {
            game.researchUnlocked = true;
            if (game.researchPerSec < 10) {
                game.researchPerSec = 10;
            }
            logMessage("Research lab activated. New insights possible.");
        },
    },
    {
        id: "algebra_bool",
        category: "research",
        name: "Boolean Algebra",
        description: "+30% research/sec",
        costPower: 300000,
        apply: () => {
            game.researchPerSec *= 1.5;
        },
    },
    {
        id: "stat_methods",
        category: "research",
        name: "Statistical Methods",
        description: "+40% research/sec",
        costPower: 900000,
        costResearch: 15000,
        apply: () => {
            game.researchPerSec *= 1.6;
        },
    },
    {
        id: "matrix_opt",
        category: "research",
        name: "Matrix Optimizations",
        description: "+45% research/sec",
        costPower: 2000000,
        costResearch: 50000,
        apply: () => {
            game.researchPerSec *= 1.7;
        },
    },
    {
        id: "algorithm_opt",
        category: "research",
        name: "Algorithm Optimizations",
        description: "+60% research/sec",
        costPower: 8000000,
        costResearch: 200000,
        apply: () => {
            game.researchPerSec *= 1.8;
        },
    },
    {
        id: "backprop_insight",
        category: "research",
        name: "Backprop Foundations",
        description: "+70% research/sec",
        costPower: 120000000,
        costResearch: 600000,
        apply: () => {
            game.researchPerSec *= 1.9;
        },
    },
    {
        id: "conv_math",
        category: "research",
        name: "Convolution Math",
        description: "+70% research/sec",
        costPower: 700000000,
        costResearch: 2500000,
        apply: () => {
            game.researchPerSec *= 2.0;
        },
    },
    {
        id: "transformer_theory",
        category: "research",
        name: "Transformer Mathematics",
        description: "x1.8 research/sec",
        costPower: 1_000_000_000_000,
        costResearch: 20_000_000,
        apply: () => {
            game.researchPerSec *= 1.8;
        },
    },
    {
        id: "quantum_methods",
        category: "research",
        name: "Quantum Methods",
        description: "+50% research gained from quantum allocation.",
        costPower: 300000000,
        costResearch: 1_000_000,
        apply: () => {
            game.quantumResearchBoost *= 1.5;
        },
    },
    {
        id: "research_autodistill",
        category: "research",
        name: "Self-Distilling Papers",
        description: "+80% research/sec.",
        costPower: 8_000_000_000_000,
        costResearch: 220_000_000,
        apply: () => {
            game.researchPerSec *= 1.8;
        },
    },
    {
        id: "research_meta_networks",
        category: "research",
        name: "Meta-Research Networks",
        description: "+120% research/sec.",
        costPower: 40_000_000_000_000,
        costResearch: 600_000_000,
        apply: () => {
            game.researchPerSec *= 2.2;
        },
    },
    {
        id: "research_auto_review",
        category: "research",
        name: "Autonomous Peer Review",
        description: "+200% research/sec.",
        costPower: 180_000_000_000_000,
        costResearch: 2_500_000_000,
        apply: () => {
            game.researchPerSec *= 3;
        },
    },
    {
        id: "research_simulated_universes",
        category: "research",
        name: "Simulated Universes",
        description: "x4 research/sec; boosts quantum research by +50%.",
        costPower: 900_000_000_000_000,
        costResearch: 12_000_000_000,
        apply: () => {
            game.researchPerSec *= 4;
            game.quantumResearchBoost *= 1.5;
        },
    },
    {
        id: "research_ai_codiscovery",
        category: "research",
        name: "AI Co-Discovery",
        description: "+80% AI progress/sec.",
        costPower: 1_500_000_000_000_000,
        costResearch: 18_000_000_000,
        apply: () => {
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.8;
        },
    },
    {
        id: "research_fab_algorithms",
        category: "research",
        name: "Fabrication Algorithms",
        description: "x2 transistors per generator.",
        costPower: 2_500_000_000_000_000,
        costResearch: 25_000_000_000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 2;
        },
    },
    {
        id: "research_quantum_compilers",
        category: "research",
        name: "Quantum Compilers",
        description: "+60% computer power/sec; +1 quantum power.",
        costPower: 4_000_000_000_000_000,
        costResearch: 40_000_000_000,
        apply: () => {
            game.powerPerComputerPerSec *= 1.6;
            game.quantumPower += 1;
        },
    },
    {
        id: "research_recursive_design",
        category: "research",
        name: "Recursive Design Loop",
        description: "+150% AI progress/sec, +25% research/sec.",
        costPower: 9_000_000_000_000_000,
        costResearch: 85_000_000_000,
        apply: () => {
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 2.5;
            game.researchPerSec *= 1.25;
        },
    },

    // AI
    {
        id: "ai_heuristics",
        category: "ai",
        name: "Learning Heuristics",
        description: "+25 AI progress per second.",
        costPower: 200000000,
        costResearch: 150000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) + 25;
        },
    },
    {
        id: "ai_autotuning",
        category: "ai",
        name: "AI Autotuning",
        description: "+60% AI accumulated progress.",
        costPower: 1500000000,
        costResearch: 800000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgress *= 1.6;
        },
    },
    {
        id: "ai_self_rewrite",
        category: "ai",
        name: "Self-Rewriting Logic",
        description: "x2 AI progress.",
        costPower: 50_000_000_000_000,
        costResearch: 10_000_000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgress *= 2;
        },
    },
    {
        id: "ai_profiling",
        category: "ai",
        name: "Inference Profiling",
        description: "+20% AI progress per second.",
        costPower: 500_000_000,
        costResearch: 2_000_000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.2;
        },
    },
    {
        id: "ai_pipelines",
        category: "ai",
        name: "Data Pipelines",
        description: "+15% AI progress/sec and +10% research/sec.",
        costPower: 800_000_000,
        costResearch: 5_000_000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.15;
            game.researchPerSec *= 1.1;
        },
    },
    {
        id: "ai_quantum_inference",
        category: "ai",
        name: "Quantum Inference",
        description: "+50% AI progress per second.",
        costPower: 5_000_000_000,
        costResearch: 20_000_000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.5;
        },
    },
    {
        id: "ai_self_distill",
        category: "ai",
        name: "Self-Distillation",
        description: "+75% AI progress per second.",
        costPower: 20_000_000_000,
        costResearch: 80_000_000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.75;
        },
    },
    {
        id: "ai_auto_sync",
        category: "ai",
        name: "Auto-Sync Curriculum",
        description: "Automates Curriculum Pulse mini-game.",
        costPower: 5_000_000_000,
        costResearch: 12_000_000,
        apply: () => {
            game.aiUnlocked = true;
            logMessage("Curriculum auto-sync online. Pulses trigger automatically.");
        },
    },
    {
        id: "ai_auto_collect",
        category: "ai",
        name: "Auto-Collect Data",
        description: "Automates Synthetic Harvest mini-game.",
        costPower: 7_500_000_000,
        costResearch: 15_000_000,
        apply: () => {
            game.aiUnlocked = true;
            logMessage("Synthetic data collection automated.");
        },
    },
    {
        id: "ai_auto_deploy",
        category: "ai",
        name: "Auto-Deploy Policies",
        description: "Automates Quantum RL Loop mini-game.",
        costPower: 10_000_000_000,
        costResearch: 25_000_000,
        apply: () => {
            game.aiUnlocked = true;
            logMessage("Quantum policies now deploy automatically.");
        },
    },
    {
        id: "ai_auto_validate",
        category: "ai",
        name: "Auto-Validate Alignment",
        description: "Automates Alignment Check mini-game.",
        costPower: 12_000_000_000,
        costResearch: 30_000_000,
        apply: () => {
            game.aiUnlocked = true;
            logMessage("Alignment validation on autopilot.");
        },
    },
    {
        id: "ai_auto_read",
        category: "ai",
        name: "Auto-Read Corpus",
        description: "Automates Reading Burst mini-game.",
        costPower: 9_000_000_000,
        costResearch: 22_000_000,
        apply: () => {
            game.aiUnlocked = true;
            logMessage("Automated corpus reading activated.");
        },
    },

    // Quantum
    {
        id: "qubit_stable",
        category: "quantum",
        name: "Stable Qubits",
        description: "Unlock quantum, add 0.5 quantum power, and boost compute/research.",
        costPower: 8000000000,
        costResearch: 250000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower = Math.max(game.quantumPower, 0.5);
            game.powerPerComputerPerSec *= 1.1;
            game.researchPerSec *= 1.08;
            logMessage("Quantum domain opened. Classical limitations challenged.");
        },
    },
    {
        id: "superposition",
        category: "quantum",
        name: "Superposition",
        description: "+1 quantum power and +15% research/sec.",
        costPower: 250000000000,
        costResearch: 1200000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower += 1;
            game.researchPerSec *= 1.15;
        },
    },
    {
        id: "entanglement",
        category: "quantum",
        name: "Entanglement",
        description: "+3 quantum power and +20% computer power/sec.",
        costPower: 5_000_000_000_000,
        costResearch: 8000000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower += 3;
            game.powerPerComputerPerSec *= 1.2;
        },
    },
    {
        id: "qpu_arch",
        category: "quantum",
        name: "Full Quantum Processing Unit",
        description: "x2 quantum power, +25% research/sec, +25% computer power/sec.",
        costPower: 350_000_000_000_000,
        costResearch: 60_000_000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower *= 2;
            game.researchPerSec *= 1.25;
            game.powerPerComputerPerSec *= 1.25;
            logMessage("Full Quantum Processing engaged. Flux stabilisé, poursuite sans limite.");
        },
    },
    {
        id: "quantum_hypercore",
        category: "quantum",
        name: "Hypercore Qubits",
        description: "x3 quantum power, +30% computer power/sec.",
        costPower: 2_000_000_000_000_000,
        costResearch: 250_000_000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower *= 3;
            game.powerPerComputerPerSec *= 1.3;
        },
    },
    {
        id: "entanglement_mesh",
        category: "quantum",
        name: "Entanglement Mesh",
        description: "x4 quantum power, +40% research/sec.",
        costPower: 9_000_000_000_000_000,
        costResearch: 1_200_000_000,
        apply: () => {
            unlockQuantumWithStarter();
            game.quantumPower *= 4;
            game.researchPerSec *= 1.4;
        },
    },
];

// === Projects ===
const PROJECTS = [
    // Historiques
    {
        id: "tradic",
        name: "TRADIC (1954)",
        description: "Assemble the first transistor-based computer.",
        auto: true,
        requires: game =>
            game.totalTransistorsCreated >= 500 && !game.projectsCompleted.tradic,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.tradic = true;
            if (!game.projectEffectsApplied.tradic) {
                game.transistorsPerGeneratorPerSec *= 1.2;
                game.projectEffectsApplied.tradic = true;
            }
            if (!silent) {
                logMessage("1954 TRADIC assembled.");
                logMessage("Running first program...");
                logMessage("Hello, World!");
            }
        },
    },
    {
        id: "proto_algorithm",
        name: "Primitive Algorithm",
        description: "A crude routine that squeezes more compute from early hardware.",
        auto: false,
        minPhase: PHASES.COMPUTERS,
        costPower: 50_000,
        requires: game =>
            game.computerPower >= 25_000 &&
            game.totalTransistorsCreated >= 20_000 &&
            !game.projectsCompleted.proto_algorithm,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.proto_algorithm = true;
            if (!game.projectEffectsApplied.proto_algorithm) {
                game.powerPerComputerPerSec *= 1.2;
                game.projectEffectsApplied.proto_algorithm = true;
            }
            unlockMiniGame("mg_proto_algo");
            if (!silent) {
                logMessage("Primitive algorithm running. Early compute squeezed harder.");
            }
        },
    },
    {
        id: "tx0",
        name: "TX-0 (MIT)",
        description: "Debugging lights blink to life.",
        auto: true,
        requires: game =>
            game.totalTransistorsCreated >= 5000 && !game.projectsCompleted.tx0,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.tx0 = true;
            if (!game.projectEffectsApplied.tx0) {
                game.powerPerComputerPerSec += 1;
                game.projectEffectsApplied.tx0 = true;
            }
            if (!silent) {
                logMessage("TX-0 operational. Early computing refined.");
            }
        },
    },
    {
        id: "system360",
        name: "IBM System/360",
        description: "Standardize computing architecture.",
        auto: true,
        requires: game =>
            game.computerPower >= 40000 && !game.projectsCompleted.system360,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.system360 = true;
            if (!game.projectEffectsApplied.system360) {
                game.powerPerComputerPerSec *= 1.3;
                game.projectEffectsApplied.system360 = true;
            }
            if (!silent) {
                logMessage("System/360 unified architectures. Compatibility surge.");
            }
        },
    },
    {
        id: "intel_4004",
        name: "Intel 4004",
        description: "First commercial microprocessor.",
        auto: true,
        requires: game =>
            game.research >= 120000 && !game.projectsCompleted.intel_4004,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.intel_4004 = true;
            if (!game.projectEffectsApplied.intel_4004) {
                game.powerPerComputerPerSec *= 1.3;
                game.projectEffectsApplied.intel_4004 = true;
            }
            if (!silent) {
                logMessage("Intel 4004 shipped. Microprocessor era begins.");
            }
        },
    },
    {
        id: "intel_8080",
        name: "Intel 8080",
        description: "Popular 8-bit workhorse.",
        auto: true,
        requires: game =>
            game.research >= 380000 && !game.projectsCompleted.intel_8080,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.intel_8080 = true;
            if (!game.projectEffectsApplied.intel_8080) {
                game.powerPerComputerPerSec *= 1.3;
                game.projectEffectsApplied.intel_8080 = true;
            }
            if (!silent) {
                logMessage("Intel 8080 released. Hobbyists rejoice.");
            }
        },
    },
    {
        id: "intel_8086",
        name: "Intel 8086",
        description: "16-bit architecture with lasting legacy.",
        auto: true,
        requires: game =>
            game.computerPower >= 3500000 && game.research >= 1200000 && !game.projectsCompleted.intel_8086,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.intel_8086 = true;
            if (!game.projectEffectsApplied.intel_8086) {
                game.powerPerComputerPerSec *= 1.4;
                game.projectEffectsApplied.intel_8086 = true;
            }
            if (!silent) {
                logMessage("Intel 8086 architecture propagated. Standards solidify.");
            }
        },
    },
    {
        id: "pentium",
        name: "Pentium",
        description: "Superscalar consumer performance.",
        auto: true,
        requires: game =>
            game.computerPower >= 20000000 &&
            game.research >= 6000000 &&
            !game.projectsCompleted.pentium,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.pentium = true;
            if (!game.projectEffectsApplied.pentium) {
                game.powerPerComputerPerSec *= 1.5;
                game.projectEffectsApplied.pentium = true;
            }
            if (!silent) {
                logMessage("Pentium era. Superscalar pipelines hum.");
            }
        },
    },
    {
        id: "pentium4",
        name: "Pentium 4",
        description: "High clocks and deep pipelines.",
        auto: true,
        minPhase: PHASES.RESEARCH,
        requires: game =>
            game.computerPower >= 80000000 &&
            game.research >= 15000000 &&
            !game.projectsCompleted.pentium4,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.pentium4 = true;
            if (!game.projectEffectsApplied.pentium4) {
                game.powerPerComputerPerSec *= 1.5;
                game.projectEffectsApplied.pentium4 = true;
            }
            if (!silent) {
                logMessage("Pentium 4 pushed clocks. Heat follows ambition.");
            }
        },
    },
    {
        id: "ai_chips_2025",
        name: "AI Chips (2025)",
        description: "Specialized accelerators for AI workloads.",
        auto: true,
        minPhase: PHASES.RESEARCH,
        requires: game =>
            game.computerPower >= 300000000 &&
            game.research >= 60000000 &&
            !game.projectsCompleted.ai_chips_2025,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.ai_chips_2025 = true;
            if (!game.projectEffectsApplied.ai_chips_2025) {
                game.powerPerComputerPerSec *= 2;
                game.projectEffectsApplied.ai_chips_2025 = true;
            }
            if (!silent) {
                logMessage("AI accelerators surge. Models scale effortlessly.");
            }
        },
    },

    // IA (perceptron retiré, l'IA se débloque plus tard via seuils/upgrade dédiés)
    {
        id: "ai_backprop",
        name: "Backpropagation",
        description: "Training deeper networks efficiently.",
        auto: false,
        minPhase: 2,
        costResearch: 60000,
        requires: game =>
            game.research >= 60000 &&
            !game.projectsCompleted["ai_backprop"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["ai_backprop"] = true;
            if (!game.projectEffectsApplied.ai_backprop) {
                game.aiUnlocked = true;
                game.aiProgress += 50;
                game.researchPerSec *= 1.1;
                game.projectEffectsApplied.ai_backprop = true;
            }
            if (!silent) {
                logMessage("Backpropagation perfected. Gradients flow.");
            }
        },
    },
    {
        id: "ai_cnn",
        name: "Convolutional Nets",
        description: "Pattern extraction at scale.",
        auto: false,
        minPhase: 2,
        costResearch: 350000,
        requires: game =>
            game.research >= 350000 && game.projectsCompleted["ai_backprop"] && !game.projectsCompleted["ai_cnn"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["ai_cnn"] = true;
            if (!game.projectEffectsApplied.ai_cnn) {
                game.aiUnlocked = true;
                game.aiProgress += 200;
                game.researchPerSec *= 1.15;
                game.projectEffectsApplied.ai_cnn = true;
            }
            if (!silent) {
                logMessage("CNNs decode images. Vision unlocked.");
            }
        },
    },
    {
        id: "ai_transformers",
        name: "Transformers",
        description: "Sequence modeling revolution.",
        auto: false,
        minPhase: PHASES.AI,
        costResearch: 2000000,
        requires: game =>
            game.research >= 2000000 && game.projectsCompleted["ai_cnn"] && !game.projectsCompleted["ai_transformers"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["ai_transformers"] = true;
            if (!game.projectEffectsApplied.ai_transformers) {
                game.aiUnlocked = true;
                game.aiProgress += 1000;
                game.researchPerSec *= 1.2;
                game.quantumPower += 0.3;
                game.projectEffectsApplied.ai_transformers = true;
            }
            if (!silent) {
                logMessage("Transformers reshape understanding. Attention dominates.");
            }
        },
    },
    {
        id: "ai_foundation",
        name: "Foundation Model",
        description: "General-purpose AI capabilities emerge.",
        auto: false,
        minPhase: PHASES.AI,
        costResearch: 12000000,
        requires: game =>
            game.research >= 12000000 &&
            game.projectsCompleted["ai_transformers"] &&
            !game.projectsCompleted["ai_foundation"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["ai_foundation"] = true;
            if (!game.projectEffectsApplied.ai_foundation) {
                game.aiUnlocked = true;
                game.aiProgress += 5000;
                game.researchPerSec *= 1.25;
                game.quantumPower += 0.5;
                game.projectEffectsApplied.ai_foundation = true;
            }
            if (!silent) {
                logMessage("Foundation model online. Capabilities generalize.");
            }
        },
    },

    // Quantum
    {
        id: "qubit_research",
        name: "Qubit Research",
        description: "Begin exploring quantum states.",
        auto: false,
        costResearch: 150000,
        requires: game =>
            game.research >= 150000 && !game.projectsCompleted["qubit_research"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["qubit_research"] = true;
            if (!game.projectEffectsApplied.qubit_research) {
                unlockQuantumWithStarter();
                game.quantumPower = Math.max(game.quantumPower, 0.1);
                game.projectEffectsApplied.qubit_research = true;
            }
            if (!silent) {
                logMessage("Quantum states observed. Stability is... relative.");
            }
        },
    },
    {
        id: "quantum_gates_project",
        name: "Quantum Gates",
        description: "Implement basic quantum gate operations.",
        auto: false,
        costResearch: 500000,
        requires: game =>
            game.research >= 500000 &&
            game.projectsCompleted["qubit_research"] &&
            !game.projectsCompleted["quantum_gates_project"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["quantum_gates_project"] = true;
            if (!game.projectEffectsApplied.quantum_gates_project) {
                game.quantumPower += 0.3;
                game.researchPerSec *= 1.05;
                game.projectEffectsApplied.quantum_gates_project = true;
            }
            if (!silent) {
                logMessage("Quantum gates stabilized. Superposition harnessed.");
            }
        },
    },
    {
        id: "entanglement_theory",
        name: "Entanglement Theory",
        description: "Non-local effects become reliable.",
        auto: false,
        costResearch: 2000000,
        requires: game =>
            game.research >= 2000000 &&
            game.projectsCompleted["quantum_gates_project"] &&
            !game.projectsCompleted["entanglement_theory"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["entanglement_theory"] = true;
            if (!game.projectEffectsApplied.entanglement_theory) {
                game.quantumPower += 0.7;
                game.researchPerSec *= 1.1;
                game.projectEffectsApplied.entanglement_theory = true;
            }
            if (!silent) {
                logMessage("Entanglement arrays online. Non-local effects magnified.");
            }
        },
    },
    {
        id: "quantum_supremacy_project",
        name: "Quantum Supremacy",
        description: "Outperform classical computation at scale.",
        auto: false,
        minPhase: PHASES.QUANTUM,
        costResearch: 5000000,
        requires: game =>
            game.research >= 5000000 &&
            game.projectsCompleted["entanglement_theory"] &&
            !game.projectsCompleted["quantum_supremacy_project"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["quantum_supremacy_project"] = true;
            if (!game.projectEffectsApplied.quantum_supremacy_project) {
                game.quantumPower += 1;
                game.powerPerComputerPerSec *= 1.1;
                game.researchPerSec *= 1.15;
                game.projectEffectsApplied.quantum_supremacy_project = true;
            }
            if (!silent) {
                logMessage("Quantum supremacy achieved. Classical era eclipsed.");
            }
        },
    },

    // TODO: Future mini-game unlock
    // {
    //     id: "market_simulation",
    //     name: "Market Simulation",
    //     description: "Unlocks a financial mini-game to optimize resource flows.",
    //     auto: false,
    //     minPhase: PHASES.RESEARCH,
    //     costResearch: 750000,
    //     costPower: 1500000,
    //     requires: game => false, // TODO: wire later
    //     onComplete: (game, { silent } = {}) => {
    //         // TODO: hook mini-game unlock here
    //     },
    // },
    // {
    //     id: "ai_model_strategy",
    //     name: "Model Strategy Workshop",
    //     description: "Unlocks an AI design/tuning mini-game.",
    //     auto: false,
    //     minPhase: PHASES.AI,
    //     costResearch: 4000000,
    //     costPower: 6000000,
    //     requires: game => false, // TODO: wire later
    //     onComplete: (game, { silent } = {}) => {
    //         // TODO: hook mini-game unlock here
    //     },
    // },
    {
        id: "universe_exploration",
        name: "Universe Exploration",
        description: "Opens deep-space exploration and resource scanning.",
        auto: false,
        minPhase: PHASES.QUANTUM,
        costResearch: 20_000_000,
        costPower: 5_000_000_000_000,
        requires: game =>
            game.quantumUnlocked &&
            game.quantumPower >= EXPLORATION_UNLOCK_QUANTUM_THRESHOLD &&
            game.research >= EXPLORATION_UNLOCK_RESEARCH_THRESHOLD &&
            !game.projectsCompleted["universe_exploration"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["universe_exploration"] = true;
            if (!game.projectEffectsApplied.universe_exploration) {
                game.explorationUnlocked = true;
                game.explorationSignals = Math.max(game.explorationSignals, 100);
                game.researchPerSec *= 1.05;
                game.projectEffectsApplied.universe_exploration = true;
            }
            if (!silent) {
                logMessage("Deep-space exploration authorized. Scanners deployed.");
            }
        },
    },
    {
        id: "helium3_refinery",
        name: "Helium-3 Refinery",
        description: "Route lunar He-3 into fabs. x3 generator transistor output.",
        auto: false,
        minPhase: PHASES.COMPUTERS,
        costPower: 50_000_000_000,
        costResearch: 200_000_000,
        requires: game =>
            game.computerPower >= 10_000_000_000 &&
            game.research >= 50_000_000 &&
            !game.projectsCompleted.helium3_refinery,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.helium3_refinery = true;
            if (!game.projectEffectsApplied.helium3_refinery) {
                game.transistorsPerGeneratorPerSec *= 3;
                game.projectEffectsApplied.helium3_refinery = true;
            }
            if (!silent) {
                logMessage("Helium-3 refined. Fabrication lines surge.");
            }
        },
    },
    {
        id: "dyson_node",
        name: "Dyson Node",
        description: "Dyson swarm sub-node. x2 computer power/sec, +2 quantum power.",
        auto: false,
        minPhase: PHASES.QUANTUM,
        costPower: 20_000_000_000_000,
        costResearch: 1_500_000_000,
        requires: game =>
            game.quantumUnlocked &&
            game.computerPower >= 1_000_000_000_000 &&
            game.research >= 750_000_000 &&
            !game.projectsCompleted.dyson_node,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.dyson_node = true;
            if (!game.projectEffectsApplied.dyson_node) {
                game.powerPerComputerPerSec *= 2;
                game.quantumPower += 2;
                game.projectEffectsApplied.dyson_node = true;
            }
            if (!silent) {
                logMessage("Dyson node online. Stellar compute streaming.");
            }
        },
    },
    {
        id: "simulation_layer",
        name: "Simulation Layer",
        description: "Full-stack simulators. x2 research/sec, +25% transistors per click.",
        auto: false,
        minPhase: PHASES.AI,
        costPower: 8_000_000_000_000,
        costResearch: 4_500_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.research >= 2_000_000_000 &&
            game.computerPower >= 2_000_000_000_000 &&
            !game.projectsCompleted.simulation_layer,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.simulation_layer = true;
            if (!game.projectEffectsApplied.simulation_layer) {
                game.researchPerSec *= 2;
                game.transistorsPerClick *= 1.25;
                game.projectEffectsApplied.simulation_layer = true;
            }
            if (!silent) {
                logMessage("Simulation layer deployed. Virtual pipelines accelerate discovery.");
            }
        },
    },
];

// === AI Projects (AI currency) ===
const AI_PROJECTS = [
    {
        id: "ai_curriculum",
        name: "Curriculum Learning",
        description: "+25% AI progress per second.",
        costAI: 10_000,
        costPower: 5_000_000,
        requires: game => game.aiUnlocked && game.aiProgress >= 5_000,
        onComplete: (game, { silent, forceUI } = {}) => {
            // Apply effect once, but always rebuild UI/log appropriately.
            if (!game.aiProjectEffectsApplied.ai_curriculum) {
                game.aiProjectEffectsApplied.ai_curriculum = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.35;
            }
            game.aiProjectsCompleted.ai_curriculum = true;
            unlockMiniGame("mg_curriculum");
            if (!silent) {
                logMessage("AI curriculum designed. Models learn more efficiently.");
            }
        },
    },
    {
        id: "ai_synthetic_data",
        name: "Synthetic Data Lab",
        description: "+15% AI progress/sec, +10% research/sec.",
        costAI: 50_000,
        costPower: 20_000_000,
        costResearch: 5_000_000,
        requires: game => game.aiUnlocked && game.researchUnlocked && game.aiProgress >= 20_000,
        onComplete: (game, { silent, forceUI } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_synthetic_data) {
                game.aiProjectEffectsApplied.ai_synthetic_data = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.3;
                game.researchPerSec *= 1.2;
            }
            game.aiProjectsCompleted.ai_synthetic_data = true;
            unlockMiniGame("mg_synth_harvest");
            if (!silent) {
                logMessage("Synthetic data pipeline online. Experiment velocity increased.");
            }
        },
    },
    {
        id: "ai_quantum_rl",
        name: "Quantum RL",
        description: "+60% AI progress/sec; unlocks Quantum RL mini-panel.",
        costAI: 200_000,
        costPower: 150_000_000,
        costResearch: 25_000_000,
        requires: game => game.quantumUnlocked && game.aiProgress >= 80_000,
        onComplete: (game, { silent, forceUI } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_quantum_rl) {
                game.aiProjectEffectsApplied.ai_quantum_rl = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.6;
            }
            game.aiProjectsCompleted.ai_quantum_rl = true;
            unlockMiniGame("mg_quantum_rl");
            if (!silent) {
                logMessage("Quantum RL deployed. Policy search accelerated.");
            }
        },
    },
    {
        id: "ai_alignment",
        name: "AI Alignment Lab",
        description: "+20% AI progress/sec; unlocks Alignment Check mini-game.",
        costAI: 150_000,
        costPower: 120_000_000,
        costResearch: 30_000_000,
        requires: game => game.aiUnlocked && game.researchUnlocked && game.aiProgress >= 60_000,
        onComplete: (game, { silent } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_alignment) {
                game.aiProjectEffectsApplied.ai_alignment = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.2;
            }
            game.aiProjectsCompleted.ai_alignment = true;
            unlockMiniGame("mg_alignment");
            if (!silent) {
                logMessage("Alignment Lab online. Safety protocols enriched.");
            }
        },
    },
    {
        id: "ai_reading",
        name: "Cognitive Reader",
        description: "+30% research/sec; unlocks Reading Burst mini-game.",
        costAI: 300_000,
        costPower: 200_000_000,
        costResearch: 60_000_000,
        requires: game => game.aiUnlocked && game.researchUnlocked && game.aiProgress >= 120_000,
        onComplete: (game, { silent } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_reading) {
                game.aiProjectEffectsApplied.ai_reading = true;
                game.researchPerSec *= 1.3;
            }
            game.aiProjectsCompleted.ai_reading = true;
            unlockMiniGame("mg_reading");
            if (!silent) {
                logMessage("Cognitive Reader deployed. Comprehension enhanced.");
            }
        },
    },
    {
        id: "ai_overclock",
        name: "AI Overclock",
        description: "+50% computer power/sec.",
        costAI: 75_000,
        costPower: 100_000_000,
        requires: game => game.aiUnlocked && game.aiProgress >= 80_000,
        onComplete: (game, { silent } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_overclock) {
                game.aiProjectEffectsApplied.ai_overclock = true;
                game.powerPerComputerPerSec *= 1.5;
            }
            game.aiProjectsCompleted.ai_overclock = true;
            if (!silent) {
                logMessage("AI overclock engaged. Classical compute surges.");
            }
        },
    },
    {
        id: "ai_research_synthesis",
        name: "AI Research Synthesis",
        description: "+60% research/sec.",
        costAI: 120_000,
        costPower: 250_000_000,
        costResearch: 20_000_000,
        requires: game => game.aiUnlocked && game.researchUnlocked && game.aiProgress >= 120_000,
        onComplete: (game, { silent } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_research_synthesis) {
                game.aiProjectEffectsApplied.ai_research_synthesis = true;
                game.researchPerSec *= 1.6;
            }
            game.aiProjectsCompleted.ai_research_synthesis = true;
            if (!silent) {
                logMessage("AI synthesizes research pipelines. Throughput spikes.");
            }
        },
    },
    {
        id: "ai_fab_overwatch",
        name: "AI Fab Overwatch",
        description: "x1.7 transistors per generator.",
        costAI: 180_000,
        costPower: 400_000_000,
        costResearch: 50_000_000,
        requires: game => game.aiUnlocked && game.researchUnlocked && game.aiProgress >= 180_000,
        onComplete: (game, { silent } = {}) => {
            if (!game.aiProjectEffectsApplied.ai_fab_overwatch) {
                game.aiProjectEffectsApplied.ai_fab_overwatch = true;
                game.transistorsPerGeneratorPerSec *= 1.7;
            }
            game.aiProjectsCompleted.ai_fab_overwatch = true;
            if (!silent) {
                logMessage("AI overwatches fabs. Transistor output stabilized and boosted.");
            }
        },
    },
];

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

function applyExplorationReward(reward) {
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

function getExplorationMultiplier(now = nowMs()) {
    let mult = game.expoFactor || 1;
    if (now < game.flags.iaOverdriveEndTime) {
        mult *= IA_OVERDRIVE_BONUS;
    }
    if (game.flags.iaEmergenceAccepted && now < game.flags.iaDebuffEndTime) {
        mult *= IA_DEBUFF_CHARGE_MULT; // reduce exploration gain during debuff
    }
    return mult;
}

function performHyperScan() {
    if (!game.explorationUnlocked) return;
    if (game.universeExploredPercent < IA_HYPER_UNLOCK_PERCENT) return;
    const aiCost = IA_SCAN_AI_BASE * IA_HYPER_COST_MULT * Math.pow(IA_SCAN_AI_GROWTH, game.scanCount);
    const chargeCost =
        IA_SCAN_CHARGE_BASE * IA_HYPER_COST_MULT * Math.pow(IA_SCAN_CHARGE_GROWTH, game.scanCount);
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
    const mult = getExplorationMultiplier();
    game.universeExploredPercent += baseDelta * IA_HYPER_MULT * mult;
    const reward = EXPLORATION_REWARD_TABLE[Math.floor(Math.random() * EXPLORATION_REWARD_TABLE.length)];
    applyExplorationReward(reward);
    logMessage(`Hyper scan complete: ${reward.label}.`);
}

function performQuantumSurge(now = nowMs()) {
    if (!game.explorationUnlocked) return;
    if (game.quantumComputers < 1) return;
    game.quantumComputers -= 1;
    game.flags.iaOverdriveEndTime = now + IA_OVERDRIVE_DURATION_MS;
    logMessage("Quantum surge initiated. Exploration boosted.");
}

function performExplorationScan() {
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
    const mult = getExplorationMultiplier();
    game.universeExploredPercent += deltaPercent * mult;
    const reward = EXPLORATION_REWARD_TABLE[Math.floor(Math.random() * EXPLORATION_REWARD_TABLE.length)];
    applyExplorationReward(reward);
    logMessage(`Sector scanned: ${reward.label}.`);
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

// NEW: quantum computer cost helper
function getQuantumComputerCost() {
    return Math.floor(
        game.quantumComputerBaseCost *
        Math.pow(game.quantumComputerCostMultiplier, game.quantumComputers)
    );
}

function getComputerPowerMultiplier() {
    const qp = Math.max(0, game.quantumPower);
    return 1 + 0.22 * Math.sqrt(qp);
}

function canUnlockAI(game) {
    return (
        game.researchUnlocked &&
        game.computerPower >= AI_COMPUTE_UNLOCK_THRESHOLD &&
        game.research >= AI_RESEARCH_UNLOCK_THRESHOLD
    );
}

// Dynamic late-game boost for generators driven by quantum & AI progress.
function getGeneratorOutputMultiplier() {
    const quantumBoost = 1 + LATE_TRANSISTOR_QUANTUM_FACTOR * Math.sqrt(Math.max(0, game.quantumPower));
    const aiBoost = 1 + 0.25 * Math.sqrt(Math.max(0, game.aiProgress) / 1_000_000);
    const exploreBoost = 1 + (game.explorationBonuses?.compute || 0);
    const curriculum = getCurriculumMultipliers().transistors;
    const buff = getActiveBuffMultipliers();
    return Math.max(1, quantumBoost * aiBoost * exploreBoost * curriculum * (buff.generators || 1));
}

// NEW: helper to compute current computer power generation per second
function getComputerPowerPerSec() {
    const aiModeBoost = game.aiMode === "deployed" ? 1.1 : 1;
    const exploreBoost = 1 + (game.explorationBonuses?.compute || 0);
    const protoBoost = game.protoAlgoMultiplier || 1;
    const curriculum = getCurriculumMultipliers().compute;
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

// NEW: ensure quantum is unlocked and grant a starter quantum computer
function unlockQuantumWithStarter() {
    game.quantumUnlocked = true;
    if (game.quantumComputers < 1) {
        game.quantumComputers = 1;
    }
}

function isUpgradeVisible(up, game) {
    if (game.upgradesBought[up.id]) return false;

    const phase = getGamePhase(game);
    const allowedByPhase = {
        [PHASES.PRODUCTION]: ["transistors"],
        [PHASES.COMPUTERS]: ["transistors", "computers"],
        [PHASES.RESEARCH]: ["transistors", "computers", "research"],
        [PHASES.AI]: ["transistors", "computers", "research", "ai"],
        [PHASES.QUANTUM]: ["transistors", "computers", "research", "ai", "quantum"],
    };

    if (!allowedByPhase[phase].includes(up.category)) return false;

    if (up.category === "research") {
        if (!game.researchUnlocked && game.computerPower < RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD) {
            return false;
        }
    }
    if (up.category === "ai") {
        if (!canUnlockAI(game)) {
            return false;
        }
        // Perceptron retiré : débloquer via seuils + projets/upgrade IA
    }
    if (up.category === "quantum") {
        if (!game.quantumUnlocked && (!game.researchUnlocked || game.research < QUANTUM_RESEARCH_UNLOCK_THRESHOLD)) {
            return false;
        }
    }

    return true;
}

function getEffectiveProjectCosts(project) {
    const mult = getActiveBuffMultipliers().projectCost;
    const costResearch = project.costResearch ? Math.ceil(project.costResearch * mult) : 0;
    const costPower = project.costPower ? Math.ceil(project.costPower * mult) : 0;
    const costAI = project.costAI ? Math.ceil(project.costAI * mult) : 0;
    return { costResearch, costPower, costAI };
}

function isProjectVisible(project, game) {
    const completed = !!game.projectsCompleted[project.id];
    if (completed) return false;
    if (project.auto) {
        return false;
    }
    if (project.minPhase != null && game.phase < project.minPhase) {
        return false;
    }
    // Projects remain hidden until the research phase is active.
    if (game.phase < PHASES.RESEARCH) {
        return false;
    }
    if (project.requires(game)) {
        return true;
    }
    const { costResearch, costPower } = getEffectiveProjectCosts(project);
    const nearResearch =
        costResearch === 0 || game.research >= costResearch / PROJECT_VISIBILITY_COST_FACTOR;
    const nearPower =
        costPower === 0 || game.computerPower >= costPower / PROJECT_VISIBILITY_COST_FACTOR;
    return nearResearch && nearPower;
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
// Phase 4 - Quantum
//   - Quantum is unlocked via projects/upgrades and/or thresholds on compute + research.
//   - quantumPower acts as a multiplier on computerPower generation (late game scaling).
//   - Quantum projects and upgrades boost quantumPower, research and compute.
function gameTick() {
    // Allow bypassing the end-state for late-game testing when enabled.
    if (game.flags.gameEnded && !DEBUG_IGNORE_ENDGAME) {
        return;
    }

    const now = nowMs();
    const baseDeltaSec = (now - game.lastTick) / 1000;
    game.lastTick = now;
    const deltaSec = baseDeltaSec * DEBUG_TIME_SCALE * GAME_SPEED_MULTIPLIER;
    const buff = getActiveBuffMultipliers(now);

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
            logMessage("[197x] Computation repurposed for R&D.");
            logMessage("Research module online.");
        }
    }

    let quantumResearchOutput = 0;
    if (game.researchUnlocked && game.researchPerSec > 0) {
        const exploreResearchBoost = 1 + (game.explorationBonuses?.research || 0);
        const curriculumResearch = getCurriculumMultipliers().research;
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
        let aiGainMult = getCurriculumMultipliers().ai;
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
        iaChargePerSec *= getCurriculumMultipliers().iaCharge;
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
    const curriculumExplore = getCurriculumMultipliers().exploration;
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
        logMessage("Deep space scanners online. Exploration unlocked.");
    }

    if (game.flags.iaCapped && game.universeExploredPercent > 100) {
        game.universeExploredPercent = 100;
    }

    maybeTriggerIAEmergence(now);
    maybeFinishIADebuff(now);

    updateProjectsAuto();
    updateMiniGames(now);
    maybeOfferEmergence();
    maybeTriggerEndGame();

    // TODO: quantum/AI progression
    // TODO: hook mini-game updates here (when implemented).

    checkMilestones();
    renderAll();
}

function completeProject(id, { silent } = {}) {
    const project = PROJECTS.find(p => p.id === id);
    if (!project) return;
    if (game.projectsCompleted[id]) return;
    if (!project.requires(game)) return;

    const { costResearch, costPower } = getEffectiveProjectCosts(project);
    if (costResearch && game.research < costResearch) return;
    if (costPower && game.computerPower < costPower) return;

    if (costResearch) {
        game.research -= costResearch;
    }
    if (costPower) {
        game.computerPower -= costPower;
    }

    game.projectsCompleted[id] = true;
    project.onComplete(game, { silent });
}

function reapplyCompletedProjects({ silent } = {}) {
    PROJECTS.forEach(project => {
        if (!game.projectsCompleted[project.id]) return;
        project.onComplete(game, { silent, forceUI: true });
    });
    // Rebuild any mini-game panels for completed projects.
    MINI_GAMES.forEach(cfg => {
        if (game.projectsCompleted[cfg.projectId]) {
            unlockMiniGame(cfg.id);
        }
    });
}

function reapplyCompletedAIProjects({ silent } = {}) {
    AI_PROJECTS.forEach(project => {
        if (!game.aiProjectsCompleted[project.id]) return;
        // Always re-run completion to rebuild UI; internal guards prevent double-applying effects.
        project.onComplete(game, { silent, forceUI: true });
    });
}

function clearMiniGamesUI() {
    document.querySelectorAll(".mini-game-card").forEach(card => card.remove());
    const container = document.getElementById("mini-games-container");
    if (container) container.innerHTML = "";
}

function updateProjectsAuto() {
    PROJECTS.forEach(project => {
        if (!project.auto) return;
        if (game.projectsCompleted[project.id]) return;
        if (!project.requires(game)) return;
        completeProject(project.id, { silent: false });
    });
}

function hasPendingAIProjects() {
    return AI_PROJECTS.some(p => !game.aiProjectsCompleted[p.id]);
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

function buyAIProject(id) {
    const project = AI_PROJECTS.find(p => p.id === id);
    if (!project) return;
    if (game.aiProjectsCompleted[project.id]) return;
    if (!project.requires(game)) return;

    const { costAI, costPower, costResearch } = getEffectiveProjectCosts(project);
    if (costAI && game.aiProgress < costAI) return;
    if (costPower && game.computerPower < costPower) return;
    if (costResearch && game.research < costResearch) return;

    if (costAI) game.aiProgress -= costAI;
    if (costPower) game.computerPower -= costPower;
    if (costResearch) game.research -= costResearch;

    project.onComplete(game, { silent: false });
    renderAll();
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

function buyUpgrade(id) {
    if (game.upgradesBought[id]) return;

    const up = UPGRADES.find(u => u.id === id);
    if (!up) return;

    if (game.computerPower < up.costPower) return;
    if (up.costResearch && game.research < up.costResearch) return;
    if (up.category === "ai") {
        if (!game.researchUnlocked) return;
        // Perceptron retiré; no early AI project gate here
    }

    const researchWasUnlocked = game.researchUnlocked;
    game.computerPower -= up.costPower;
    if (up.costResearch) {
        game.research -= up.costResearch;
    }
    game.upgradesBought[id] = true;
    up.apply();

    if (up.category === "research" && !researchWasUnlocked && game.researchUnlocked) {
        logMessage("Research lab activated. New insights possible.");
    }

    renderAll();
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
    const showAIProjects = game.aiUnlocked && hasPendingAIProjects();
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
    toggleElement("panel-ai-projects", showAIProjects);
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

function updateUpgradeButtonsState(container, payload) {
    if (!container) return;
    payload.forEach(({ upgrades }) => {
        upgrades.forEach(up => {
            const btn = container.querySelector(`button[data-upgrade-id="${up.id}"]`);
            if (!btn) return;
            const bought = !!game.upgradesBought[up.id];
            const needPower = game.computerPower < up.costPower;
            const needResearch = up.costResearch ? game.research < up.costResearch : false;
            btn.disabled = bought || needPower || needResearch;
            btn.textContent = bought ? "Purchased" : "Buy";
        });
    });
}

function renderUpgrades() {
    const container = document.getElementById("upgrades-list");
    const quantumContainer = document.getElementById("quantum-upgrades-list");
    if (!container) return;

    const buildPayload = categories => {
        const out = [];
        categories.forEach(category => {
            const available = UPGRADES
                .filter(up => up.category === category)
                .filter(up => isUpgradeVisible(up, game))
                .sort((a, b) => a.costPower - b.costPower);

            if (available.length === 0) {
                return;
            }

            const affordable = available.filter(up => up.costPower <= game.computerPower);
            let filtered = [];

            if (affordable.length > 0) {
                const cheapestAffordableCost = affordable[0].costPower;
                const threshold = cheapestAffordableCost * UPGRADE_VISIBILITY_COST_FACTOR;
                filtered = available.filter(up => up.costPower <= threshold);
            } else {
                filtered = available.slice(0, MAX_VISIBLE_UPGRADES_PER_CATEGORY);
            }

            // Only one upgrade is displayed per category at a time.
            const visible = filtered.slice(0, 1); // UPDATED: show a single upgrade per category
            if (visible.length > 0) {
                out.push({ category, upgrades: visible });
            }
        });
        return out;
    };

    const mainCategories = ["transistors", "computers", "research", "ai"];
    const quantumCategories = ["quantum"];

    const mainPayload = buildPayload(mainCategories);
    const quantumPayload = buildPayload(quantumCategories);

    const mainStateKey = mainPayload
        .map(group => `${group.category}:${group.upgrades.map(u => u.id).join(",")}`)
        .join("|");
    const quantumStateKey = quantumPayload
        .map(group => `${group.category}:${group.upgrades.map(u => u.id).join(",")}`)
        .join("|");

    // Main upgrades rendering
    if (mainStateKey === lastRenderedUpgradesKey) {
        updateUpgradeButtonsState(container, mainPayload);
    } else {
        lastRenderedUpgradesKey = mainStateKey;
        container.innerHTML = "";

        mainPayload.forEach(({ category, upgrades }) => {
            const catTitle = document.createElement("h3");
            catTitle.textContent = category.toUpperCase();
            catTitle.className = "upgrade-category-title";
            container.appendChild(catTitle);

            upgrades.forEach(up => {
                const div = document.createElement("div");
                div.className = "upgrade";
                div.dataset.upgradeId = up.id;

                const h4 = document.createElement("h4");
                h4.textContent = up.name;
                div.appendChild(h4);

                const desc = document.createElement("p");
                desc.textContent = up.description;
                div.appendChild(desc);

                const cost = document.createElement("p");
                const costParts = [`${formatNumberCompact(up.costPower)} computer power`];
                if (up.costResearch) {
                    costParts.push(`${formatNumberCompact(up.costResearch)} research`);
                }
                cost.innerHTML = `<strong>Cost:</strong> ${costParts.join(" + ")}`;
                div.appendChild(cost);

                const btn = document.createElement("button");
                btn.textContent = game.upgradesBought[up.id] ? "Purchased" : "Buy";
                const needPower = game.computerPower < up.costPower;
                const needResearch = up.costResearch ? game.research < up.costResearch : false;
                btn.disabled = needPower || needResearch || game.upgradesBought[up.id];
                btn.dataset.upgradeId = up.id;
                btn.addEventListener("click", () => buyUpgrade(up.id));
                div.appendChild(btn);

                container.appendChild(div);
            });
        });
    }

    // Quantum upgrades rendering into dedicated panel
    if (quantumContainer) {
        if (quantumStateKey === lastRenderedQuantumUpgradesKey) {
            updateUpgradeButtonsState(quantumContainer, quantumPayload);
        } else {
            lastRenderedQuantumUpgradesKey = quantumStateKey;
            quantumContainer.innerHTML = "";

            quantumPayload.forEach(({ category, upgrades }) => {
                const catTitle = document.createElement("h3");
                catTitle.textContent = category.toUpperCase();
                catTitle.className = "upgrade-category-title";
                quantumContainer.appendChild(catTitle);

                upgrades.forEach(up => {
                    const div = document.createElement("div");
                    div.className = "upgrade";
                    div.dataset.upgradeId = up.id;

                    const h4 = document.createElement("h4");
                    h4.textContent = up.name;
                    div.appendChild(h4);

                const desc = document.createElement("p");
                desc.textContent = up.description;
                div.appendChild(desc);

                const cost = document.createElement("p");
                const costParts = [`${formatNumberCompact(up.costPower)} computer power`];
                if (up.costResearch) {
                    costParts.push(`${formatNumberCompact(up.costResearch)} research`);
                }
                cost.innerHTML = `<strong>Cost:</strong> ${costParts.join(" + ")}`;
                div.appendChild(cost);

                const btn = document.createElement("button");
                btn.textContent = game.upgradesBought[up.id] ? "Purchased" : "Buy";
                const needPower = game.computerPower < up.costPower;
                const needResearch = up.costResearch ? game.research < up.costResearch : false;
                btn.disabled = needPower || needResearch || game.upgradesBought[up.id];
                btn.dataset.upgradeId = up.id;
                btn.addEventListener("click", () => buyUpgrade(up.id));
                div.appendChild(btn);

                    quantumContainer.appendChild(div);
                });
            });
        }
    }
}

function updateProjectEntriesState(container, projects) {
    projects.forEach(project => {
        const entry = container.querySelector(`[data-project-id="${project.id}"]`);
        if (!entry) return;

        const title = entry.querySelector(".project-title");
        const statusEl = entry.querySelector(".project-status");
        const btn = entry.querySelector("button[data-project-id]");

        if (title) {
            title.textContent = `${project.name}${project.completed ? " (Completed)" : ""}`;
        }
        if (statusEl) {
            statusEl.textContent = project.statusText;
        }
        if (btn) {
            btn.textContent = project.buttonText;
            btn.disabled = project.buttonDisabled;
        }
    });
}

function renderProjects() {
    const container = document.getElementById("projects-list");
    if (!container) return;

    const isAffordable = project => {
        const { costResearch, costPower } = getEffectiveProjectCosts(project);
        const enoughResearch = !costResearch || game.research >= costResearch;
        const enoughPower = !costPower || game.computerPower >= costPower;
        return enoughResearch && enoughPower;
    };

    const projectCostScore = project => {
        const { costResearch, costPower } = getEffectiveProjectCosts(project);
        const research = costResearch || 0;
        const power = costPower || 0;
        return research + power;
    };

    const payload = [];

    const visibleProjects = PROJECTS.filter(project => isProjectVisible(project, game));
    const sortedByCost = [...visibleProjects].sort((a, b) => projectCostScore(a) - projectCostScore(b));

    const affordable = sortedByCost.filter(isAffordable);
    // Always show exactly one project from the visible list: the cheapest affordable one, or the cheapest visible overall.
    let chosenProject = affordable.length > 0 ? affordable[0] : sortedByCost[0];

    // Fallback: if nothing is visible, still show the cheapest eligible project in research phase.
    if (!chosenProject && game.phase >= PHASES.RESEARCH) {
        const fallbackCandidates = PROJECTS.filter(
            p =>
                !game.projectsCompleted[p.id] &&
                !p.auto &&
                (p.minPhase == null || game.phase >= p.minPhase)
        ).sort((a, b) => projectCostScore(a) - projectCostScore(b));
        chosenProject = fallbackCandidates[0];
    }

    if (chosenProject) {
        const project = chosenProject;
        const completed = !!game.projectsCompleted[project.id];
        const meetsReq = project.requires(game);
        const { costResearch, costPower } = getEffectiveProjectCosts(project);
        const hasCost = (costResearch ? game.research >= costResearch : true) &&
            (costPower ? game.computerPower >= costPower : true);
        const canRun = meetsReq && hasCost;

        const statusText = project.auto
            ? completed
                ? "Auto-completed."
                : "Pending (auto when requirements met)."
            : completed
                ? "Completed."
                : meetsReq
                    ? hasCost ? "Ready to run." : "Not enough resources."
                    : "Not ready yet.";

        const buttonText = completed ? "Done" : "Run";
        const buttonDisabled = project.auto || completed || !canRun;

        payload.push({
            id: project.id,
            name: project.name,
            description: project.description,
            costResearch,
            costPower,
            auto: project.auto,
            completed,
            statusText,
            buttonText,
            buttonDisabled,
        });
    }

    const stateKey = payload.map(p => p.id).join("|");

    if (stateKey === lastRenderedProjectsKey) {
        updateProjectEntriesState(container, payload);
        return;
    }

    lastRenderedProjectsKey = stateKey;
    container.innerHTML = "";

    payload.forEach(project => {
        const entry = document.createElement("div");
        entry.className = "upgrade";
        entry.dataset.projectId = project.id;

        const title = document.createElement("h3");
        title.className = "project-title";
        title.textContent = `${project.name}${project.completed ? " (Completed)" : ""}`;
        entry.appendChild(title);

        const desc = document.createElement("p");
        desc.textContent = project.description;
        entry.appendChild(desc);

        if (project.costResearch || project.costPower) {
            const costLine = document.createElement("p");
            costLine.innerHTML = [
                project.costResearch ? `<strong>Cost:</strong> ${formatNumberCompact(project.costResearch)} research` : "",
                project.costPower ? `<strong>Cost:</strong> ${formatNumberCompact(project.costPower)} computer power` : "",
            ]
                .filter(Boolean)
                .join(" | ");
            entry.appendChild(costLine);
        }

        const status = document.createElement("p");
        status.className = "small project-status";
        status.textContent = project.statusText;
        entry.appendChild(status);

        if (!project.auto) {
            const btn = document.createElement("button");
            btn.textContent = project.buttonText;
            btn.disabled = project.buttonDisabled;
            btn.dataset.projectId = project.id;
            btn.addEventListener("click", () => completeProject(project.id));
            entry.appendChild(btn);
        }

        container.appendChild(entry);
    });
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

function renderAIProjects() {
    const container = document.getElementById("ai-projects-list");
    if (!container) return;

    const pending = AI_PROJECTS.filter(p => !game.aiProjectsCompleted[p.id]);

    const payloadAll = pending.map(project => {
        const { costAI, costPower, costResearch } = getEffectiveProjectCosts(project);
        const completed = !!game.aiProjectsCompleted[project.id];
        const meetsReq = project.requires(game);
        const hasAI = costAI ? game.aiProgress >= costAI : true;
        const hasPower = costPower ? game.computerPower >= costPower : true;
        const hasResearch = costResearch ? game.research >= costResearch : true;
        const canBuy = meetsReq && hasAI && hasPower && hasResearch && !completed;
        const statusText = completed
            ? "Completed."
            : meetsReq
                ? canBuy
                    ? "Ready to run."
                    : "Not enough resources."
                : "Not ready yet.";
        return { project, completed, canBuy, statusText, costAI, costPower, costResearch };
    });

    // Sort by total cost (AI + power + research) ascending, then cap to 3 entries.
    const payload = payloadAll
        .sort((a, b) => {
            const costA = (a.costAI || 0) + (a.costPower || 0) + (a.costResearch || 0);
            const costB = (b.costAI || 0) + (b.costPower || 0) + (b.costResearch || 0);
            return costA - costB;
        })
        .slice(0, 3);

    const stateKey = payload.map(p => p.project.id).join("|");

    if (stateKey === lastRenderedAIProjectsKey) {
        updateAIProjectEntriesState(container, payload);
        return;
    }

    lastRenderedAIProjectsKey = stateKey;
    container.innerHTML = "";

    payload.forEach(({ project, completed, canBuy, statusText, costAI, costPower, costResearch }) => {
        const entry = document.createElement("div");
        entry.className = "upgrade";
        entry.dataset.aiProjectId = project.id;

        const title = document.createElement("h3");
        title.textContent = project.name + (completed ? " (Completed)" : "");
        entry.appendChild(title);

        const desc = document.createElement("p");
        desc.textContent = project.description;
        entry.appendChild(desc);

        const costs = [];
        if (costAI) costs.push(`${formatNumberCompact(costAI)} AI`);
        if (costPower) costs.push(`${formatNumberCompact(costPower)} computer power`);
        if (costResearch) costs.push(`${formatNumberCompact(costResearch)} research`);
        if (costs.length > 0) {
            const costLine = document.createElement("p");
            costLine.innerHTML = `<strong>Cost:</strong> ${costs.join(" + ")}`;
            entry.appendChild(costLine);
        }

        const status = document.createElement("p");
        status.className = "small project-status";
        status.textContent = statusText;
        entry.appendChild(status);

        const btn = document.createElement("button");
        btn.textContent = completed ? "Done" : "Run";
        btn.disabled = !canBuy;
        btn.addEventListener("click", () => buyAIProject(project.id));
        entry.appendChild(btn);

        container.appendChild(entry);
    });
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

function updateAIProjectEntriesState(container, payload) {
    payload.forEach(({ project, completed, canBuy, statusText }) => {
        const entry = container.querySelector(`[data-ai-project-id="${project.id}"]`);
        if (!entry) return;
        const title = entry.querySelector("h3");
        if (title) title.textContent = project.name + (completed ? " (Completed)" : "");
        const status = entry.querySelector(".project-status");
        if (status) status.textContent = statusText;
        const btn = entry.querySelector("button");
        if (btn) {
            btn.textContent = completed ? "Done" : "Run";
            btn.disabled = !canBuy;
        }
    });
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
    renderUpgrades();
    renderProjects();
    renderAIProjects();
    renderMiniGames();
    renderTerminal();
}

// === Init ===
function init() {
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
