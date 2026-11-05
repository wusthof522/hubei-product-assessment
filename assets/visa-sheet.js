/* Visa-page renderer for the passport world. Shared by the live page (window.HBVisa)
 * and the build (tools/passport/render_sample.mjs renders the static sample with it),
 * so the sample in the first screen and a real result are the same markup. */
(function (root) {
  "use strict";

  const USD_TO_CNY = 6.8;
  // Curated Chinese display names, shared by the sample, category options and real results.
  const NAMES = { 3733101: "床架" };
  let counter = 0;

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function cnUnit(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, "")} 亿`;
    if (Math.abs(v) >= 1e4) return `${Math.round(v / 1e4).toLocaleString("zh-CN")} 万`;
    return Math.round(v).toLocaleString("zh-CN");
  }
  const formatRmb = (usd) => `¥${cnUnit(Number(usd) * USD_TO_CNY)}`;
  const formatRmbPrice = (usd) => `¥${Math.round(Number(usd) * USD_TO_CNY).toLocaleString("zh-CN")}`;
  function priceBandRmb(value) {
    const numbers = String(value || "").match(/[\d.]+/g);
    if (!numbers || numbers.length < 2) return "";
    return `${formatRmbPrice(numbers[0])}–${Math.round(Number(numbers[1]) * USD_TO_CNY).toLocaleString("zh-CN")}`;
  }
  function formatSnapshot(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]} 年 ${Number(match[2])} 月` : (value || "—");
  }

  // Ink: a low-strength turbulence mask so the stamp prints unevenly but every glyph stays legible.
  function inkFilter(id, seed) {
    return `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="1.15" numOctaves="2" seed="${seed}" result="noise"/>
      <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 2.25" result="mask"/>
      <feComposite in="SourceGraphic" in2="mask" operator="in"/>
    </filter>`;
  }

  function roundStamp({ cls, ring, main, sub, size = 100, idPrefix }) {
    const id = idPrefix || `vs${++counter}`;
    return `<svg class="stamp ${cls}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">
      <defs><path id="${id}-ring" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/>${inkFilter(`${id}-ink`, (counter % 7) + 2)}</defs>
      <g filter="url(#${id}-ink)">
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="3.2"/>
        <circle cx="60" cy="60" r="51" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <circle cx="60" cy="60" r="35" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <text fill="currentColor" font-size="12.5" font-weight="700" letter-spacing="1.6"><textPath href="#${id}-ring">${esc(ring)}</textPath></text>
        <text x="60" y="63" fill="currentColor" text-anchor="middle" font-size="19" font-weight="800">${esc(main)}</text>
        <text x="60" y="80" fill="currentColor" text-anchor="middle" font-size="12.5" font-weight="700">${esc(sub)}</text>
      </g>
    </svg>`;
  }

  function rectStamp({ cls, main, sub, idPrefix }) {
    const id = idPrefix || `vs${++counter}`;
    return `<svg class="stamp ${cls}" viewBox="0 0 156 76" width="142" height="69" aria-hidden="true" focusable="false">
      <defs>${inkFilter(`${id}-ink`, (counter % 7) + 3)}</defs>
      <g filter="url(#${id}-ink)">
        <rect x="3" y="3" width="150" height="70" fill="none" stroke="currentColor" stroke-width="3.2"/>
        <rect x="9" y="9" width="138" height="58" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <text x="78" y="40" fill="currentColor" text-anchor="middle" font-size="21" font-weight="800"${String(main).length > 7 ? ' textLength="122" lengthAdjust="spacingAndGlyphs"' : ""}>${esc(main)}</text>
        <text x="78" y="57" fill="currentColor" text-anchor="middle" font-size="12" font-weight="700"${String(sub).length > 6 ? ' textLength="122" lengthAdjust="spacingAndGlyphs"' : ""}>${esc(sub)}</text>
      </g>
    </svg>`;
  }

  function entryStamp(month, idPrefix) {
    return roundStamp({ cls: "stamp-entry", ring: "美国站 · 入境 · 美国站 · 入境 · ", main: "美国站", sub: month, idPrefix });
  }

  function trendRow(trend) {
    if (trend.yoyPct == null) {
      return ["和去年比", "暂不比较",
        trend.comparable === false ? "这个类目在一年里调整过结构，去年同期的数字不可比。" : "去年同期的数据不足。"];
    }
    const pct = Math.abs(trend.yoyPct);
    if (pct <= 5) return ["和去年比", "基本持平", `头部销售额和去年同月相差 ${pct}% 以内。`];
    return trend.yoyPct > 0
      ? ["和去年比", `增长 ${pct}%`, `头部销售额比去年同月多 ${pct}%。`]
      : ["和去年比", `下降 ${pct}%`, `头部销售额比去年同月少 ${pct}%。`];
  }

  function mrzLine(data) {
    const month = String(data.snapshotDate || "").replace("-", "");
    return `V<HBEC<<${data.nodeId || ""}<<US<<${month}`.slice(0, 36).padEnd(36, "<");
  }

  function reportSheetHtml(data, product, options = {}) {
    const p = options.idPrefix || `v${++counter}`;
    const market = data.marketSize || {};
    const competition = data.competition || {};
    const newProducts = competition.newProductShare || {};
    const concentration = competition.concentration || {};
    const voc = data.voc || {};
    const products = Array.isArray(data.topProducts) ? data.topProducts.slice(0, 5) : [];
    const pathCn = String((product && product.categoryPathCn) || data.categoryPathCn || "").split(/\s*>\s*/).filter(Boolean);
    const title = NAMES[data.nodeId] || pathCn[pathCn.length - 1] || (product && product.category) || "所选类目";
    const month = String(data.snapshotDate || "").replace("-", ".");
    const sub = [...pathCn.slice(0, -1).slice(-2), "美国站"].join(" · ");
    const rows = [];

    if (market.totalRevenue != null) {
      rows.push(["市场有多大", `约 ${formatRmb(market.totalRevenue)} / 月`,
        `头部 ${market.sampleCount || 100} 款商品的月销售额，约 $${cnUnit(market.totalRevenue)}。`,
        rectStamp({ cls: "stamp-market", main: `约 ${formatRmb(market.totalRevenue)}`, sub: "月销售额", idPrefix: `${p}m` })]);
    }
    if (market.medianPrice != null) {
      const band = priceBandRmb(market.priceBand);
      rows.push(["卖什么价", `约 ${formatRmbPrice(market.medianPrice)}`,
        `${band ? `多数在 ${band} 之间。` : ""}对照一下您的出厂价、运费和平台费用。`,
        options.issued ? entryStamp(month, `${p}e`) : ""]);
    }
    rows.push([...trendRow(data.trend || {}), ""]);
    if (newProducts.pct != null) {
      rows.push(["新品机会", `${newProducts.pct}%`,
        `头部商品里，${newProducts.pct}% 是近 18 个月才上架的。${
          newProducts.pct >= 40 ? "新品还有空间。" : newProducts.pct >= 20 ? "新品有一定空间。" : "以老品为主，新品进入较难。"}`,
        roundStamp({ cls: "stamp-new", ring: "近 18 个月 · 新品上架 · 近 18 个月 · ", main: `${newProducts.pct}%`, sub: "新品占比", idPrefix: `${p}n` })]);
    }
    if (concentration.sharePct != null) {
      rows.push(["竞争", `前 5 个品牌占 ${concentration.sharePct}%`,
        concentration.sharePct >= 60 ? "头部品牌占得多，新品牌进入较难。"
          : concentration.sharePct >= 35 ? "有头部品牌，但没有被少数几家垄断。" : "品牌比较分散，新品牌有机会。", ""]);
    }
    if (voc.avgRating != null) {
      rows.push(["买家评价", `平均 ${Number(voc.avgRating).toFixed(1)} 分`, "差评里反复出现的问题，往往就是改款方向。", ""]);
    }

    const headStamp = options.issued
      ? rectStamp({ cls: "stamp-issued is-new", main: "已受理", sub: "湖北省电子商务行业协会", idPrefix: `${p}i` })
      : entryStamp(month, `${p}e`);
    const tag = options.issued ? "h4" : "h2";

    return `
      <article class="sheet">
        <header class="sheet-head${options.issued ? " is-issued" : ""}">
          <p class="sheet-letterhead"><img src="partners/heca-emblem.png" alt="" width="26" height="20"><span>湖北省电子商务行业协会</span></p>
          <${tag} class="sheet-title">${esc(title)} · 市场初评</${tag}>
          <p class="sheet-sub">${esc(sub)}<br>数据月份 ${esc(formatSnapshot(data.snapshotDate || data.generatedAt))}${options.serial ? `<br><span class="sheet-docno">${esc(options.serial)}</span>` : ""}</p>
          ${headStamp}
        </header>
        <dl class="sheet-rows">
          ${rows.map(([label, value, note, stamp]) => `
          <div class="sheet-row${stamp ? (stamp.indexOf("stamp-market") > -1 ? " has-stamp has-rect" : " has-stamp") : ""}">
            <dt>${esc(label)}</dt>
            <dd><strong>${esc(value)}</strong><span>${esc(note)}</span></dd>${stamp}
          </div>`).join("")}
        </dl>
        ${products.length && options.products !== false ? `<section class="sheet-products">
          <h5>头部商品（前 ${products.length} 款）</h5>
          <ol>${products.map((item) => `
            <li><span class="sheet-product-title">${esc(item.title || "")}</span><span class="sheet-product-meta">${esc(item.brand || "")}${item.rating != null ? ` · ${item.rating} 分` : ""}${item.revenue != null ? ` · 约 ${formatRmb(item.revenue)} / 月` : ""}</span></li>`).join("")}
          </ol>
        </section>` : ""}
        <p class="sheet-mrz" aria-hidden="true">${esc(mrzLine(data))}</p>
        <footer class="sheet-foot">数据来源：卖家精灵估算，不是亚马逊的真实销量，仅供参考。人民币按 1 美元约 ${USD_TO_CNY} 元换算。</footer>
      </article>`;
  }

  root.HBVisa = { reportSheetHtml, roundStamp, entryStamp, names: NAMES, USD_TO_CNY };
})(typeof window !== "undefined" ? window : globalThis);
