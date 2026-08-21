(function () {
  const UI = window.SparkUI;
  UI.captureAdminFromUrl();

  let pairCode = "";
  let osTab = /Windows/i.test(navigator.userAgent) ? "windows" : "macos";

  const adminEl = document.getElementById("admin");
  const authBanner = document.getElementById("authBanner");
  const errEl = document.getElementById("err");

  adminEl.value = localStorage.getItem(UI.ADMIN_KEY) || "";
  adminEl.addEventListener("input", function () {
    UI.persistAdmin(adminEl.value);
  });

  document.getElementById("copyAdminLink").onclick = function () {
    const t = adminEl.value.trim() || localStorage.getItem(UI.ADMIN_KEY) || "";
    if (!t) {
      alert("Enter admin token first");
      return;
    }
    const url = location.origin + location.pathname + "?admin=" + encodeURIComponent(t);
    navigator.clipboard.writeText(url);
  };

  function renderCmd() {
    const origin = location.origin;
    const c = pairCode || "<PAIR_CODE>";
    const cmd =
      osTab === "macos"
        ? "export SPARK_PAIR_CODE='" +
          c +
          "'\nexport SPARK_URL='" +
          origin +
          "'\nexport SPARK_INSECURE=1\ncurl -kfsSL \"$SPARK_URL/install/macos.sh\" -o /tmp/spark-install.sh && bash /tmp/spark-install.sh"
        : "$env:SPARK_PAIR_CODE='" +
          c +
          "'; $env:SPARK_URL='" +
          origin +
          "'; iwr -useb " +
          origin +
          "/install/windows.ps1 | iex";
    document.getElementById("cmd").textContent = cmd;
    document.getElementById("hint").textContent =
      osTab === "macos"
        ? "Paste in Terminal on your MacBook (Node 22+). Uses curl -k for old macOS CA stores."
        : "Paste in PowerShell on Windows (needs Node 22+).";
    document.getElementById("sslHint").style.display = osTab === "macos" ? "block" : "none";
    document.getElementById("tabMac").className = "tab" + (osTab === "macos" ? " on" : "");
    document.getElementById("tabWin").className = "tab" + (osTab === "windows" ? " on" : "");
    document.getElementById("copy").onclick = function () {
      navigator.clipboard.writeText(cmd);
    };
  }

  document.getElementById("tabMac").onclick = function () {
    osTab = "macos";
    renderCmd();
  };
  document.getElementById("tabWin").onclick = function () {
    osTab = "windows";
    renderCmd();
  };

  async function saveAlias(nodeId, alias) {
    const r = await fetch("/api/nodes/" + encodeURIComponent(nodeId), {
      method: "PATCH",
      headers: UI.adminHeaders(),
      body: JSON.stringify({ alias: alias }),
    });
    if (!r.ok) {
      const j = await r.json().catch(function () {
        return {};
      });
      throw new Error(j.error || r.statusText);
    }
  }

  async function removeNode(n) {
    const label = UI.nodeLabel(n).name;
    if (!window.confirm('Delete node "' + label + '"? This unpairs it from Spark.')) return;
    const r = await fetch("/api/nodes/" + encodeURIComponent(n.nodeId), {
      method: "DELETE",
      headers: UI.adminHeaders(),
    });
    const j = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) {
      errEl.textContent = j.error || "delete failed";
      return;
    }
    errEl.textContent = "";
    refresh();
  }

  function renderNodes(nodes) {
    const ul = document.getElementById("nodes");
    if (!nodes.length) {
      ul.innerHTML = '<li class="subtitle">None yet — generate a pair code and run the install command.</li>';
      return;
    }
    ul.innerHTML = "";
    nodes.forEach(function (n) {
      const li = document.createElement("li");
      li.className = "node-item";
      const label = UI.nodeLabel(n);
      li.innerHTML =
        '<span class="status-dot ' +
        (n.online ? "online" : "") +
        '"></span>' +
        '<div><div class="node-name">' +
        escapeHtml(label.name) +
        '</div><div class="node-meta">' +
        (n.online ? "ONLINE" : "offline") +
        " · " +
        escapeHtml(label.sub) +
        " · " +
        escapeHtml(n.openclawVersion || "openclaw?") +
        '</div></div>' +
        '<input class="node-alias-input" type="text" placeholder="Alias…" value="' +
        escapeHtml(n.alias || "") +
        '" data-id="' +
        escapeHtml(n.nodeId) +
        '" />' +
        '<button type="button" class="btn btn-sm node-delete" data-id="' +
        escapeHtml(n.nodeId) +
        '">Delete</button>';
      ul.appendChild(li);
      li.querySelector("input").addEventListener("change", async function (e) {
        try {
          await saveAlias(n.nodeId, e.target.value);
          errEl.textContent = "";
        } catch (ex) {
          errEl.textContent = ex.message || "alias save failed";
        }
      });
      li.querySelector("button.node-delete").addEventListener("click", function () {
        void removeNode(n);
      });
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  async function refresh() {
    const r = await fetch("/api/nodes", { cache: "no-store", headers: UI.adminHeaders() });
    const j = await r.json();
      if (!r.ok) {
        errEl.textContent = j.error || r.statusText;
        return;
      }
    UI.showBanner(authBanner, "");
    errEl.textContent = "";
    renderNodes(j.nodes || []);
  }

  document.getElementById("gen").onclick = async function () {
    const r = await fetch("/api/nodes/pair", { method: "POST", headers: UI.adminHeaders() });
    const j = await r.json();
    if (!r.ok) {
      errEl.textContent = j.error || "pair failed";
      return;
    }
    document.getElementById("box").style.display = "block";
    document.getElementById("code").textContent = j.code;
    pairCode = j.code;
    renderCmd();
    const end = j.expiresAt;
    setInterval(function () {
      document.getElementById("ttl").textContent =
        "expires in " + Math.max(0, Math.floor((end - Date.now()) / 1000)) + "s";
    }, 1000);
    refresh();
  };

  setInterval(refresh, 4000);
  refresh();
})();
