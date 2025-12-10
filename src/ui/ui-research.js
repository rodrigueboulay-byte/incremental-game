import { PHASES } from "../state.js";
import {
    PROJECTS,
    AI_PROJECTS,
    getEffectiveProjectCosts,
    isProjectVisible,
    getVisibleProjects,
    getVisibleAIProjects,
} from "../systems/research.js";

let formatNumberCompactRef = v => (Number.isFinite(v) ? Math.floor(v).toLocaleString("en-US") : "0");
let completeProjectRef = () => {};
let buyAIProjectRef = () => {};

let lastRenderedProjectsKey = null;
let lastRenderedAIProjectsKey = null;

export function initResearchUI({ formatNumberCompact, completeProject, buyAIProject } = {}) {
    if (typeof formatNumberCompact === "function") formatNumberCompactRef = formatNumberCompact;
    if (typeof completeProject === "function") completeProjectRef = completeProject;
    if (typeof buyAIProject === "function") buyAIProjectRef = buyAIProject;
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

export function renderProjects(game) {
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

    const visibleProjects = getVisibleProjects(game);
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
                project.costResearch ? `<strong>Cost:</strong> ${formatNumberCompactRef(project.costResearch)} research` : "",
                project.costPower ? `<strong>Cost:</strong> ${formatNumberCompactRef(project.costPower)} computer power` : "",
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
            btn.addEventListener("click", () => completeProjectRef(project.id));
            entry.appendChild(btn);
        }

        container.appendChild(entry);
    });
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

export function renderAIProjects(game) {
    const container = document.getElementById("ai-projects-list");
    if (!container) return;

    const pending = getVisibleAIProjects(game);

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
        if (costAI) costs.push(`${formatNumberCompactRef(costAI)} AI`);
        if (costPower) costs.push(`${formatNumberCompactRef(costPower)} computer power`);
        if (costResearch) costs.push(`${formatNumberCompactRef(costResearch)} research`);
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
        btn.addEventListener("click", () => buyAIProjectRef(project.id));
        entry.appendChild(btn);

        container.appendChild(entry);
    });
}
