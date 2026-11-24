"use strict";

const player = document.getElementById("walkthrough");
const watch = document.getElementById("watch");
watch.hidden = false;
watch.addEventListener("click", async () => {
    if (!player.paused) {
        player.pause();
        return;
    }
    try {
        await player.play();
        player.focus();
    } catch {
        player.focus();
    }
});
function updateButton() {
    if (player.ended) watch.textContent = "Watch again";
    else watch.textContent = player.paused ? "Watch walkthrough" : "Pause walkthrough";
}
for (const event of ["play", "pause", "ended"]) player.addEventListener(event, updateButton);