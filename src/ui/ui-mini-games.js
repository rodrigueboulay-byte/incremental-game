// UI helpers for mini-games. Populated and rendered from main with injected dependencies.
let deps = {
    formatDurationSeconds: s => `${s}s`,
    formatDeltaPct: v => `${v}`,
    nowMs: () => Date.now(),
    getGame: () => ({}),
    MINI_GAMES: [],
    CURRICULUM_PROFILES: {},
    ensureProtoAlgoRuntime: () => {},
    getProtoAlgoConfig: () => ({}),
    updateSyntheticHarvest: () => {},
    getSynthHarvestStats: () => ({}),
    collectSyntheticHarvest: () => {},
    ensureQuantumRLRuntime: () => {},
    applyQuantumRLDecision: () => {},
    ensureReadingRuntime: () => {},
    readingCooldownPct: () => 0,
    readingCooldownRemaining: () => 0,
    triggerReadingBurst: () => {},
    ensureAlignmentRuntime: () => {},
    resolveAlignmentScenario: () => {},
    bumpProtoAlgoCycle: () => {},
    getAlignmentRuntime: () => ({}),
    onMiniGameClick: () => {},
    getMiniGameConfig: () => null,
    toggleGridOverlay: () => {},
    savePanelOrder: () => {},
    saveMiniGameOrder: () => {},
    restorePanelOrder: () => {},
    restoreMiniGameOrder: () => {},
    isMiniGameUnlocked: () => false,
    getMiniGameState: () => ({}),
};

let lastRenderedMiniGamesKey = null;

export function initMiniGamesUI(options = {}) {
    deps = { ...deps, ...options };
}

export function resetMiniGamesRenderState() {
    lastRenderedMiniGamesKey = null;
}

export function clearMiniGamesUI() {
    document.querySelectorAll(".mini-game-card").forEach(card => card.remove());
    const container = document.getElementById("mini-games-container");
    if (container) container.innerHTML = "";
}

export function removeLockedMiniGameCards(game) {
    document.querySelectorAll(".mini-game-card").forEach(card => {
        const id = card.dataset.miniId;
        if (!deps.isMiniGameUnlocked(id, game)) {
            card.remove();
        }
    });
    deps.saveMiniGameOrder();
    deps.savePanelOrder();
}

export function setupSortableMiniGames() {
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
            deps.toggleGridOverlay(false);
            deps.savePanelOrder();
            deps.saveMiniGameOrder();
        },
        onStart: () => deps.toggleGridOverlay(true),
    });
}

export function renderMiniGames(game, miniGameState) {
    const stateRef = deps.getMiniGameState ? deps.getMiniGameState() : miniGameState;
    const {
        MINI_GAMES,
        CURRICULUM_PROFILES,
        formatDurationSeconds,
        formatDeltaPct,
        nowMs,
        ensureProtoAlgoRuntime,
        getProtoAlgoConfig,
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
        getAlignmentRuntime,
    } = deps;

    const now = nowMs();
    const unlocked = MINI_GAMES.filter(cfg => game.aiProjectsCompleted[cfg.projectId] || game.projectsCompleted[cfg.projectId]);
    const stateKey = unlocked
        .map(cfg => {
            const state = stateRef[cfg.id] || {};
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
            if (last) last.textContent = game.synthHarvestLastResult || "-";
            const buffEl = panel.querySelector(".synth-buff");
            if (buffEl) {
                if (game.synthHarvestBuffEndTime && now < game.synthHarvestBuffEndTime) {
                    buffEl.textContent = formatDurationSeconds((game.synthHarvestBuffEndTime - now) / 1000);
                } else {
                    buffEl.textContent = "None";
                }
            }
            return;
        } else if (cfg.id === "mg_quantum_rl") {
            ensureQuantumRLRuntime(now);
            const strengthEntry = Object.entries(game.rlLoopStrength || {}).sort((a, b) => b[1] - a[1])[0];
            const strengthLabel = panel.querySelector(".rl-strength-value");
            if (strengthLabel && strengthEntry) {
                strengthLabel.textContent = `${strengthEntry[0]} x${strengthEntry[1].toFixed(2)}`;
            }
            const options = deps.getGame().rlLoopOptions || [];
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
            if (timer && deps.getGame().rlLoopNextDecisionAt) {
                const remaining = Math.max(0, Math.ceil((deps.getGame().rlLoopNextDecisionAt - now) / 1000));
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
            const runtime = getAlignmentRuntime ? getAlignmentRuntime() : {};
            const scenario = runtime.scenario;
            const scenarioText = panel.querySelector(".align-scenario");
            const scoreEl = panel.querySelector(".align-score");
            const bar = panel.querySelector(".align-progress-fill");
            const hist = panel.querySelector(".align-history");
            const btns = panel.querySelectorAll(".align-btn");
            if (scenarioText) scenarioText.textContent = scenario ? scenario.text : "Awaiting next scenario...";
            if (scoreEl) scoreEl.textContent = game.alignmentScore.toFixed(1);
            if (bar && runtime.expiresAt && scenario) {
                const total = runtime.expiresAt - (runtime.startedAt || now);
                const remaining = Math.max(0, runtime.expiresAt - now);
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
        const state = stateRef[cfg.id] || {};
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
            timer.textContent = ready ? `Closes in ${timeToNext}s` : `Next in ${timeToNext}s`;
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

export function createMiniGamePanel({ id, title, description }) {
    const {
        nowMs,
        getGame,
        onMiniGameClick,
        collectSyntheticHarvest,
        applyQuantumRLDecision,
        triggerReadingBurst,
        resolveAlignmentScenario,
        toggleGridOverlay,
        savePanelOrder,
        saveMiniGameOrder,
        restorePanelOrder,
        restoreMiniGameOrder,
    } = deps;

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
                const g = getGame();
                g.protoAlgoRisk = risk;
                deps.ensureProtoAlgoRuntime();
                deps.bumpProtoAlgoCycle();
                renderMiniGames(getGame(), deps.getMiniGameState());
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
                const g = getGame();
                g.curriculumProfile = p.id;
                g.curriculumLastSwitch = nowMs();
                renderMiniGames(getGame(), deps.getMiniGameState());
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
            renderMiniGames(getGame(), deps.getMiniGameState());
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
                    renderMiniGames(getGame(), deps.getMiniGameState());
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
            renderMiniGames(getGame(), deps.getMiniGameState());
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
                renderMiniGames(getGame(), deps.getMiniGameState());
            });
            actions.appendChild(btn);
        });
        panel.appendChild(actions);

        const histWrap = document.createElement("div");
        histWrap.className = "align-history-wrap";
        const titleEl = document.createElement("div");
        titleEl.className = "align-history-title";
        titleEl.textContent = "Last outcomes";
        const list = document.createElement("ul");
        list.className = "align-history";
        histWrap.appendChild(titleEl);
        histWrap.appendChild(list);
        panel.appendChild(histWrap);
    } else {
        const titleEl = document.createElement("h3");
        titleEl.textContent = title;
        placeHandle(titleEl);
        panel.appendChild(titleEl);
        const descEl = document.createElement("p");
        descEl.className = "mini-desc";
        descEl.textContent = description || "";
        panel.appendChild(descEl);

        const status = document.createElement("p");
        status.className = "mini-status";
        status.textContent = "Waiting for next window.";
        panel.appendChild(status);

        const progress = document.createElement("div");
        progress.className = "mini-progress";
        const barFill = document.createElement("div");
        barFill.className = "mini-progress-fill";
        progress.appendChild(barFill);
        panel.appendChild(progress);

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
