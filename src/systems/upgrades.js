import {
    gameState as game,
    getGamePhase,
    RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD,
    QUANTUM_RESEARCH_UNLOCK_THRESHOLD,
    AI_COMPUTE_UNLOCK_THRESHOLD,
    AI_RESEARCH_UNLOCK_THRESHOLD,
    PHASES,
} from "../state.js";

let logMessageRef = () => {};
let unlockQuantumWithStarterRef = () => {};

export function initUpgrades({ logMessage, unlockQuantumWithStarter } = {}) {
    if (typeof logMessage === 'function') logMessageRef = logMessage;
    if (typeof unlockQuantumWithStarter === 'function') unlockQuantumWithStarterRef = unlockQuantumWithStarter;
}

export const UPGRADES = [
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
            unlockQuantumWithStarterRef();
            game.quantumPower = Math.max(game.quantumPower, 0.5);
            logMessageRef("Quantum systems commissioned. Superposition ready.");
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
            logMessageRef("Research lab activated. New insights possible.");
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
            logMessageRef("Curriculum auto-sync online. Pulses trigger automatically.");
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
            logMessageRef("Synthetic data collection automated.");
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
            logMessageRef("Quantum policies now deploy automatically.");
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
            logMessageRef("Alignment validation on autopilot.");
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
            logMessageRef("Automated corpus reading activated.");
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
            unlockQuantumWithStarterRef();
            game.quantumPower = Math.max(game.quantumPower, 0.5);
            game.powerPerComputerPerSec *= 1.1;
            game.researchPerSec *= 1.08;
            logMessageRef("Quantum domain opened. Classical limitations challenged.");
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
            unlockQuantumWithStarterRef();
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
            unlockQuantumWithStarterRef();
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
            unlockQuantumWithStarterRef();
            game.quantumPower *= 2;
            game.researchPerSec *= 1.25;
            game.powerPerComputerPerSec *= 1.25;
            logMessageRef("Full Quantum Processing engaged. Flux stabilisé, poursuite sans limite.");
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
            unlockQuantumWithStarterRef();
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
            unlockQuantumWithStarterRef();
            game.quantumPower *= 4;
            game.researchPerSec *= 1.4;
        },
    },
];

export function canUnlockAI(currentGame = game) {
    return (
        currentGame.researchUnlocked &&
        currentGame.computerPower >= AI_COMPUTE_UNLOCK_THRESHOLD &&
        currentGame.research >= AI_RESEARCH_UNLOCK_THRESHOLD
    );
}

export function isUpgradeVisible(up, currentGame = game) {
    if (currentGame.upgradesBought[up.id]) return false;

    const phase = getGamePhase(currentGame);
    const allowedByPhase = {
        [PHASES.PRODUCTION]: ["transistors"],
        [PHASES.COMPUTERS]: ["transistors", "computers"],
        [PHASES.RESEARCH]: ["transistors", "computers", "research"],
        [PHASES.AI]: ["transistors", "computers", "research", "ai"],
        [PHASES.QUANTUM]: ["transistors", "computers", "research", "ai", "quantum"],
    };

    if (!allowedByPhase[phase].includes(up.category)) return false;

    if (up.category === 'research') {
        if (!currentGame.researchUnlocked && currentGame.computerPower < RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD) {
            return false;
        }
    }
    if (up.category === 'ai') {
        if (!canUnlockAI(currentGame)) {
            return false;
        }
    }
    if (up.category === 'quantum') {
        if (!currentGame.quantumUnlocked && (!currentGame.researchUnlocked || currentGame.research < QUANTUM_RESEARCH_UNLOCK_THRESHOLD)) {
            return false;
        }
    }

    return true;
}

export function canBuyUpgrade(id, currentGame = game) {
    const up = UPGRADES.find(u => u.id === id);
    if (!up) return false;
    if (currentGame.upgradesBought[id]) return false;
    if (currentGame.computerPower < up.costPower) return false;
    if (up.costResearch && currentGame.research < up.costResearch) return false;
    if (up.category === 'ai' && !currentGame.researchUnlocked) return false;
    return true;
}

export function buyUpgrade(id, currentGame = game) {
    if (!canBuyUpgrade(id, currentGame)) return false;

    const up = UPGRADES.find(u => u.id === id);
    const researchWasUnlocked = currentGame.researchUnlocked;
    currentGame.computerPower -= up.costPower;
    if (up.costResearch) {
        currentGame.research -= up.costResearch;
    }
    currentGame.upgradesBought[id] = true;
    up.apply();

    if (up.category === 'research' && !researchWasUnlocked && currentGame.researchUnlocked) {
        logMessageRef('Research lab activated. New insights possible.');
    }

    return true;
}
