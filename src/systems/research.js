import {
    gameState as game,
    PHASES,
    PROJECT_VISIBILITY_COST_FACTOR,
    MAX_VISIBLE_PROJECTS,
} from "../state.js";

let logMessageRef = () => {};
let unlockMiniGameRef = () => {};
let formatNumberCompactRef = v => (Number.isFinite(v) ? Math.floor(v).toLocaleString("en-US") : "0");
let formatDurationSecondsRef = () => "-";
let getActiveBuffMultipliersRef = () => ({ projectCost: 1 });

export function initResearchSystem({
    logMessage,
    unlockMiniGame,
    formatNumberCompact,
    formatDurationSeconds,
    getActiveBuffMultipliers,
} = {}) {
    if (typeof logMessage === "function") logMessageRef = logMessage;
    if (typeof unlockMiniGame === "function") unlockMiniGameRef = unlockMiniGame;
    if (typeof formatNumberCompact === "function") formatNumberCompactRef = formatNumberCompact;
    if (typeof formatDurationSeconds === "function") formatDurationSecondsRef = formatDurationSeconds;
    if (typeof getActiveBuffMultipliers === "function") getActiveBuffMultipliersRef = getActiveBuffMultipliers;
}

export const PROJECTS = [
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
                logMessageRef("1954 TRADIC assembled.");
                logMessageRef("Running first program...");
                logMessageRef("Hello, World!");
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
            unlockMiniGameRef("mg_proto_algo");
            if (!silent) {
                logMessageRef("Primitive algorithm running. Early compute squeezed harder.");
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
                logMessageRef("TX-0 operational. Early computing refined.");
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
                logMessageRef("System/360 unified architectures. Compatibility surge.");
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
                logMessageRef("Intel 4004 shipped. Microprocessor era begins.");
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
                logMessageRef("Intel 8080 released. Hobbyists rejoice.");
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
                logMessageRef("Intel 8086 architecture propagated. Standards solidify.");
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
                logMessageRef("Pentium era. Superscalar pipelines hum.");
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
                logMessageRef("Pentium 4 pushed clocks. Heat follows ambition.");
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
                logMessageRef("AI accelerators surge. Models scale effortlessly.");
            }
        },
    },

    // IA (perceptron retiré, l'IA se débloque plus tard via seuils/upgrade dédiés)
    {
        id: "ia_foundations",
        name: "IA Foundations",
        description: "Early AI math unlocks a small research boost.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 15_000_000,
        costPower: 100_000_000,
        requires: game =>
            game.research >= 15_000_000 && game.computerPower >= 100_000_000 && !game.projectsCompleted.ia_foundations,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.ia_foundations = true;
            if (!game.projectEffectsApplied.ia_foundations) {
                game.researchPerSec *= 1.1;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) + 10;
                game.projectEffectsApplied.ia_foundations = true;
            }
            if (!silent) {
                logMessageRef("AI foundations laid. Cognitive math unlocked.");
            }
        },
    },
    {
        id: "ai_bootstrap",
        name: "AI Bootstrap",
        description: "Unlock AI layer and initial AI/sec.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 35_000_000,
        costPower: 200_000_000,
        requires: game =>
            game.research >= 35_000_000 &&
            game.computerPower >= 200_000_000 &&
            !game.projectsCompleted.ai_bootstrap,
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted.ai_bootstrap = true;
            if (!game.projectEffectsApplied.ai_bootstrap) {
                game.aiUnlocked = true;
                game.aiProgressPerSec = Math.max(game.aiProgressPerSec || 0, 25);
                game.projectEffectsApplied.ai_bootstrap = true;
            }
            if (!silent) {
                logMessageRef("AI bootstrap complete. Cognitive layer online.");
            }
        },
    },
    {
        id: "ai_curriculum",
        name: "Curriculum Learning",
        description: "+25% AI progress per second.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 50_000_000,
        costPower: 400_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.research >= 50_000_000 &&
            game.computerPower >= 400_000_000 &&
            !game.projectsCompleted.ai_curriculum,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_curriculum) {
                game.projectEffectsApplied.ai_curriculum = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.25;
            }
            game.projectsCompleted.ai_curriculum = true;
            unlockMiniGameRef("mg_curriculum");
            if (!silent) {
                logMessageRef("AI curriculum designed. Models learn more efficiently.");
            }
        },
    },
    {
        id: "ai_synthetic_data",
        name: "Synthetic Data Lab",
        description: "+15% AI progress/sec, +10% research/sec.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 150_000_000,
        costPower: 800_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.researchUnlocked &&
            game.research >= 150_000_000 &&
            game.computerPower >= 800_000_000 &&
            !game.projectsCompleted.ai_synthetic_data,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_synthetic_data) {
                game.projectEffectsApplied.ai_synthetic_data = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.15;
                game.researchPerSec *= 1.1;
            }
            game.projectsCompleted.ai_synthetic_data = true;
            unlockMiniGameRef("mg_synth_harvest");
            if (!silent) {
                logMessageRef("Synthetic data pipeline online. Experiment velocity increased.");
            }
        },
    },
    {
        id: "ai_quantum_rl",
        name: "Quantum RL",
        description: "+60% AI progress/sec; unlocks Quantum RL mini-panel.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 500_000_000,
        costPower: 2_500_000_000,
        requires: game =>
            game.quantumUnlocked &&
            game.aiUnlocked &&
            game.research >= 500_000_000 &&
            game.computerPower >= 2_500_000_000 &&
            !game.projectsCompleted.ai_quantum_rl,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_quantum_rl) {
                game.projectEffectsApplied.ai_quantum_rl = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.6;
            }
            game.projectsCompleted.ai_quantum_rl = true;
            unlockMiniGameRef("mg_quantum_rl");
            if (!silent) {
                logMessageRef("Quantum RL deployed. Policy search accelerated.");
            }
        },
    },
    {
        id: "ai_alignment",
        name: "AI Alignment Lab",
        description: "+20% AI progress/sec; unlocks Alignment Check mini-game.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 400_000_000,
        costPower: 2_500_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.researchUnlocked &&
            game.research >= 400_000_000 &&
            game.computerPower >= 2_500_000_000 &&
            !game.projectsCompleted.ai_alignment,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_alignment) {
                game.projectEffectsApplied.ai_alignment = true;
                game.aiProgressPerSec = (game.aiProgressPerSec || 0) * 1.2;
            }
            game.projectsCompleted.ai_alignment = true;
            unlockMiniGameRef("mg_alignment");
            if (!silent) {
                logMessageRef("Alignment Lab online. Safety protocols enriched.");
            }
        },
    },
    {
        id: "ai_reading",
        name: "Cognitive Reader",
        description: "+30% research/sec; unlocks Reading Burst mini-game.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 600_000_000,
        costPower: 4_000_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.researchUnlocked &&
            game.research >= 600_000_000 &&
            game.computerPower >= 4_000_000_000 &&
            !game.projectsCompleted.ai_reading,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_reading) {
                game.projectEffectsApplied.ai_reading = true;
                game.researchPerSec *= 1.3;
            }
            game.projectsCompleted.ai_reading = true;
            unlockMiniGameRef("mg_reading");
            if (!silent) {
                logMessageRef("Cognitive Reader deployed. Comprehension enhanced.");
            }
        },
    },
    {
        id: "ai_overclock",
        name: "AI Overclock",
        description: "+50% computer power/sec.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 200_000_000,
        costPower: 2_000_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.researchUnlocked &&
            game.research >= 200_000_000 &&
            game.computerPower >= 2_000_000_000 &&
            !game.projectsCompleted.ai_overclock,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_overclock) {
                game.projectEffectsApplied.ai_overclock = true;
                game.powerPerComputerPerSec *= 1.5;
            }
            game.projectsCompleted.ai_overclock = true;
            if (!silent) {
                logMessageRef("AI overclock engaged. Classical compute surges.");
            }
        },
    },
    {
        id: "ai_research_synthesis",
        name: "AI Research Synthesis",
        description: "+60% research/sec.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 850_000_000,
        costPower: 3_000_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.researchUnlocked &&
            game.research >= 850_000_000 &&
            game.computerPower >= 3_000_000_000 &&
            !game.projectsCompleted.ai_research_synthesis,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_research_synthesis) {
                game.projectEffectsApplied.ai_research_synthesis = true;
                game.researchPerSec *= 1.6;
            }
            game.projectsCompleted.ai_research_synthesis = true;
            if (!silent) {
                logMessageRef("AI synthesizes research pipelines. Throughput spikes.");
            }
        },
    },
    {
        id: "ai_fab_overwatch",
        name: "AI Fab Overwatch",
        description: "x1.7 transistors per generator.",
        auto: false,
        minPhase: PHASES.RESEARCH,
        costResearch: 1_200_000_000,
        costPower: 4_000_000_000,
        requires: game =>
            game.aiUnlocked &&
            game.researchUnlocked &&
            game.research >= 1_200_000_000 &&
            game.computerPower >= 4_000_000_000 &&
            !game.projectsCompleted.ai_fab_overwatch,
        onComplete: (game, { silent } = {}) => {
            if (!game.projectEffectsApplied.ai_fab_overwatch) {
                game.projectEffectsApplied.ai_fab_overwatch = true;
                game.transistorsPerGeneratorPerSec *= 1.7;
            }
            game.projectsCompleted.ai_fab_overwatch = true;
            if (!silent) {
                logMessageRef("AI overwatches fabs. Transistor output stabilized and boosted.");
            }
        },
    },
];

