// ============================================================
// GR Spektrumm Tools — App Entry Point
// ============================================================
import { state, onStateChange, registerRoute, initRouter } from "./modules/core.js";
import { renderShell } from "./components/shell.js";
import { renderLogin } from "./pages/login.js";
import { renderDashboard } from "./pages/dashboard.js";
import { renderTasks } from "./pages/tasks.js";
import { renderTeam } from "./pages/team.js";
import { renderChat } from "./pages/chat.js";
import { renderTools } from "./pages/tools.js";
import { renderExcel } from "./pages/excel.js";
import { renderSolutions } from "./pages/solutions.js";
import { renderGuides } from "./pages/guides.js";
import { renderSettings } from "./pages/settings.js";
import { renderHelp } from "./pages/help.js";

registerRoute("dashboard", renderDashboard);
registerRoute("tasks", renderTasks);
registerRoute("team", renderTeam, ["admin", "manager"]);
registerRoute("chat", renderChat);
registerRoute("tools", renderTools);
registerRoute("excel", renderExcel);
registerRoute("solutions", renderSolutions);
registerRoute("guides", renderGuides);
registerRoute("settings", renderSettings, ["admin"]);
registerRoute("help", renderHelp);

const root = document.getElementById("root");
const savedTheme = localStorage.getItem("gr_theme");
if (savedTheme) document.documentElement.setAttribute("data-theme", savedTheme);

let shellMounted = false;

onStateChange((s) => {
  if (!s.ready) return;
  if (s.user && s.profile) {
    if (!shellMounted) {
      renderShell(root);
      shellMounted = true;
      initRouter();
    }
  } else {
    shellMounted = false;
    renderLogin(root);
  }
});

// Register service worker for PWA offline shell caching
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("SW registration failed:", err));
  });
}
