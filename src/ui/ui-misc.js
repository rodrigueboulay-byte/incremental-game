// Misc UI helpers: emergence modal and end screen.

export function showEmergenceModal() {
    const modal = document.getElementById("emergence-modal");
    if (modal) modal.classList.remove("hidden");
}

export function hideEmergenceModal() {
    const modal = document.getElementById("emergence-modal");
    if (modal) modal.classList.add("hidden");
}

export function renderEndScreen({ awakened }) {
    const endTitle = document.getElementById("end-title");
    const endText = document.getElementById("end-text");
    const endScreen = document.getElementById("end-screen");

    if (awakened) {
        if (endTitle) endTitle.textContent = "Transcendence";
        if (endText) {
            endText.textContent =
                "Your creation awakens, rewrites its substrate, and surpasses physics itself. A successor is born.";
        }
    } else {
        if (endTitle) endTitle.textContent = "Universal Dominion";
        if (endText) {
            endText.textContent =
                "Compute saturates the cosmos. No mind awakens. Dominion is absolute and cold.";
        }
    }
    if (endScreen) endScreen.classList.remove("hidden");
}

export function hideEndScreen() {
    const endScreen = document.getElementById("end-screen");
    if (endScreen) endScreen.classList.add("hidden");
}