export const AI_PROJECTS = [
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
            unlockMiniGameRef("mg_curriculum");
            if (!silent) {
                logMessageRef("AI curriculum designed. Models learn more efficiently.");
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
            unlockMiniGameRef("mg_synth_harvest");
            if (!silent) {
                logMessageRef("Synthetic data pipeline online. Experiment velocity increased.");
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
            unlockMiniGameRef("mg_quantum_rl");
            if (!silent) {
                logMessageRef("Quantum RL deployed. Policy search accelerated.");
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
            unlockMiniGameRef("mg_alignment");
            if (!silent) {
                logMessageRef("Alignment Lab online. Safety protocols enriched.");
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
            unlockMiniGameRef("mg_reading");
            if (!silent) {
                logMessageRef("Cognitive Reader deployed. Comprehension enhanced.");
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
                logMessageRef("AI overclock engaged. Classical compute surges.");
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
                logMessageRef("AI synthesizes research pipelines. Throughput spikes.");
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
                logMessageRef("AI overwatches fabs. Transistor output stabilized and boosted.");
            }
        },
    },
];

export function getEffectiveProjectCosts(project) {
    const mult = getActiveBuffMultipliersRef().projectCost;
    const costResearch = project.costResearch ? Math.ceil(project.costResearch * mult) : 0;
    const costPower = project.costPower ? Math.ceil(project.costPower * mult) : 0;
    const costAI = project.costAI ? Math.ceil(project.costAI * mult) : 0;
    return { costResearch, costPower, costAI };
}

export function isProjectVisible(project, currentGame = game) {
    const completed = !!currentGame.projectsCompleted[project.id];
    if (completed) return false;
    if (project.auto) {
        return false;
    }
    if (project.minPhase != null && currentGame.phase < project.minPhase) {
        return false;
    }
    // Projects remain hidden until the research phase is active.
    if (currentGame.phase < PHASES.RESEARCH) {
        return false;
    }
    if (project.requires(currentGame)) {
        return true;
    }
    const { costResearch, costPower } = getEffectiveProjectCosts(project);
    const nearResearch =
        costResearch === 0 || currentGame.research >= costResearch / PROJECT_VISIBILITY_COST_FACTOR;
    const nearPower =
        costPower === 0 || currentGame.computerPower >= costPower / PROJECT_VISIBILITY_COST_FACTOR;
    return nearResearch && nearPower;
}

export function completeProject(id, { silent } = {}) {
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

export function reapplyCompletedProjects({ silent } = {}) {
    PROJECTS.forEach(project => {
        if (!game.projectsCompleted[project.id]) return;
        project.onComplete(game, { silent, forceUI: true });
    });
    // Rebuild any mini-game panels for completed projects.
    MINI_GAMES.forEach(cfg => {
        if (game.projectsCompleted[cfg.projectId]) {
            unlockMiniGameRef(cfg.id);
        }
    });
}

export function reapplyCompletedAIProjects({ silent } = {}) {
    AI_PROJECTS.forEach(project => {
        if (!game.aiProjectsCompleted[project.id]) return;
        // Always re-run completion to rebuild UI; internal guards prevent double-applying effects.
        project.onComplete(game, { silent, forceUI: true });
    });
}

export function updateProjectsAuto() {
    PROJECTS.forEach(project => {
        if (!project.auto) return;
        if (game.projectsCompleted[project.id]) return;
        if (!project.requires(game)) return;
        completeProject(project.id, { silent: false });
    });
}

export function hasPendingAIProjects() {
    return AI_PROJECTS.some(p => !game.aiProjectsCompleted[p.id]);
}

export function buyAIProject(id) {
    const project = AI_PROJECTS.find(p => p.id === id);
    if (!project) return false;
    if (game.aiProjectsCompleted[project.id]) return false;
    if (!project.requires(game)) return false;

    const { costAI, costPower, costResearch } = getEffectiveProjectCosts(project);
    if (costAI && game.aiProgress < costAI) return false;
    if (costPower && game.computerPower < costPower) return false;
    if (costResearch && game.research < costResearch) return false;

    if (costAI) game.aiProgress -= costAI;
    if (costPower) game.computerPower -= costPower;
    if (costResearch) game.research -= costResearch;

    project.onComplete(game, { silent: false });
    return true;
}

export function getVisibleProjects(currentGame = game) {
    const visibleProjects = PROJECTS.filter(project => isProjectVisible(project, currentGame));
    return visibleProjects;
}

export function getVisibleAIProjects(currentGame = game) {
    const pending = AI_PROJECTS.filter(p => !currentGame.aiProjectsCompleted[p.id]);
    return pending;
}

// NOTE: MINI_GAMES is referenced for unlocks; import lazily to avoid circular issues
import { MINI_GAMES } from "../state.js";
