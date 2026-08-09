import { db } from "../firebase-config.js";
import {
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  arrayUnion,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { state, userName, escapeHtml, toast } from "../modules/core.js";

export function renderChat(container) {
  container.innerHTML = `
    <div class="section-title">💬 الدردشة العامة</div>
    <div class="glass-card card" style="display:flex;flex-direction:column;height:65vh;">
      <div id="chat-messages" style="flex:1;overflow-y:auto;padding:6px;display:flex;flex-direction:column;gap:8px;"></div>
      <div class="field-row" style="margin-top:12px;">
        <input id="chat-input" placeholder="اكتب رسالة..." style="flex:1;" />
        <button class="btn btn-primary" id="chat-send">إرسال</button>
      </div>
    </div>
  `;

  const ref = doc(db, "generalChat", "main");
  const unsub = onSnapshot(ref, (snap) => {
    const messages = snap.exists() ? snap.data().messages || [] : [];
    renderMessages(messages);
  });

  container.querySelector("#chat-send").addEventListener("click", sendMessage);
  container.querySelector("#chat-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  async function sendMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    try {
      const snap = await getDoc(ref);
      const msg = { senderId: state.user.uid, text, timestamp: Date.now() };
      if (snap.exists()) {
        await updateDoc(ref, { messages: arrayUnion(msg) });
      } else {
        await setDoc(ref, { messages: [msg] });
      }
    } catch (err) {
      console.error(err);
      toast("تعذّر إرسال الرسالة", "error");
    }
  }

  return unsub;
}

function renderMessages(messages) {
  const host = document.getElementById("chat-messages");
  if (!host) return;
  host.innerHTML = messages
    .map((m) => {
      const mine = m.senderId === state.user?.uid;
      return `
      <div style="align-self:${mine ? "flex-start" : "flex-end"};max-width:70%;">
        <div class="glass-card" style="padding:8px 12px;${mine ? "border-color:rgba(46,230,255,0.4);" : ""}">
          <div style="font-size:11px;font-weight:700;color:var(--cyan);">${escapeHtml(userName(m.senderId))}</div>
          <div style="font-size:13.5px;">${escapeHtml(m.text)}</div>
          <div style="font-size:10px;" class="text-muted">${new Date(m.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
      </div>`;
    })
    .join("");
  host.scrollTop = host.scrollHeight;
}
