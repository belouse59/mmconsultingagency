/**
 * features/whatsapp/whatsapp.js
 * WhatsApp floating widget:
 *   - Toggle chat panel on float button click/keypress
 *   - Auto-opens after 6 s if the user hasn't interacted
 *   - Sends message to WhatsApp web via wa.me link
 *   - Enter to send, Shift+Enter for newline
 *   - Auto-resizes textarea as user types
 *   - Exposes window.sendToWhatsApp for the HTML onclick attribute
 */

import { $, $$ } from "../../core/dom.js";

export function initWhatsApp() {
  // Elements
  const input = document.getElementById("userMessage");
  const whatsappFloat = $(".wa-float");
  const whatsappCloseBtn = $(".wa-chat-close");
  const quickActionsBtns = $$(".wa-quick-actions button");
  const quickActions = $(".wa-quick-actions");
  const submitChatBtn = $(".wa-send-btn");
  const chat = document.getElementById("whatsappChat");

  // State
  let selectedMessage = "";
  let userInteracted = false;
  let inactivityTimer;
  let chatAlreadyOpened = false;
  let hasEngaged = false;

  // ==========================
  // TEXTAREA BEHAVIOR
  // ==========================

  // Auto-resize textarea
  input.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = this.scrollHeight + "px";
    if (input.value.trim() === "") quickActions.style.display = "flex";
  });

  // Enter = send / Shift+Enter = newline
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      if (event.shiftKey) return;

      event.preventDefault();

      if (input.value.trim() !== "") {
        sendToWhatsApp();
      }
    }
  });

  // ==========================
  // CHAT OPEN / CLOSE
  // ==========================

  function openChat() {
    chat.classList.add("active");
    userInteracted = true;
  }

  function toggleChat() {
    userInteracted = true;
    clearTimeout(inactivityTimer);
    chat.classList.toggle("active");
  }

  // Buttons
  whatsappFloat.addEventListener("click", toggleChat);
  whatsappCloseBtn.addEventListener("click", toggleChat);
  submitChatBtn.addEventListener("click", sendToWhatsApp);

  // ==========================
  // QUICK ACTIONS
  // ==========================

  quickActionsBtns.forEach(button => {
    button.addEventListener("click", selectPrompt);
  });

  function selectPrompt(e) {
    const origin = e.currentTarget.id.split("|")[1];

    switch (origin) {
      case "QuantoPossoRisparmiare":
        selectedMessage =
          "Ciao, vorrei sapere quanto posso risparmiare sulla mia bolletta luce e gas.";
        break;

      case "InviareBolletta":
        selectedMessage =
          "Ciao, vorrei ricevere un'analisi della mia bolletta per capire se posso risparmiare.";
        break;

      case "ContattoRapido":
        selectedMessage =
          "Ciao, vorrei parlare con un consulente per ricevere maggiori informazioni.";
        break;

      default:
        selectedMessage = "Ciao, vorrei ricevere maggiori informazioni.";
        break;
    }

    input.value = selectedMessage;
    input.focus();

    quickActions.style.display = "none";

    input.style.height = "auto";
    input.style.height = input.scrollHeight + "px";
  }

  // ==========================
  // SEND TO WHATSAPP
  // ==========================

  function sendToWhatsApp() {
    const phoneNumber = "34667218526"; // no "+"
    const finalMessage =
      input.value.trim() ||
      selectedMessage ||
      "Buongiorno, vorrei ricevere informazioni.";

    const url =
      `https://wa.me/${phoneNumber}?text=${encodeURIComponent(finalMessage)}`;

    window.open(url, "_blank");

    // Reset input
    input.value = "";
    input.style.height = "auto";
    quickActions.style.display = "flex";
    toggleChat();
  }

  // ==========================
  // IDLE POPUP LOGIC
  // ==========================

  // Detect engagement after scroll
  window.addEventListener("scroll", () => {
    const scrollPercent =
      window.scrollY / (document.body.scrollHeight - window.innerHeight);

    if (scrollPercent > 0.25) {
      hasEngaged = true;
    }
  });

  // Open chat after inactivity
  function openChatOnIdle() {
    if (
      chatAlreadyOpened ||
      userInteracted ||
      !hasEngaged
    ) return;

    openChat();
    chatAlreadyOpened = true;

    sessionStorage.setItem("chatShown", "true");
    removeActivityListeners();
  }

  // Reset inactivity timer
  function resetIdleTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(openChatOnIdle, 18000); // 18 sec
  }

  // Any activity resets timer
  function handleActivity() {
    resetIdleTimer();
  }

  // Register activity listeners
  function addActivityListeners() {
    [
      "mousemove",
      "scroll",
      "click",
      "keydown",
      "touchstart"
    ].forEach(eventName => {
      window.addEventListener(eventName, handleActivity, {
        passive: true
      });
    });
  }

  // Remove listeners once popup shown
  function removeActivityListeners() {
    [
      "mousemove",
      "scroll",
      "click",
      "keydown",
      "touchstart"
    ].forEach(eventName => {
      window.removeEventListener(eventName, handleActivity);
    });
  }

  // Init popup logic only once per session
  if (!sessionStorage.getItem("chatShown")) {
    addActivityListeners();
    resetIdleTimer();
  }

}
