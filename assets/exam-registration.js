(() => {
  "use strict";

  const form = document.getElementById("exam-registration");
  if (!form) return;

  const sessionsFieldset = document.getElementById("exam-sessions");
  const status = document.getElementById("exam-availability-status");
  const error = document.getElementById("exam-error");
  const retry = document.getElementById("exam-retry");
  const submit = document.getElementById("exam-submit");
  const paymentRetry = document.getElementById("exam-payment-retry");
  const paymentLink = document.getElementById("exam-payment-link");
  const radios = Array.from(form.querySelectorAll("[data-session-date]"));
  const fields = {
    studentName: form.elements.namedItem("studentName"),
    parentEmail: form.elements.namedItem("parentEmail"),
    parentPhone: form.elements.namedItem("parentPhone"),
    school: form.elements.namedItem("school"),
    schoolClass: form.elements.namedItem("schoolClass"),
    consent: form.elements.namedItem("consent")
  };
  const expectedSessions = new Map([
    ["2026-11-20", { start: "12:30", end: "15:00" }],
    ["2026-11-21", { start: "10:00", end: "12:30" }],
    ["2026-11-22", { start: "10:00", end: "12:30" }]
  ]);
  const defaultSubmitText = "Записаться и перейти к оплате — 2 000 ₽";
  const idempotencyKeys = new Map();
  let sessions = new Map();
  let loading = false;
  let submitting = false;
  let redirecting = false;
  let ready = false;
  let latestLoad = 0;
  let apiBase;

  function setError(message) {
    error.textContent = message || "";
    error.hidden = !message;
  }

  function syncControls() {
    sessionsFieldset.disabled = !ready || loading || submitting;
    radios.forEach((radio) => {
      const session = sessions.get(radio.dataset.sessionDate);
      radio.disabled = !ready || loading || submitting || !session || session.remaining === 0;
    });
    Object.values(fields).forEach((field) => { field.disabled = submitting; });
    const hasPlaces = Array.from(sessions.values()).some((session) => session.remaining > 0);
    submit.disabled = !ready || loading || submitting || !hasPlaces;
    retry.disabled = loading || submitting;
    form.setAttribute("aria-busy", String(submitting));
    submit.textContent = submitting ? "Создаём запись…" : defaultSubmitText;
  }

  function remainingLabel(value) {
    if (value === 0) return "Мест нет";
    const lastTwo = value % 100;
    const last = value % 10;
    const word = lastTwo >= 11 && lastTwo <= 14 ? "мест" : last === 1 ? "место" : last >= 2 && last <= 4 ? "места" : "мест";
    return `Осталось ${value} ${word}`;
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${apiBase}${path}`, {
        ...options,
        headers: { Accept: "application/json", ...options.headers },
        credentials: "omit",
        cache: "no-store",
        signal: controller.signal
      });
      const text = await response.text();
      let data = null;
      try { data = JSON.parse(text); } catch (_) { /* The caller handles an unavailable or invalid response. */ }
      return { ok: response.ok, status: response.status, data };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function verifiedSessions(data) {
    if (!data || data.priceRub !== 2000 || !Array.isArray(data.sessions)) throw new Error("invalid-schedule");
    const result = new Map();
    const ids = new Set();
    for (const session of data.sessions) {
      const expected = expectedSessions.get(session.date);
      if (!expected) continue;
      if (result.has(session.date) || typeof session.id !== "string" || !session.id.trim() || session.id.length > 120 || ids.has(session.id) || session.start !== expected.start || session.end !== expected.end || session.capacity !== 18 || !Number.isInteger(session.remaining) || session.remaining < 0 || session.remaining > session.capacity) {
        throw new Error("invalid-schedule");
      }
      result.set(session.date, session);
      ids.add(session.id);
    }
    if (result.size !== expectedSessions.size) throw new Error("incomplete-schedule");
    return result;
  }

  async function loadSessions() {
    const loadId = ++latestLoad;
    loading = true;
    ready = false;
    status.textContent = "Загружаем доступные места…";
    retry.hidden = true;
    radios.forEach((radio) => {
      document.getElementById(radio.getAttribute("aria-describedby")).textContent = "Проверяем наличие мест…";
    });
    syncControls();
    try {
      const response = await request("/sessions");
      if (!response.ok) throw new Error("schedule-unavailable");
      const nextSessions = verifiedSessions(response.data);
      if (loadId !== latestLoad) return;
      sessions = nextSessions;
      ready = true;
      radios.forEach((radio) => {
        const session = sessions.get(radio.dataset.sessionDate);
        radio.value = session.id;
        if (session.remaining === 0) radio.checked = false;
        document.getElementById(radio.getAttribute("aria-describedby")).textContent = remainingLabel(session.remaining);
      });
      const hasPlaces = Array.from(sessions.values()).some((session) => session.remaining > 0);
      status.textContent = hasPlaces ? "Наличие мест проверено. Выберите удобную дату." : "Все места на указанные даты заняты.";
      retry.hidden = hasPlaces;
      retry.textContent = hasPlaces ? "Повторить проверку" : "Обновить наличие мест";
    } catch (_) {
      if (loadId !== latestLoad) return;
      ready = false;
      sessions = new Map();
      status.textContent = "Сейчас не удаётся проверить свободные места. Попробуйте ещё раз.";
      radios.forEach((radio) => {
        radio.checked = false;
        radio.value = "";
        document.getElementById(radio.getAttribute("aria-describedby")).textContent = "Наличие мест пока неизвестно";
      });
      retry.textContent = "Повторить проверку";
      retry.hidden = false;
    } finally {
      if (loadId === latestLoad) {
        loading = false;
        syncControls();
      }
    }
  }

  function newIdempotencyKey() {
    if (typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    const bytes = window.crypto.getRandomValues(new Uint8Array(24));
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function verifiedPaymentUrl(value) {
    if (typeof value !== "string" || value.length > 4096) throw new Error("invalid-payment-url");
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowedHost = host === "pay.tbank-online.com" || host === "paylink.tbank-online.com" || ["tbank.ru", "tinkoff.ru"].some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (url.protocol !== "https:" || !allowedHost || url.username || url.password || (url.port && url.port !== "443")) throw new Error("invalid-payment-url");
    return url.href;
  }

  function normalizeText(value) {
    return value.trim().replace(/\s+/g, " ");
  }

  function validatePhone() {
    const value = fields.parentPhone.value.trim();
    const digits = value.replace(/\D/g, "");
    const valid = /^[+\d\s()-]+$/.test(value) && digits.length >= 10 && digits.length <= 15;
    fields.parentPhone.setCustomValidity(valid ? "" : "Укажите телефон с кодом страны или города, от 10 до 15 цифр.");
    return valid;
  }

  fields.parentPhone.addEventListener("input", () => {
    fields.parentPhone.setCustomValidity("");
    fields.parentPhone.removeAttribute("aria-invalid");
  });
  Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => field.removeAttribute("aria-invalid"));
  });
  form.addEventListener("input", () => { paymentRetry.hidden = true; });

  retry.addEventListener("click", () => { if (!loading && !submitting) void loadSessions(); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || loading || !ready) return;
    setError("");
    fields.studentName.value = normalizeText(fields.studentName.value);
    fields.parentEmail.value = fields.parentEmail.value.trim();
    fields.parentPhone.value = fields.parentPhone.value.trim();
    validatePhone();
    if (!form.reportValidity()) return;
    const selected = radios.find((radio) => radio.checked);
    const session = selected && sessions.get(selected.dataset.sessionDate);
    if (!session || session.remaining === 0) {
      setError("Выберите дату, на которую есть свободные места.");
      return;
    }
    const payload = {
      sessionId: session.id,
      studentName: fields.studentName.value,
      parentEmail: fields.parentEmail.value,
      parentPhone: fields.parentPhone.value,
      school: normalizeText(fields.school.value),
      schoolClass: normalizeText(fields.schoolClass.value),
      consent: fields.consent.checked
    };
    const fingerprint = JSON.stringify(payload);
    if (!idempotencyKeys.has(fingerprint)) idempotencyKeys.set(fingerprint, newIdempotencyKey());
    const idempotencyKey = idempotencyKeys.get(fingerprint);
    submitting = true;
    syncControls();
    try {
      const response = await request("/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, idempotencyKey })
      });
      if (response.status === 409) {
        setError("На выбранную дату свободных мест больше нет. Выберите другую дату.");
        await loadSessions();
        return;
      }
      if (response.status === 422) {
        setError("Проверьте имя ученика, почту, телефон и согласие на обработку данных, затем отправьте форму ещё раз.");
        return;
      }
      if (response.status === 503) {
        setError("Запись и оплата временно недоступны. Попробуйте ещё раз немного позже.");
        return;
      }
      if (!response.ok) throw new Error("registration-unavailable");
      const data = response.data;
      if (!data || typeof data.registrationId !== "string" || !data.registrationId.trim()) throw new Error("invalid-registration");
      let paymentUrl;
      try {
        paymentUrl = verifiedPaymentUrl(data.paymentUrl);
      } catch (_) {
        setError("Запись создана, но не удалось открыть оплату. Нажмите кнопку ещё раз, чтобы повторить переход.");
        return;
      }
      paymentLink.href = paymentUrl;
      paymentRetry.hidden = false;
      status.textContent = "Заявка зарегистрирована. Открываем страницу оплаты Т-Банка…";
      submit.textContent = "Открываем оплату…";
      redirecting = true;
      window.location.assign(paymentUrl);
    } catch (_) {
      redirecting = false;
      setError("Не удалось получить подтверждение записи. Проверьте соединение и нажмите кнопку ещё раз.");
    } finally {
      if (!redirecting) {
        submitting = false;
        syncControls();
      }
    }
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      redirecting = false;
      submitting = false;
      syncControls();
      void loadSessions();
    }
  });

  try {
    const configured = new URL(form.dataset.apiBase, window.location.origin);
    if (configured.username || configured.password || configured.search || configured.hash || (configured.origin !== window.location.origin && configured.protocol !== "https:")) throw new Error("invalid-api-address");
    apiBase = configured.href.replace(/\/$/, "");
    void loadSessions();
  } catch (_) {
    status.textContent = "Регистрация сейчас недоступна. Попробуйте зайти позже.";
    syncControls();
  }
})();
