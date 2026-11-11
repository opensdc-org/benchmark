"use strict";

(() => {
  const get = id => document.getElementById(id);
  const dataset = get("rank-dataset"), bound = get("rank-bound");
  const metricColumns = new Map(Array.from(document.querySelectorAll("button[data-rank-metric]"),
    button => [button.dataset.rankMetric, button]));
  const buttons = {
    general: get("track-general"),
    domain_specific: get("track-domain_specific"),
    particle: get("track-particle"),
  };
  const query = new URLSearchParams(window.location.search);
  const requestedTrack = query.get("rank_track");
  let data = null, track = Object.hasOwn(buttons, requestedTrack) ? requestedTrack : "general";
  const legacyMetrics = {compress_MB_s:"compress_MiB_s", decompress_MB_s:"decompress_MiB_s"};
  const requestedMetric = query.get("rank_metric");
  const requestedOrder = query.get("rank_order");
  let sortMetric = Object.hasOwn(legacyMetrics, requestedMetric) ? legacyMetrics[requestedMetric] : requestedMetric || "ratio";
  let sortOrder = ["asc", "desc"].includes(requestedOrder) ? requestedOrder : null;
  let initial = {dataset:query.get("rank_dataset"), bound:query.get("rank_bound")};

  function options(select, values, preferred) {
    const previous = select.value;
    select.replaceChildren(...values.map(([value, label]) => new Option(label, value)));
    select.value = values.some(([value]) => value === previous) ? previous : preferred;
  }
  function number(value, key) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    if (value !== 0 && Math.abs(value) < 0.0001) return value.toExponential(2);
    const digits = key === "ssim" || key === "pcc" ? 6 : key === "spectral_l1" || key === "field_acf_delta" ? 5 : 2;
    return new Intl.NumberFormat("en", {maximumFractionDigits: digits}).format(value);
  }
  function nameOfBound(value) { return Number(value).toExponential().toUpperCase(); }
  function cell(row, value, className) {
    const td = row.insertCell(); td.textContent = value;
    if (className) td.className = className;
    return td;
  }
  function updateLinks() {
    const url = new URL(window.location.href);
    url.searchParams.set("rank_track", track);
    url.searchParams.set("rank_dataset", dataset.value);
    url.searchParams.set("rank_bound", bound.value);
    url.searchParams.set("rank_metric", sortMetric);
    if (sortOrder) url.searchParams.set("rank_order", sortOrder);
    else url.searchParams.delete("rank_order");
    url.hash = "leaderboard";
    get("rank-permalink").href = url.toString();
    url.searchParams.set("view_dataset", dataset.value);
    url.searchParams.delete("view_bound");
    url.searchParams.set("view_figure", "rd");
    url.hash = "results";
    get("rank-explore-link").href = url.toString();
  }
  function showEmpty(message) {
    get("rank-body").replaceChildren();
    get("rank-empty").hidden = false;
    get("rank-empty").textContent = message;
    get("rank-context").textContent = "No verified cohort available";
    get("rank-direction").textContent = "";
    get("rank-scroll").hidden = true;
    get("rank-scroll-hint").hidden = true;
    get("rank-explore-link").hidden = true;
    for (const select of [dataset,bound]) select.disabled = true;
    updateLinks();
  }
  function render() {
    for (const [name, button] of Object.entries(buttons)) {
      const active = name === track;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    if (!data) return;
    const groups = data.groups.filter(group => group.protocol.track === track);
    get("experiment-hardware").hidden = !groups.length;
    if (!groups.length) {
      const subject = track === "particle" ? "particle compressors" : "domain-specific compressors";
      showEmpty("No verified " + subject + " have been published yet. Register an adapter and submit an auditable result to create this track.");
      initial = null;
      return;
    }
    get("rank-empty").hidden = true;
    get("rank-scroll").hidden = false;
    get("rank-scroll-hint").hidden = false;
    get("rank-explore-link").hidden = false;
    for (const select of [dataset,bound]) select.disabled = false;
    const names = data.datasets.filter(name => groups.some(group => group.protocol.dataset === name));
    options(dataset,names.map(name => [name,name]),names.includes("NYX") ? "NYX" : names[0]);
    if (initial && names.includes(initial.dataset)) dataset.value = initial.dataset;
    const bounds = [...new Set(groups.filter(g => g.protocol.dataset === dataset.value).map(g => g.protocol.alpha))].sort((a,b) => b-a);
    const defaultBound = bounds.includes(0.001) ? "0.001" : String(bounds[0]);
    options(bound,bounds.map(value => [String(value),nameOfBound(value)]),defaultBound);
    if (initial && bounds.some(value => String(value) === initial.bound)) bound.value = initial.bound;
    const group = groups.find(g => g.protocol.dataset === dataset.value && g.protocol.alpha === Number(bound.value));
    if (!group) { showEmpty("No verified results match this selection."); return; }
    initial = null;
    const isVerified = entry => entry.cohort === group.id && entry.status === "verified";
    const available = new Set([...metricColumns.keys()].filter(key =>
      ["higher","lower"].includes(data.metrics[key]?.direction) &&
      group.entries.some(entry => isVerified(entry) && Number.isFinite(entry.metrics[key]))));
    if (!available.size) {
      showEmpty("No rankable metric is available for this cohort."); return;
    }
    if (!available.has(sortMetric)) {
      sortMetric = available.has("ratio") ? "ratio" : available.values().next().value;
      sortOrder = null;
    }
    const selected = data.metrics[sortMetric];
    sortOrder ??= selected.direction === "higher" ? "desc" : "asc";
    for (const [key, button] of metricColumns) {
      button.disabled = !available.has(key);
      if (key === sortMetric) {
        button.parentElement.setAttribute("aria-sort", sortOrder === "desc" ? "descending" : "ascending");
      } else button.parentElement.removeAttribute("aria-sort");
    }
    const valid = [], unranked = [];
    for (const entry of group.entries) {
      if (isVerified(entry) && Number.isFinite(entry.metrics[sortMetric])) valid.push(entry);
      else unranked.push(entry);
    }
    const sign = sortOrder === "desc" ? -1 : 1;
    valid.sort((a,b) => sign * (a.metrics[sortMetric] - b.metrics[sortMetric]) || a.codec.localeCompare(b.codec));
    const fragment = document.createDocumentFragment();
    let previous, rank = 0;
    [...valid,...unranked].forEach((entry,index) => {
      const row = document.createElement("tr");
      if (index < valid.length) {
        const value = entry.metrics[sortMetric];
        if (previous === undefined || value !== previous) rank = index + 1;
        previous = value;
        if (rank <= 3) row.className = "rank-place-" + rank;
        cell(row,String(rank),rank === 1 ? "rank-first" : "rank-number");
      } else cell(row,"—","rank-number");
      const title = cell(row,entry.display_name || entry.codec,"rank-codec");
      if (entry.source && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(entry.source.url) && /^[a-f0-9]{40}$/.test(entry.source.commit)) {
        const link = document.createElement("a"); link.href = entry.source.url + "/commit/" + entry.source.commit;
        link.textContent = entry.display_name || entry.codec; title.replaceChildren(link);
      }
      const m = entry.metrics;
      for (const key of metricColumns.keys()) cell(row,number(m[key],key),key === sortMetric ? "rank-score" : "");
      fragment.append(row);
    });
    get("rank-body").replaceChildren(fragment);
    get("rank-direction").textContent = selected.label + (sortOrder === "desc" ? " · highest first" : " · lowest first");
    get("rank-context").textContent = group.protocol.dataset + " · " + nameOfBound(group.protocol.alpha) +
      " range-relative · " + group.protocol.threads + " CPU thread · " + group.field_count + " fields";
    updateLinks();
  }
  for (const [name,button] of Object.entries(buttons)) button.addEventListener("click",() => {track=name;render();});
  for (const control of [dataset,bound]) control.addEventListener("change",render);
  for (const [key, button] of metricColumns) {
    button.addEventListener("click", () => {
      if (key === sortMetric) sortOrder = sortOrder === "asc" ? "desc" : "asc";
      else sortOrder = null;
      sortMetric = key;
      render();
    });
  }
  fetch("./data/leaderboard.json?v=20261110-hardware-v1",{cache:"no-cache"})
    .then(response => {if (!response.ok) throw new Error("leaderboard unavailable"); return response.json();})
    .then(value => {if (value.schema_version !== 1) throw new Error("unsupported leaderboard schema"); data=value; render();})
    .catch(() => showEmpty("Leaderboard data could not be loaded. The audited CSV files remain available in Downloads."));
})();
