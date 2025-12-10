import {
    GAME_SPEED_MULTIPLIER,
    BASE_QUANTUM_RESEARCH_FACTOR,
    RESEARCH_SPEED_BONUS,
    EXPLORATION_SIGNAL_FACTOR,
    IA_SCAN_AI_BASE,
    IA_SCAN_AI_GROWTH,
    IA_SCAN_CHARGE_BASE,
    IA_SCAN_CHARGE_GROWTH,
    IA_HYPER_COST_MULT,
    IA_HYPER_UNLOCK_PERCENT,
    ANCHOR_QC_COST,
    ANCHOR_QUANTUM_PENALTY,
    RESEARCH_UNLOCK_COMPUTER_POWER_THRESHOLD,
    nowMs,
} from "../state.js";

// Default helpers are replaced at runtime via initStatsUI to avoid circular deps.
let formatNumber = v => (Number.isFinite(v) ? Math.floor(v).toLocaleString("en-US") : "0");
let formatNumberCompact = v => (Number.isFinite(v) ? Math.floor(v).toLocaleString("en-US") : "0");
let formatNumberFixed = (v, digits = 2) =>
    Number.isFinite(v)
        ? v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
        : "0";
let formatDurationSeconds = () => "0s";
let timeToAfford = () => Infinity;
let getActiveBuffMultipliers = () => ({ ai: 1, research: 1, compute: 1, transistors: 1, generators: 1 });
let getGeneratorOutputMultiplier = () => 1;
let getComputerPowerPerSec = () => 0;
let getComputerPowerMultiplier = () => 1;
let getGeneratorCost = () => 0;
let getComputerCost = () => 0;
let getQuantumComputerCost = () => 0;

