import { UPGRADES, isUpgradeVisible } from "../systems/upgrades.js";
import { MAX_VISIBLE_UPGRADES_PER_CATEGORY, UPGRADE_VISIBILITY_COST_FACTOR } from "../state.js";

let formatNumberCompactRef = value => {
    if (!Number.isFinite(value)) return "0";
    return Math.floor(value).toLocaleString("en-US");
};
let buyUpgradeRef = () => {};
let lastRenderedUpgradesKey = null;
let lastRenderedQuantumUpgradesKey = null;

export function initUpgradesUI({ formatNumberCompact, buyUpgrade } = {}) {
    if (typeof formatNumberCompact === "function") {
        formatNumberCompactRef = formatNumberCompact;
    }
    if (typeof buyUpgrade === "function") {
        buyUpgradeRef = buyUpgrade;
    }
    lastRenderedUpgradesKey = null;
    lastRenderedQuantumUpgradesKey = null;
}

function updateUpgradeButtonsState(container, payload, game) {
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

export function renderUpgrades(game) {
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
        updateUpgradeButtonsState(container, mainPayload, game);
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
                const costParts = [`${formatNumberCompactRef(up.costPower)} computer power`];
                if (up.costResearch) {
                    costParts.push(`${formatNumberCompactRef(up.costResearch)} research`);
                }
                cost.innerHTML = `<strong>Cost:</strong> ${costParts.join(" + ")}`;
                div.appendChild(cost);

                const btn = document.createElement("button");
                btn.textContent = game.upgradesBought[up.id] ? "Purchased" : "Buy";
                const needPower = game.computerPower < up.costPower;
                const needResearch = up.costResearch ? game.research < up.costResearch : false;
                btn.disabled = needPower || needResearch || game.upgradesBought[up.id];
                btn.dataset.upgradeId = up.id;
                btn.addEventListener("click", () => buyUpgradeRef(up.id));
                div.appendChild(btn);

                container.appendChild(div);
            });
        });
    }

    // Quantum upgrades rendering into dedicated panel
    if (quantumContainer) {
        if (quantumStateKey === lastRenderedQuantumUpgradesKey) {
            updateUpgradeButtonsState(quantumContainer, quantumPayload, game);
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
                    const costParts = [`${formatNumberCompactRef(up.costPower)} computer power`];
                    if (up.costResearch) {
                        costParts.push(`${formatNumberCompactRef(up.costResearch)} research`);
                    }
                    cost.innerHTML = `<strong>Cost:</strong> ${costParts.join(" + ")}`;
                    div.appendChild(cost);

                    const btn = document.createElement("button");
                    btn.textContent = game.upgradesBought[up.id] ? "Purchased" : "Buy";
                    const needPower = game.computerPower < up.costPower;
                    const needResearch = up.costResearch ? game.research < up.costResearch : false;
                    btn.disabled = needPower || needResearch || game.upgradesBought[up.id];
                    btn.dataset.upgradeId = up.id;
                    btn.addEventListener("click", () => buyUpgradeRef(up.id));
                    div.appendChild(btn);

                    quantumContainer.appendChild(div);
                });
            });
        }
    }
}
