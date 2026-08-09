// ============================================================
// GR Spektrumm Tools — Prayer Times Widget (Aladhan API, Cairo)
// method=5 => Egyptian General Authority of Survey
// ============================================================
const CACHE_KEY = "gr_prayer_times_cache_v1";
const NAMES = {
  Fajr: "الفجر",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};
const ORDER = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

async function fetchTimings() {
  const today = new Date();
  const cacheRaw = localStorage.getItem(CACHE_KEY);
  if (cacheRaw) {
    try {
      const cache = JSON.parse(cacheRaw);
      if (cache.date === today.toDateString()) return cache.timings;
    } catch (e) {
      /* ignore parse errors, refetch */
    }
  }
  const url = `https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Prayer times fetch failed");
  const json = await res.json();
  const timings = json.data.timings;
  localStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ date: today.toDateString(), timings })
  );
  return timings;
}

function parseTimeToday(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function getNextPrayer(timings) {
  const now = new Date();
  for (const key of ORDER) {
    const t = parseTimeToday(timings[key]);
    if (t > now) return { key, time: t };
  }
  // All passed today -> next is tomorrow's Fajr
  const t = parseTimeToday(timings["Fajr"]);
  t.setDate(t.getDate() + 1);
  return { key: "Fajr", time: t, tomorrow: true };
}

function formatCountdown(ms) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

export async function mountPrayerWidget(container) {
  container.innerHTML = `<div class="prayer-widget"><span class="prayer-loading">جارِ تحميل مواقيت الصلاة…</span></div>`;
  let timings;
  try {
    timings = await fetchTimings();
  } catch (err) {
    container.innerHTML = `<div class="prayer-widget prayer-error">تعذّر تحميل مواقيت الصلاة</div>`;
    return () => {};
  }

  container.innerHTML = `
    <div class="prayer-widget">
      <div class="prayer-list">
        ${ORDER.map(
          (k) => `<span class="prayer-item" data-key="${k}">${NAMES[k]} <b>${timings[k]}</b></span>`
        ).join("")}
      </div>
      <div class="prayer-next">
        <span class="prayer-next-label">القادمة: <b id="pw-next-name"></b></span>
        <span class="prayer-countdown" id="pw-countdown"></span>
      </div>
    </div>`;

  function tick() {
    const { key, time } = getNextPrayer(timings);
    const nameEl = container.querySelector("#pw-next-name");
    const cdEl = container.querySelector("#pw-countdown");
    if (nameEl) nameEl.textContent = NAMES[key];
    if (cdEl) cdEl.textContent = formatCountdown(time - new Date());
    container.querySelectorAll(".prayer-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.key === key);
    });
  }
  tick();
  const interval = setInterval(tick, 1000);
  return () => clearInterval(interval);
}