export function initStatsUI({
    formatNumber: fnFormatNumber,
    formatNumberCompact: fnFormatNumberCompact,
    formatNumberFixed: fnFormatNumberFixed,
    formatDurationSeconds: fnFormatDurationSeconds,
    timeToAfford: fnTimeToAfford,
    getActiveBuffMultipliers: fnGetActiveBuffMultipliers,
    getGeneratorOutputMultiplier: fnGetGeneratorOutputMultiplier,
    getComputerPowerPerSec: fnGetComputerPowerPerSec,
    getComputerPowerMultiplier: fnGetComputerPowerMultiplier,
    getGeneratorCost: fnGetGeneratorCost,
    getComputerCost: fnGetComputerCost,
    getQuantumComputerCost: fnGetQuantumComputerCost,
} = {}) {
    if (typeof fnFormatNumber === "function") formatNumber = fnFormatNumber;
    if (typeof fnFormatNumberCompact === "function") formatNumberCompact = fnFormatNumberCompact;
    if (typeof fnFormatNumberFixed === "function") formatNumberFixed = fnFormatNumberFixed;
    if (typeof fnFormatDurationSeconds === "function") formatDurationSeconds = fnFormatDurationSeconds;
    if (typeof fnTimeToAfford === "function") timeToAfford = fnTimeToAfford;
    if (typeof fnGetActiveBuffMultipliers === "function") getActiveBuffMultipliers = fnGetActiveBuffMultipliers;
    if (typeof fnGetGeneratorOutputMultiplier === "function")
        getGeneratorOutputMultiplier = fnGetGeneratorOutputMultiplier;
    if (typeof fnGetComputerPowerPerSec === "function") getComputerPowerPerSec = fnGetComputerPowerPerSec;
    if (typeof fnGetComputerPowerMultiplier === "function")
        getComputerPowerMultiplier = fnGetComputerPowerMultiplier;
    if (typeof fnGetGeneratorCost === "function") getGeneratorCost = fnGetGeneratorCost;
    if (typeof fnGetComputerCost === "function") getComputerCost = fnGetComputerCost;
    if (typeof fnGetQuantumComputerCost === "function") getQuantumComputerCost = fnGetQuantumComputerCost;
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
            handle.textContent = "?";
            title.prepend(handle);
        } else {
            handle.textContent = "?";
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

export function renderStats(game) {
    const pacing = GAME_SPEED_MULTIPLIER;
    const buff = getActiveBuffMultipliers();
    const now = nowMs();
    if (!Array.isArray(game._recentClicks)) game._recentClicks = [];
    game._recentClicks = game._recentClicks.filter(t => now - t <= 1000);
    const generatorOutputTotal =
        game.generators * game.transistorsPerGeneratorPerSec * getGeneratorOutputMultiplier() * pacing;
    const computerPowerPerSec = getComputerPowerPerSec() * buff.compute * pacing;
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
    const clicksPerSec = game._recentClicks.length;
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
    const quantumEfficiency = quantumBasePerSec > 0 ? quantumCost / quantumBasePerSec : Infinity;
    const quantumTimeToAfford = timeToAfford(
        quantumCost,
        game.transistors,
        totalTransistorsPerSecDisplay
    );

    document.getElementById("transistors-count").textContent = formatNumberCompact(game.transistors);
    const counterDisplay = document.getElementById("transistor-counter");
    if (counterDisplay) {
        counterDisplay.textContent = formatNumber(game.totalTransistorsCreated);
    }
    document.getElementById("transistors-per-click").textContent = formatNumberFixed(game.transistorsPerClick, 2);
    document.getElementById("transistors-per-sec").textContent = formatNumberFixed(totalTransistorsPerSecDisplay, 2);

    document.getElementById("generators-count").textContent = formatNumberCompact(game.generators);
    document.getElementById("generator-cost").textContent = formatNumberCompact(generatorCost);
    document.getElementById("generator-rate").textContent = formatNumberFixed(generatorOutputTotal, 2);
    const genTime = document.getElementById("generator-time");
    if (genTime) {
        genTime.textContent = formatDurationSeconds(generatorTimeToAfford);
    }
    const genPayback = document.getElementById("generator-payback");
    if (genPayback) {
        genPayback.textContent = formatDurationSeconds(generatorPaybackSec);
    }
    document.getElementById("computers-count").textContent = formatNumberCompact(game.computers);
    document.getElementById("computer-cost").textContent = formatNumberCompact(computerCost);
    document.getElementById("computer-rate").textContent = formatNumberFixed(game.powerPerComputerPerSec * pacing, 2);
    document.getElementById("computer-total-rate").textContent = formatNumberFixed(computerPowerPerSec, 2);
    const computerTime = document.getElementById("computer-time");
    if (computerTime) {
        computerTime.textContent = formatDurationSeconds(computerTimeToAfford);
    }
    const computerEff = document.getElementById("computer-efficiency");
    if (computerEff) {
        computerEff.textContent =
            computerEfficiency === Infinity ? "—" : `${formatNumberFixed(computerEfficiency, 2)} cost/compute/s`;
    }
    document.getElementById("computer-power-count").textContent = formatNumberCompact(game.computerPower);
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
            game.aiMode === "training" ? `Training: ${trainingBoost}.` : `Deployed: ${deployedBoost}.`;
    }
    const aiPanel = document.getElementById("panel-ai");
    if (aiPanel) {
        aiPanel.classList.toggle("ai-mode-training", game.aiMode === "training");
        aiPanel.classList.toggle("ai-mode-deployed", game.aiMode === "deployed");
    }
    const researchCount = document.getElementById("research-count");
    if (researchCount) {
        researchCount.textContent = formatNumberCompact(game.research);
    }
    const researchPerSecEl = document.getElementById("research-per-sec");
    if (researchPerSecEl) {
        const totalResearchRate =
            game.researchPerSec * aiModeOutputBoost * buff.research * RESEARCH_SPEED_BONUS * pacing +
            quantumResearchPerSec;
        researchPerSecEl.textContent = formatNumberFixed(totalResearchRate, 2);
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
        if (slider) slider.value = 1 - game.quantumAllocationToCompute;
        if (allocLabel) {
            const pct = Math.round(game.quantumAllocationToCompute * 100);
            allocLabel.textContent = `${pct}% compute / ${100 - pct}% research`;
        }
        const btn = quantumPanel.querySelector("#btn-buy-quantum-computer");
        if (btn) {
            btn.disabled = game.transistors < quantumCost;
        }
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
        const expRatePct = 0;
        if (sigCount) sigCount.textContent = game.explorationUnlocked ? formatNumberFixed(game.explorationSignals, 2) : "Locked";
        if (sigRate) sigRate.textContent = game.explorationUnlocked ? formatNumberFixed(explorationRate, 2) : "Locked";
        const aiCost = IA_SCAN_AI_BASE * Math.pow(IA_SCAN_AI_GROWTH, game.scanCount);
        const chargeCost = IA_SCAN_CHARGE_BASE * Math.pow(IA_SCAN_CHARGE_GROWTH, game.scanCount);
        const aiCostHyper = aiCost * IA_HYPER_COST_MULT;
        const chargeCostHyper = chargeCost * IA_HYPER_COST_MULT;
        if (scanCostAi) scanCostAi.textContent = game.explorationUnlocked ? formatNumberCompact(aiCost) : "Locked";
        if (scanCostCharge) scanCostCharge.textContent = game.explorationUnlocked ? formatNumberCompact(chargeCost) : "Locked";
        if (hyperCostAi) hyperCostAi.textContent = game.explorationUnlocked ? formatNumberCompact(aiCostHyper) : "Locked";
        if (hyperCostCharge) hyperCostCharge.textContent = game.explorationUnlocked ? formatNumberCompact(chargeCostHyper) : "Locked";
        if (scansDone) scansDone.textContent = game.explorationUnlocked ? game.scanCount : "Locked";
        if (hypersDone) hypersDone.textContent = game.explorationUnlocked ? game.hyperScanCount : "Locked";
        if (percent) percent.textContent = game.explorationUnlocked ? `${game.universeExploredPercent.toFixed(24)}` : "Locked";
        if (rate) rate.textContent = game.explorationUnlocked ? `${expRatePct.toExponential(2)}` : "Locked";
        if (iaCharge) iaCharge.textContent = game.explorationUnlocked ? formatNumberCompact(game.iaCharge) : "Locked";
        if (iaChargeRate) iaChargeRate.textContent = game.explorationUnlocked ? formatNumberCompact(game.iaChargePerSec) : "Locked";
        const btnScan = explorationPanel.querySelector("#btn-scan-sector");
        if (btnScan) {
            btnScan.disabled = !game.explorationUnlocked || game.aiProgress < aiCost || game.iaCharge < chargeCost;
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
            if (game.flags.iaEmergenceAccepted && now < game.flags.iaDebuffEndTime) status = "Debuff";
            if (game.flags.iaEmergenceCompleted) status = "Awakened";
            statusEl.textContent = status;
        }
    }

    document.getElementById("btn-buy-generator").disabled = game.transistors < generatorCost;
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
