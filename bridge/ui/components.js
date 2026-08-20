/** Shared Spark control-plane UI helpers */
(function () {
  const ADMIN_KEY = "spark.admin";

  function persistAdmin(token) {
    const t = (token || "").trim();
    if (t) localStorage.setItem(ADMIN_KEY, t);
    else localStorage.removeItem(ADMIN_KEY);
    const maxAge = t ? 2592000 : 0;
    document.cookie =
      "spark_admin=" +
      encodeURIComponent(t) +
      "; Max-Age=" +
      maxAge +
      "; Path=/; SameSite=Lax";
  }

  function captureAdminFromUrl() {
    const params = new URLSearchParams(location.search);
    const token = params.get("admin")?.trim();
    if (token) {
      persistAdmin(token);
      params.delete("admin");
      const q = params.toString();
      history.replaceState({}, "", location.pathname + (q ? "?" + q : ""));
    } else {
      const existing = localStorage.getItem(ADMIN_KEY) || "";
      if (existing) persistAdmin(existing);
    }
  }

  function adminHeaders(extra) {
    const t = localStorage.getItem(ADMIN_KEY) || "";
    const h = Object.assign({ "content-type": "application/json" }, extra || {});
    if (t) h["x-spark-admin"] = t;
    return h;
  }

  function nodeLabel(n) {
    const name = (n.alias || "").trim() || n.hostname;
    const sub = (n.alias || "").trim() ? n.hostname : n.platform;
    return { name: name, sub: sub };
  }

  function showBanner(el, message) {
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  async function parseSseChat(response, onDelta, onDone, onError) {
    if (!response.ok || !response.body) {
      const j = await response.json().catch(function () {
        return {};
      });
      throw new Error(j.error || "HTTP " + response.status);
    }
    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let acc = "";
    while (true) {
      const doneVal = await reader.read();
      if (doneVal.done) break;
      buf += dec.decode(doneVal.value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const block of parts) {
        const ev = (block.match(/^event: (\w+)/m) || [])[1];
        const dataLine = block.split("\n").find(function (l) {
          return l.startsWith("data: ");
        });
        if (!ev || !dataLine) continue;
        const data = JSON.parse(dataLine.slice(6));
        if (ev === "delta") {
          acc += data.text || "";
          onDelta(acc);
        }
        if (ev === "done") {
          acc = data.text || acc;
          onDone(acc);
        }
        if (ev === "error") {
          onError(data.error || "unknown error");
        }
      }
    }
  }

  window.SparkUI = {
    ADMIN_KEY: ADMIN_KEY,
    persistAdmin: persistAdmin,
    captureAdminFromUrl: captureAdminFromUrl,
    adminHeaders: adminHeaders,
    nodeLabel: nodeLabel,
    showBanner: showBanner,
    parseSseChat: parseSseChat,
  };
})();
