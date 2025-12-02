// === Configuration ===
const TICK_MS = 100;
const SAVE_KEY = "the_transistor_save_v1";
const FIRST_COMPUTER_TRANSISTOR_THRESHOLD = 1_000; // seuil arbitraire pour le premier PC
const RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD = 20_000;
const EMERGENCE_AI_THRESHOLD = 5_000_000;
const EMERGENCE_QUANTUM_THRESHOLD = 10;
const QUANTUM_UNLOCK_COMPUTER_POWER_THRESHOLD = 100_000;
const QUANTUM_RESEARCH_UNLOCK_THRESHOLD = 8_000;
const END_GAME_AI_FINAL_THRESHOLD = 50_000_000;
const END_GAME_COMPUTE_FINAL_THRESHOLD = 1_000_000_000_000_000;
const MAX_VISIBLE_UPGRADES_PER_CATEGORY = 3;
const UI_THRESHOLDS = {
    transistors: 1,
    production: 10,
    terminal: 800,
    upgrades: 1000,
};
let lastRenderedUpgradesKey = null;
let lastRenderedProjectsKey = null;

const PHASES = {
    PRODUCTION: 0, // only transistor chain upgrades
    COMPUTERS: 1,  // computer upgrades unlocked
    RESEARCH: 2,   // research upgrades unlocked
    AI: 3,         // AI upgrades unlocked
    QUANTUM: 4,    // quantum upgrades unlocked
};

