(function () {
  const UI = window.SparkUI;
  UI.captureAdminFromUrl();

  const log = document.getElementById("log");
  const errEl = document.getElementById("err");
  const authBanner = document.getElementById("authBanner");
  const nodeSel = document.getElementById("node");
  const nodeCards = document.getElementById("nodeCards");
  const adminEl = document.getElementById("admin");

  adminEl.value = localStorage.getItem(UI.ADMIN_KEY) || "";
  adminEl.addEventListener("input", function () {
    UI.persistAdmin(adminEl.value);
  });

  function add(role, text) {
    const d = document.createElement("div");
    d.className = "msg " + (role === "user" ? "user" : "bot");
    const b = document.createElement("div");
    b.className = "bubble";
    b.textContent = text;
    d.appendChild(b);
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return b;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function renderCards(nodes, selectedId) {
    if (!nodes.length) {
      nodeCards.innerHTML =
        '<p class="subtitle">还没有登记过的电脑。去 <a href="/deploy">/deploy</a> 配对后，任意电脑打开本页都能看到。</p>';
      return;
    }
    nodeCards.innerHTML = "";
    nodes.forEach(function (n) {
      const label = UI.nodeLabel(n);
      const card = document.createElement("div");
      card.className =
        "node-item pickable" + (n.nodeId === selectedId ? " selected" : "");
      card.innerHTML =
        '<span class="status-dot ' +
        (n.online ? "online" : "") +
        '"></span>' +
        "<div><div class=\"node-name\">" +
        escapeHtml(label.name) +
        '</div><div class="node-meta">' +
        (n.online ? "ONLINE" : "offline") +
        " · " +
        escapeHtml(n.platform || "") +
        (label.sub ? " · " + escapeHtml(label.sub) : "") +
        "</div></div>";
      card.onclick = function () {
        nodeSel.value = n.nodeId;
        renderCards(nodes, n.nodeId);
      };
      nodeCards.appendChild(card);
    });
  }

  async function refresh() {
    const r = await fetch("/api/nodes", { cache: "no-store", headers: UI.adminHeaders() });
    const j = await r.json();
    if (!r.ok) {
      errEl.textContent = j.error || "cannot list nodes";
      return;
    }
    UI.showBanner(authBanner, "");
    errEl.textContent = "";
    const nodes = j.nodes || [];
    const cur = nodeSel.value;
    nodeSel.innerHTML =
      nodes
        .map(function (n) {
          const label = UI.nodeLabel(n);
          return (
            '<option value="' +
            n.nodeId +
            '">' +
            (n.online ? "● " : "○ ") +
            label.name +
            "</option>"
          );
        })
        .join("") || '<option value="">(none)</option>';
    if (cur && nodes.some(function (n) { return n.nodeId === cur; })) {
      nodeSel.value = cur;
    } else {
      const online = nodes.find(function (n) {
        return n.online;
      });
      nodeSel.value = (online || nodes[0] || {}).nodeId || "";
    }
    renderCards(nodes, nodeSel.value);
  }

  document.getElementById("f").onsubmit = async function (e) {
    e.preventDefault();
    const message = document.getElementById("m").value.trim();
    if (!message) return;
    document.getElementById("m").value = "";
    add("user", message);
    const bubble = add("bot", "…");
    try {
      const r = await fetch("/api/control/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: UI.adminHeaders(),
        body: JSON.stringify({ message: message, nodeId: nodeSel.value || undefined }),
      });
      await UI.parseSseChat(
        r,
        function (acc) {
          bubble.textContent = acc || "…";
        },
        function (acc) {
          bubble.textContent = acc || "(empty)";
        },
        function (err) {
          bubble.textContent = "Error: " + err;
        }
      );
    } catch (ex) {
      bubble.textContent = "Error: " + (ex.message || ex);
    }
  };

  setInterval(refresh, 4000);
  refresh();
})();
