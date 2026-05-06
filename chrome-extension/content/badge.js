(function () {
  const BADGE_ID = "aica-floating-credibility-badge";
  const STORAGE_KEY = "aicaFloatingBadgePosition";

  function renderBadge(payload = {}) {
    removeBadge();

    const badge = document.createElement("div");
    badge.id = BADGE_ID;
    badge.className = `aica-floating-badge aica-floating-badge--${riskClass(payload.riskLevel)}`;
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-live", "polite");

    const grip = document.createElement("div");
    grip.className = "aica-floating-badge__grip";
    grip.setAttribute("aria-hidden", "true");

    const content = document.createElement("div");
    content.className = "aica-floating-badge__content";

    const label = document.createElement("span");
    label.className = "aica-floating-badge__label";
    label.textContent = payload.label || "Credibility";

    const value = document.createElement("strong");
    value.className = "aica-floating-badge__value";
    value.textContent = badgeValue(payload);

    const meta = document.createElement("span");
    meta.className = "aica-floating-badge__meta";
    meta.textContent = badgeMeta(payload);

    const closeButton = document.createElement("button");
    closeButton.className = "aica-floating-badge__close";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Dismiss credibility badge");
    closeButton.textContent = "x";
    closeButton.addEventListener("click", () => {
      removeBadge();
    });

    content.append(label, value, meta);
    badge.append(grip, content, closeButton);
    document.documentElement.appendChild(badge);
    restorePosition(badge);
    attachDragBehavior(badge, grip);

    return { ok: true };
  }

  function removeBadge() {
    const existing = document.getElementById(BADGE_ID);
    if (existing) {
      existing.remove();
    }
    return { ok: true };
  }

  function attachDragBehavior(badge, handle) {
    let dragState = null;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const rect = badge.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
      badge.classList.add("aica-floating-badge--dragging");
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragState) {
        return;
      }

      const x = clamp(event.clientX - dragState.offsetX, 8, window.innerWidth - badge.offsetWidth - 8);
      const y = clamp(event.clientY - dragState.offsetY, 8, window.innerHeight - badge.offsetHeight - 8);
      setPosition(badge, x, y);
    });

    handle.addEventListener("pointerup", (event) => {
      if (!dragState) {
        return;
      }

      dragState = null;
      badge.classList.remove("aica-floating-badge--dragging");
      try {
        handle.releasePointerCapture(event.pointerId);
      } catch (_error) {
        // Pointer capture may already be released when the pointer leaves the page.
      }
      savePosition(badge);
    });

    window.addEventListener("resize", () => {
      const rect = badge.getBoundingClientRect();
      setPosition(
        badge,
        clamp(rect.left, 8, window.innerWidth - badge.offsetWidth - 8),
        clamp(rect.top, 8, window.innerHeight - badge.offsetHeight - 8)
      );
      savePosition(badge);
    });
  }

  function restorePosition(badge) {
    const saved = readPosition();
    if (saved) {
      setPosition(
        badge,
        clamp(saved.x, 8, window.innerWidth - badge.offsetWidth - 8),
        clamp(saved.y, 8, window.innerHeight - badge.offsetHeight - 8)
      );
      return;
    }

    badge.style.top = "16px";
    badge.style.right = "16px";
  }

  function setPosition(badge, x, y) {
    badge.style.left = `${Math.round(x)}px`;
    badge.style.top = `${Math.round(y)}px`;
    badge.style.right = "auto";
  }

  function savePosition(badge) {
    const rect = badge.getBoundingClientRect();
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          x: Math.round(rect.left),
          y: Math.round(rect.top)
        })
      );
    } catch (_error) {
      // Session storage can be disabled on some pages.
    }
  }

  function readPosition() {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function badgeValue(payload) {
    if (payload.error) {
      return "Unavailable";
    }
    return String(payload.riskLevel || "UNKNOWN");
  }

  function badgeMeta(payload) {
    if (payload.error) {
      return "Retry from popup";
    }
    const score = Number(payload.score);
    if (!Number.isFinite(score)) {
      return payload.mode === "selection" ? "Selected text" : "Page analysis";
    }
    const scope = payload.mode === "selection" ? "selection" : "page";
    return `${Math.round(score * 100)}% | ${scope}`;
  }

  function riskClass(riskLevel) {
    const risk = String(riskLevel || "").toLowerCase();
    if (risk === "low" || risk === "medium" || risk === "high") {
      return risk;
    }
    return "unknown";
  }

  function clamp(value, min, max) {
    if (!Number.isFinite(max) || max < min) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  window.AICAFloatingBadge = {
    renderBadge,
    removeBadge
  };
})();