function getGamePhase(game) {
    if (game.quantumUnlocked || game.quantumPower > 0) {
        return PHASES.QUANTUM;
    }
    if (game.aiUnlocked || game.aiProgress >= EMERGENCE_AI_THRESHOLD * 0.05) {
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

// === État du jeu ===
function nowMs() {
    return typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
}

function createDefaultGameState() {
    return {
        phase: 0,
        transistors: 0,
        transistorsPerClick: 1,
        totalTransistorsCreated: 0,
        computerPower: 0,
        lifetimeComputerPower: 0,
        computers: 0,
        computerBaseCost: 1500,
        computerCostMultiplier: 1.4,
        powerPerComputerPerSec: 1.5,

        quantumPower: 0,
        quantumUnlocked: false,
        aiProgress: 0,
        lifetimeAIProgress: 0,
        aiUnlocked: false,

        research: 0,
        researchPerSec: 0,
        lifetimeResearch: 0,
        researchUnlocked: false,
        saveVersion: "v1",
        aiProgressPerSec: 0,

        generators: 0,
        generatorBaseCost: 25,
        generatorCostMultiplier: 1.22,
        transistorsPerGeneratorPerSec: 1,

        projectsCompleted: {},
        projectEffectsApplied: {},

        upgradesBought: {},
        terminalLog: [],
        flags: {
            firstComputerBuilt: false,
            terminalUnlocked: false,
            emergenceOffered: false,
            emergenceChosen: false,
            consciousnessAwakened: null, // null / true / false
            gameEnded: false,
        },

        lastTick: nowMs(),
    };
}

let game = createDefaultGameState();

// === Upgrades ===
const UPGRADES = [
    // Transistors
    {
        id: "dopage_silicium_1",
        category: "transistors",
        name: "Silicon Doping I",
        description: "+15% transistors per second.",
        costPower: 100,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.15;
        },
    },
    {
        id: "dopage_silicium_2",
        category: "transistors",
        name: "Silicon Doping II",
        description: "+20% transistors per second.",
        costPower: 500,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.2;
        },
    },
    {
        id: "purete_silicium",
        category: "transistors",
        name: "High-Purity Silicon",
        description: "+30% transistors per second.",
        costPower: 2500,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.3;
        },
    },
    {
        id: "photolitho_1",
        category: "transistors",
        name: "Basic Photolithography",
        description: "+30% transistors per second.",
        costPower: 12500,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.3;
        },
    },
    {
        id: "photolitho_2",
        category: "transistors",
        name: "Deep UV Photolithography",
        description: "+40% transistors per second.",
        costPower: 60000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.4;
        },
    },
    {
        id: "gravure_1um",
        category: "transistors",
        name: "1 um Process Node",
        description: "+50% transistors per second.",
        costPower: 300000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.5;
        },
    },
    {
        id: "gravure_90nm",
        category: "transistors",
        name: "90 nm Node",
        description: "+60% transistors per second.",
        costPower: 1500000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.6;
        },
    },
    {
        id: "gravure_14nm",
        category: "transistors",
        name: "14 nm Node",
        description: "+70% transistors per second.",
        costPower: 8000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.7;
        },
    },
    {
        id: "gravure_7nm",
        category: "transistors",
        name: "7 nm Node",
        description: "+80% transistors per second.",
        costPower: 40000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 1.8;
        },
    },
    {
        id: "gravure_3nm",
        category: "transistors",
        name: "3 nm Node",
        description: "+100% transistors per second.",
        costPower: 200000000,
        apply: () => {
            game.transistorsPerGeneratorPerSec *= 2;
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
        id: "quantum_activation",
        category: "computers",
        name: "Quantum Activation",
        description: "Unlock quantum systems and add 0.5 quantum power.",
        costPower: 25_000_000_000,
        apply: () => {
            game.quantumUnlocked = true;
            game.quantumPower = Math.max(game.quantumPower, 0.5);
            logMessage("Quantum systems commissioned. Superposition ready.");
        },
    },

    // Research
    {
        id: "research_unlock",
        category: "research",
        name: "Research Lab",
        description: "Unlocks research and starts generating 0.5 research/sec.",
        costPower: 150000,
        apply: () => {
            game.researchUnlocked = true;
            if (game.researchPerSec < 0.5) {
                game.researchPerSec = 0.5;
            }
            logMessage("Research lab activated. New insights possible.");
        },
    },
    {
        id: "algebra_bool",
        category: "research",
        name: "Boolean Algebra",
        description: "+30% research/sec",
        costPower: 800000,
        apply: () => {
            game.researchPerSec *= 1.3;
        },
    },
    {
        id: "matrix_opt",
        category: "research",
        name: "Matrix Optimizations",
        description: "+50% research/sec",
        costPower: 4000000,
        apply: () => {
            game.researchPerSec *= 1.5;
        },
    },
    {
        id: "algorithm_opt",
        category: "research",
        name: "Algorithm Optimizations",
        description: "+50% research/sec",
        costPower: 20000000,
        apply: () => {
            game.researchPerSec *= 1.5;
        },
    },
    {
        id: "backprop_insight",
        category: "research",
        name: "Backprop Foundations",
        description: "+80% research/sec",
        costPower: 150000000,
        apply: () => {
            game.researchPerSec *= 1.8;
        },
    },
    {
        id: "conv_math",
        category: "research",
        name: "Convolution Math",
        description: "+80% research/sec",
        costPower: 900000000,
        apply: () => {
            game.researchPerSec *= 1.8;
        },
    },
    {
        id: "transformer_theory",
        category: "research",
        name: "Transformer Mathematics",
        description: "x2 research/sec",
        costPower: 12_000_000_000_000,
        apply: () => {
            game.researchPerSec *= 2;
        },
    },

    // AI
    {
        id: "ai_heuristics",
        category: "ai",
        name: "Learning Heuristics",
        description: "+20 AI progress per second.",
        costPower: 200000000,
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgressPerSec = (game.aiProgressPerSec || 0) + 20;
        },
    },
    {
        id: "ai_autotuning",
        category: "ai",
        name: "AI Autotuning",
        description: "+60% AI accumulated progress.",
        costPower: 1500000000,
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
        apply: () => {
            game.aiUnlocked = true;
            game.aiProgress *= 2;
        },
    },

    // Quantum
    {
        id: "qubit_stable",
        category: "quantum",
        name: "Stable Qubits",
        description: "Unlock quantum and add 0.5 quantum power.",
        costPower: 10000000000,
        apply: () => {
            game.quantumUnlocked = true;
            game.quantumPower = Math.max(game.quantumPower, 0.5);
            logMessage("Quantum domain opened. Classical limitations challenged.");
        },
    },
    {
        id: "superposition",
        category: "quantum",
        name: "Superposition",
        description: "+1 quantum power.",
        costPower: 300000000000,
        apply: () => {
            game.quantumUnlocked = true;
            game.quantumPower += 1;
        },
    },
    {
        id: "entanglement",
        category: "quantum",
        name: "Entanglement",
        description: "+3 quantum power.",
        costPower: 8_000_000_000_000,
        apply: () => {
            game.quantumUnlocked = true;
            game.quantumPower += 3;
        },
    },
    {
        id: "qpu_arch",
        category: "quantum",
        name: "Full Quantum Processing Unit",
        description: "x2 quantum power.",
        costPower: 500_000_000_000_000,
        apply: () => {
            game.quantumUnlocked = true;
            game.quantumPower *= 2;
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
            game.totalTransistorsCreated >= 10000 && !game.projectsCompleted.tradic,
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
        id: "tx0",
        name: "TX-0 (MIT)",
        description: "Debugging lights blink to life.",
        auto: true,
        requires: game =>
            game.totalTransistorsCreated >= 100000 && !game.projectsCompleted.tx0,
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
        costResearch: 25000,
        costPower: 50000,
        requires: game =>
            game.computerPower >= 50000 && !game.projectsCompleted.system360,
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
        costResearch: 150000,
        costPower: 120000,
        requires: game =>
            game.research >= 150000 && !game.projectsCompleted.intel_4004,
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
        costResearch: 500000,
        costPower: 400000,
        requires: game =>
            game.research >= 500000 && !game.projectsCompleted.intel_8080,
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
        costResearch: 1500000,
        costPower: 2000000,
        requires: game =>
            game.computerPower >= 5000000 && game.research >= 1500000 && !game.projectsCompleted.intel_8086,
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
        costResearch: 8000000,
        costPower: 12000000,
        requires: game =>
            game.computerPower >= 25000000 &&
            game.research >= 8000000 &&
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
        costResearch: 30000000,
        costPower: 45000000,
        requires: game =>
            game.computerPower >= 120000000 &&
            game.research >= 30000000 &&
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
        minPhase: PHASES.AI,
        costResearch: 150000000,
        costPower: 250000000,
        requires: game =>
            game.computerPower >= 600000000 &&
            game.research >= 150000000 &&
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

    // IA
    {
        id: "ai_perceptron",
        name: "Perceptron",
        description: "The simplest learnable unit.",
        auto: false,
        minPhase: 2,
        costResearch: 12000,
        requires: game =>
            game.research >= 12000 && !game.projectsCompleted["ai_perceptron"],
        onComplete: (game, { silent } = {}) => {
            game.projectsCompleted["ai_perceptron"] = true;
            if (!game.projectEffectsApplied.ai_perceptron) {
                game.aiUnlocked = true;
                game.aiProgress += 10;
                game.researchPerSec *= 1.1;
                game.projectEffectsApplied.ai_perceptron = true;
            }
            if (!silent) {
                logMessage("Perceptron implemented. Learning begins.");
            }
        },
    },
    {
        id: "ai_backprop",
        name: "Backpropagation",
        description: "Training deeper networks efficiently.",
        auto: false,
        minPhase: 2,
        costResearch: 60000,
        requires: game =>
            game.research >= 60000 &&
            game.projectsCompleted["ai_perceptron"] &&
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
            game.research >= 350000 &&
            game.projectsCompleted["ai_backprop"] &&
            !game.projectsCompleted["ai_cnn"],
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
            game.research >= 2000000 &&
            game.projectsCompleted["ai_cnn"] &&
            !game.projectsCompleted["ai_transformers"],
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
                game.quantumUnlocked = true;
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
    // {
    //     id: "universe_exploration",
    //     name: "Universe Exploration",
    //     description: "Opens deep-space exploration and resource scanning.",
    //     auto: false,
    //     minPhase: PHASES.QUANTUM,
    //     costResearch: 15000000,
    //     costPower: 20000000,
    //     requires: game => false, // TODO: wire later
    //     onComplete: (game, { silent } = {}) => {
    //         // TODO: allow exploration hooks here
    //     },
    // },
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

function formatNumberFixed(value, fractionDigits = 2) {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString("en-US", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    });
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

function getComputerPowerMultiplier() {
    return 1 + game.quantumPower * 0.2;
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
        if (!game.researchUnlocked) {
            return false;
        }
        // On laisse le debloquage IA aux upgrades/projets AI
    }
    if (up.category === "quantum") {
        if (!game.quantumUnlocked && (!game.researchUnlocked || game.research < QUANTUM_RESEARCH_UNLOCK_THRESHOLD)) {
            return false;
        }
    }

    return true;
}

function isProjectVisible(project, game) {
    const completed = !!game.projectsCompleted[project.id];
    if (completed) return false;
    if (project.auto) {
        return false;
    }
    // Hide future content until the corresponding systems are active.
    if (project.minPhase != null && game.phase < project.minPhase) {
        return false;
    }
    if (project.requires(game)) {
        return true;
    }
    let near = false;
    if (project.costResearch && project.costResearch > 0) {
        if (game.research >= project.costResearch * 0.5) {
            near = true;
        }
    }
    if (project.costPower && project.costPower > 0) {
        if (game.computerPower >= project.costPower * 0.5) {
            near = true;
        }
    }
    return near;
}

// === Terminal log ===
// Terminal log is only available once the terminal is unlocked.
// Used for narrative feedback and key system events.
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
        research: safeNumber(saved.research, defaults.research),
        researchPerSec: safeNumber(saved.researchPerSec, defaults.researchPerSec),
        lifetimeResearch: safeNumber(saved.lifetimeResearch, defaults.lifetimeResearch),
        researchUnlocked: saved.researchUnlocked ?? defaults.researchUnlocked,
        saveVersion: saved.saveVersion || defaults.saveVersion,
        aiProgressPerSec: safeNumber(saved.aiProgressPerSec, defaults.aiProgressPerSec),
        generators: safeNumber(saved.generators, defaults.generators),
        generatorBaseCost: safeNumber(saved.generatorBaseCost, defaults.generatorBaseCost),
        generatorCostMultiplier: safeNumber(saved.generatorCostMultiplier, defaults.generatorCostMultiplier),
        transistorsPerGeneratorPerSec: safeNumber(
            saved.transistorsPerGeneratorPerSec,
            defaults.transistorsPerGeneratorPerSec
        ),
        upgradesBought: saved.upgradesBought ?? defaults.upgradesBought,
        terminalLog: Array.isArray(saved.terminalLog) ? saved.terminalLog : defaults.terminalLog,
        projectsCompleted: saved.projectsCompleted ?? defaults.projectsCompleted,
        projectEffectsApplied: saved.projectEffectsApplied ?? defaults.projectEffectsApplied,
        flags: {
            ...defaults.flags,
            ...flagsFromSave,
            terminalUnlocked: flagsFromSave.terminalUnlocked ?? false,
            emergenceOffered: flagsFromSave.emergenceOffered ?? defaults.flags.emergenceOffered,
            emergenceChosen: flagsFromSave.emergenceChosen ?? defaults.flags.emergenceChosen,
            consciousnessAwakened:
                flagsFromSave.consciousnessAwakened ?? defaults.flags.consciousnessAwakened,
            gameEnded: flagsFromSave.gameEnded ?? defaults.flags.gameEnded,
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
        reapplyCompletedProjects({ silent: true });
        renderAll();
        return;
    }

    try {
        const data = JSON.parse(raw);
        hydrateGameState(data);
        reapplyCompletedProjects({ silent: true });
        renderAll();
    } catch (e) {
        console.error("Error while loading save:", e);
        hydrateGameState();
        reapplyCompletedProjects({ silent: true });
        renderAll();
    }
}

function hardReset() {
    if (!confirm("Reset game and delete save?")) return;

    localStorage.removeItem(SAVE_KEY);
    hydrateGameState();
    reapplyCompletedProjects({ silent: true });
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
// Phase 3 – AI
//   - AI upgrades and projects unlock aiProgress and aiProgressPerSec.
//   - aiProgress is used as a “soft progress” towards emergence and endgame.
//
// Phase 4 – Quantum
//   - Quantum is unlocked via projects/upgrades and/or thresholds on compute + research.
//   - quantumPower acts as a multiplier on computerPower generation (late game scaling).
//   - Quantum projects and upgrades boost quantumPower, research and compute.
function gameTick() {
    if (game.flags.gameEnded) {
        return;
    }

    const now = nowMs();
    const deltaSec = (now - game.lastTick) / 1000;
    game.lastTick = now;

    // Production via generators
    const fromGenerators =
        game.generators * game.transistorsPerGeneratorPerSec * deltaSec;
    game.transistors += fromGenerators;
    game.totalTransistorsCreated += fromGenerators;
    const powerFromComputers =
        game.computers *
        game.powerPerComputerPerSec *
        getComputerPowerMultiplier() *
        deltaSec;
    game.computerPower += powerFromComputers;
    game.lifetimeComputerPower += powerFromComputers;

    if (!game.researchUnlocked && game.computerPower >= RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD) {
        game.researchUnlocked = true;
        if (game.researchPerSec < 0.1) {
            game.researchPerSec = 0.1;
        }
        if (game.flags.terminalUnlocked) {
            logMessage("[197x] Computation repurposed for R&D.");
            logMessage("Research module online.");
        }
    }

    if (
        !game.quantumUnlocked &&
        game.computerPower >= QUANTUM_UNLOCK_COMPUTER_POWER_THRESHOLD &&
        game.research >= QUANTUM_RESEARCH_UNLOCK_THRESHOLD
    ) {
        game.quantumUnlocked = true;
        if (game.quantumPower < 0.1) {
            game.quantumPower = 0.1;
        }
        logMessage("Quantum threshold reached. Quantum domain unlocked.");
    }

    if (game.researchUnlocked && game.researchPerSec > 0) {
        const gainedResearch = game.researchPerSec * deltaSec;
        game.research += gainedResearch;
        game.lifetimeResearch += gainedResearch;
    }

    if (game.aiUnlocked && game.aiProgressPerSec) {
        const gainedAI = game.aiProgressPerSec * deltaSec;
        game.aiProgress += gainedAI;
        game.lifetimeAIProgress += gainedAI;
    }

    updateProjectsAuto();
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

    if (project.costResearch && game.research < project.costResearch) return;
    if (project.costPower && game.computerPower < project.costPower) return;

    if (project.costResearch) {
        game.research -= project.costResearch;
    }
    if (project.costPower) {
        game.computerPower -= project.costPower;
    }

    game.projectsCompleted[id] = true;
    project.onComplete(game, { silent });
}

function reapplyCompletedProjects({ silent } = {}) {
    PROJECTS.forEach(project => {
        if (game.projectsCompleted[project.id] && !game.projectEffectsApplied[project.id]) {
            project.onComplete(game, { silent });
        }
    });
}

function updateProjectsAuto() {
    PROJECTS.forEach(project => {
        if (!project.auto) return;
        if (game.projectsCompleted[project.id]) return;
        if (!project.requires(game)) return;
        completeProject(project.id, { silent: false });
    });
}

function maybeOfferEmergence() {
    if (game.flags.emergenceOffered) return;
    if (game.aiProgress < EMERGENCE_AI_THRESHOLD) return;
    if (game.quantumPower < EMERGENCE_QUANTUM_THRESHOLD) return;

    game.flags.emergenceOffered = true;
    showEmergenceModal();
}

function maybeTriggerEndGame() {
    if (game.flags.gameEnded) return;
    if (!game.flags.emergenceChosen) return;
    const aiReached = game.aiProgress >= END_GAME_AI_FINAL_THRESHOLD;
    const computeReached = game.computerPower >= END_GAME_COMPUTE_FINAL_THRESHOLD;
    if (aiReached && computeReached) {
        triggerEndGame();
    }
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
    if (game.totalTransistorsCreated < FIRST_COMPUTER_TRANSISTOR_THRESHOLD) {
        return;
    }
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
    if (up.category === "ai" && !game.researchUnlocked) return;

    const researchWasUnlocked = game.researchUnlocked;
    game.computerPower -= up.costPower;
    game.upgradesBought[id] = true;
    up.apply();

    if (up.category === "research" && !researchWasUnlocked && game.researchUnlocked) {
        logMessage("Research lab activated. New insights possible.");
    }

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
    const showUpgradesUnlocked = total >= UI_THRESHOLDS.upgrades;
    const visibleUpgradeCount = showUpgradesUnlocked
        ? UPGRADES.filter(up => isUpgradeVisible(up, game)).length
        : 0;
    const showUpgrades = showUpgradesUnlocked && visibleUpgradeCount > 0;

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

    const showResearchPanel = game.researchUnlocked;
    const anyProjectVisible = PROJECTS.some(p => isProjectVisible(p, game));
    const showProjectsPanel = anyProjectVisible;
    const canShowComputers =
        game.totalTransistorsCreated >= FIRST_COMPUTER_TRANSISTOR_THRESHOLD;

    // Panels gating to avoid flashing empty sections.
    // TODO: In a later version, use game.phase here to gate advanced panels.
    toggleElement("panel-computers", canShowComputers);
    toggleElement("panel-upgrades", showUpgrades);
    toggleElement("panel-research", showResearchPanel);
    toggleElement("panel-projects", showProjectsPanel);
}

function renderStats() {
    const transistorsPerSec =
        game.generators * game.transistorsPerGeneratorPerSec;
    const generatorOutputTotal = transistorsPerSec;
    const computerPowerPerSec =
        game.computers * game.powerPerComputerPerSec;

    document.getElementById("transistors-count").textContent =
        formatNumber(game.transistors);
    const counterDisplay = document.getElementById("transistor-counter");
    if (counterDisplay) {
        counterDisplay.textContent = formatNumber(game.totalTransistorsCreated);
    }
    document.getElementById("transistors-per-click").textContent =
        formatNumberFixed(game.transistorsPerClick, 2);
    document.getElementById("transistors-per-sec").textContent =
        formatNumberFixed(transistorsPerSec, 2);

    document.getElementById("generators-count").textContent =
        formatNumber(game.generators);
    document.getElementById("generator-cost").textContent =
        formatNumber(getGeneratorCost());
    document.getElementById("generator-rate").textContent =
        formatNumberFixed(generatorOutputTotal, 2);
    document.getElementById("computers-count").textContent =
        formatNumber(game.computers);
    document.getElementById("computer-cost").textContent =
        formatNumber(getComputerCost());
    document.getElementById("computer-rate").textContent =
        formatNumberFixed(game.powerPerComputerPerSec, 2);
    document.getElementById("computer-total-rate").textContent =
        formatNumberFixed(computerPowerPerSec, 2);
    document.getElementById("computer-power-count").textContent =
        formatNumber(game.computerPower);
    const quantumPower = document.getElementById("quantum-power");
    if (quantumPower) {
        quantumPower.textContent = game.quantumUnlocked ? game.quantumPower.toFixed(2) : "Locked";
        const quantumRow = quantumPower.closest(".stat-row");
        if (quantumRow) {
            quantumRow.classList.toggle("hidden", !game.quantumUnlocked);
        }
    }
    const researchCount = document.getElementById("research-count");
    if (researchCount) {
        researchCount.textContent = formatNumberFixed(game.research, 2);
    }
    const researchPerSecEl = document.getElementById("research-per-sec");
    if (researchPerSecEl) {
        researchPerSecEl.textContent = formatNumberFixed(game.researchPerSec, 2);
    }
    const aiProgress = document.getElementById("ai-progress");
    if (aiProgress) {
        aiProgress.textContent = game.aiUnlocked ? Math.floor(game.aiProgress) : "Locked";
        const aiRow = aiProgress.closest(".stat-row");
        if (aiRow) {
            aiRow.classList.toggle("hidden", !game.aiUnlocked);
        }
    }

    // Boutons disabled
    document.getElementById("btn-buy-generator").disabled =
        game.transistors < getGeneratorCost();
    const btnComputer = document.getElementById("btn-buy-computer");
    if (btnComputer) {
        btnComputer.disabled = game.transistors < getComputerCost();
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
    payload.forEach(({ upgrades }) => {
        upgrades.forEach(up => {
            const btn = container.querySelector(`button[data-upgrade-id="${up.id}"]`);
            if (!btn) return;
            const bought = !!game.upgradesBought[up.id];
            btn.disabled = bought || game.computerPower < up.costPower;
            btn.textContent = bought ? "Purchased" : "Buy";
        });
    });
}

function renderUpgrades() {
    const container = document.getElementById("upgrades-list");
    if (!container) return;

    const categories = ["transistors", "computers", "research", "ai", "quantum"];
    const payload = [];

    categories.forEach(category => {
        const available = UPGRADES
            .filter(up => up.category === category)
            .filter(up => isUpgradeVisible(up, game))
            .sort((a, b) => a.costPower - b.costPower);

        if (available.length === 0) {
            return;
        }

        const visible = available.slice(0, MAX_VISIBLE_UPGRADES_PER_CATEGORY);
        payload.push({ category, upgrades: visible });
    });

    const stateKey = payload
        .map(group => `${group.category}:${group.upgrades.map(u => u.id).join(",")}`)
        .join("|");

    // Keep the DOM stable so clicks are not interrupted by per-tick renders.
    if (stateKey === lastRenderedUpgradesKey) {
        updateUpgradeButtonsState(container, payload);
        return;
    }

    lastRenderedUpgradesKey = stateKey;
    container.innerHTML = "";

    payload.forEach(({ category, upgrades }) => {
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
            cost.textContent = `Cost: ${formatNumber(up.costPower)} computer power`;
            div.appendChild(cost);

            const btn = document.createElement("button");
            btn.textContent = game.upgradesBought[up.id] ? "Purchased" : "Buy";
            btn.disabled = game.computerPower < up.costPower || game.upgradesBought[up.id];
            btn.dataset.upgradeId = up.id;
            btn.addEventListener("click", () => buyUpgrade(up.id));
            div.appendChild(btn);

            container.appendChild(div);
        });
    });
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

    const payload = [];

    PROJECTS.forEach(project => {
        if (!isProjectVisible(project, game)) {
            return;
        }

        const completed = !!game.projectsCompleted[project.id];
        const meetsReq = project.requires(game);
        const hasCost = (project.costResearch ? game.research >= project.costResearch : true) &&
            (project.costPower ? game.computerPower >= project.costPower : true);
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
            costResearch: project.costResearch,
            costPower: project.costPower,
            auto: project.auto,
            completed,
            statusText,
            buttonText,
            buttonDisabled,
        });
    });

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
            costLine.textContent = [
                project.costResearch ? `Cost: ${project.costResearch} research` : "",
                project.costPower ? `Cost: ${project.costPower} computer power` : "",
            ].filter(Boolean).join(" | ");
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
        title.textContent = game.quantumUnlocked ? "Quantum Computers" : "Computers";
    }

    const labelTexts = game.quantumUnlocked
        ? [
            "Quantum computers",
            "Next quantum system cost (transistors)",
            "Power per quantum computer (per sec)",
            "Total quantum power (per sec)",
        ]
        : [
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
    renderTerminal();
}

// === Init ===
function init() {
    loadGame();
    reapplyCompletedProjects({ silent: true });

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
    const btnEmergenceYes = document.getElementById("btn-emergence-yes");
    const btnEmergenceNo = document.getElementById("btn-emergence-no");
    if (btnEmergenceYes) {
        btnEmergenceYes.addEventListener("click", () => onEmergenceChoice(true));
    }
    if (btnEmergenceNo) {
        btnEmergenceNo.addEventListener("click", () => onEmergenceChoice(false));
    }
    const btnEndReset = document.getElementById("btn-end-reset");
    if (btnEndReset) {
        btnEndReset.addEventListener("click", () => {
            hardReset();
            const endScreen = document.getElementById("end-screen");
            if (endScreen) endScreen.classList.add("hidden");
        });
    }
    if (game.flags.emergenceOffered && !game.flags.emergenceChosen) {
        showEmergenceModal();
    }

    renderAll();

    setInterval(gameTick, TICK_MS);
    setInterval(saveGame, 5000);
}

window.addEventListener("DOMContentLoaded", init);
