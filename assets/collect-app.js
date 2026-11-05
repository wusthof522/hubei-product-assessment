(() => {
  "use strict";

  const amzPathMatch = location.pathname.match(/^(.*\/amz)(?:\/|$)/);
  const APP_BASE_PATH = amzPathMatch?.[1] || "";
  const STATIC_DEMO = location.hostname.endsWith("github.io")
    || location.hostname.endsWith("protozoa.amazon.dev")
    || new URLSearchParams(location.search).get("demo") === "1";
  const DRAFT_KEY = "hubei-product-assessment-draft-v1";
  const INTEGRATION_PARAMS = new URLSearchParams(location.search);
  const REGISTRATION_RETURN = INTEGRATION_PARAMS.get("registration_return") || "";
  const REGISTRATION_CHANNEL = INTEGRATION_PARAMS.get("registration_channel") || "";
  const REGISTRATION_ID = INTEGRATION_PARAMS.get("registrationId") || "";
  const HANDOFF_TOKEN = INTEGRATION_PARAMS.get("handoff_token") || "";
  const HANDOFF_ID = INTEGRATION_PARAMS.get("handoff_id") || "";
  const AUTO_RETURN = INTEGRATION_PARAMS.get("auto_return") === "1";
  const REGISTRATION_PREFILL_KEY_PREFIX = "hubei-product-prefill-v1:";
  const PRODUCT_RESULT_MESSAGE = "hubei-product-assessment-result-v1";
  const MAX_IMAGES = 3;
  const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
  const MAX_IMAGE_EDGE = 1600;
  const PRODUCT_MODIFIERS = [
    "厂家直销",
    "跨境专供",
    "亚马逊",
    "可折叠",
    "折叠式",
    "便携式",
    "多功能",
    "不锈钢",
    "实木",
    "木制",
    "金属",
    "塑料",
    "便携",
    "折叠",
    "加厚",
    "简约",
    "现代",
    "欧式",
    "美式",
    "轻奢",
    "新款",
    "定制",
    "家用",
    "商用",
    "大号",
    "小号",
    "迷你",
  ];
  const CATEGORY_ALIAS_GROUPS = [
    { aliases: ["电视柜", "影视柜", "tv柜"], targets: ["tv media furniture"] },
    { aliases: ["鞋柜", "鞋架"], targets: ["shoe organizers"] },
    {
      aliases: ["藤椅", "编藤椅"],
      targets: [
        "patio lawn garden patio furniture accessories outdoor furniture chairs",
        "patio lawn garden patio furniture accessories patio seating chairs",
      ],
    },
    { aliases: ["床架", "床框", "铁床", "木床"], targets: ["beds frames bases"] },
    { aliases: ["电脑桌", "书桌"], targets: ["home office desks", "desks"] },
    { aliases: ["餐边柜", "备餐柜"], targets: ["sideboards buffets", "餐边柜"] },
    { aliases: ["雨披", "雨衣"], targets: ["rainwear", "raincoats", "雨衣"] },
    { aliases: ["宠物窝", "宠物床", "狗窝", "猫窝"], targets: ["pet beds", "beds furniture"] },
    { aliases: ["收纳柜", "储物柜"], targets: ["storage cabinets", "储物柜"] },
    { aliases: ["晾衣架", "晒衣架"], targets: ["drying racks", "晾衣架"] },
    { aliases: ["沙发床"], targets: ["sleeper sofas", "sofa beds"] },
    { aliases: ["办公椅", "电脑椅"], targets: ["home office chairs", "office chairs"] },
    { aliases: ["梳妆台"], targets: ["vanities vanity benches"] },
    { aliases: ["床头柜"], targets: ["nightstands"] },
    { aliases: ["餐桌"], targets: ["dining tables"] },
    { aliases: ["餐椅"], targets: ["dining chairs"] },
  ];
  const CATEGORY_CONTEXT_GROUPS = [
    { aliases: ["儿童", "小孩", "童款"], targets: ["kids", "boys", "girls", "儿童", "男童", "女童"] },
    { aliases: ["宠物", "猫", "狗"], targets: ["pet", "cats", "dogs", "宠物", "猫", "犬"] },
    { aliases: ["户外", "庭院", "露营"], targets: ["patio", "outdoor", "garden", "户外", "庭院"] },
    { aliases: ["办公", "电脑"], targets: ["office", "办公"] },
    { aliases: ["浴室", "卫生间"], targets: ["bathroom", "浴室", "卫生间"] },
  ];

  const stepCopy = {
    1: ["第 1 步：产品信息", "先让我们了解您想评估的产品"],
    2: ["第 2 步：出海需求", "选择目标市场和当前需要的支持"],
    3: ["第 3 步：联系方式", "留下联系方式，等待亚马逊全球开店湖北经理承接"],
  };

  const state = {
    currentStep: 1,
    partners: [],
    images: [],
    picked: null,
    categoryMatches: [],
    categoryDataPromise: null,
    categoryData: null,
    searchPool: [],
    vocDict: {},
    saveTimer: null,
    matchTimer: null,
    matchRequestId: 0,
    isComposing: false,
    pendingSubmission: null,
    returnTimer: null,
    registrationPrefill: null,
    registrationHandoff: null,
  };

  const form = document.getElementById("assessmentForm");
  const formArea = document.getElementById("formArea");
  const successView = document.getElementById("successView");
  const productName = document.getElementById("productName");
  const productNote = document.getElementById("productNote");
  const phone = document.getElementById("phone");
  const sourceSelect = document.getElementById("source");
  const sourceOther = document.getElementById("sourceOther");
  const uploadInput = document.getElementById("productImages");
  const uploadZone = document.getElementById("uploadZone");
  const uploadPreview = document.getElementById("uploadPreview");
  const uploadText = document.getElementById("uploadText");
  const uploadThumbs = document.getElementById("uploadThumbs");
  const categorySuggestion = document.getElementById("categorySuggestion");
  const categoryPrimaryText = document.getElementById("categoryPrimaryText");
  const categoryOptions = document.getElementById("categoryOptions");
  const draftText = document.getElementById("draftText");
  const toast = document.getElementById("toast");
  const returnToRegistration = document.getElementById("returnToRegistration");
  const registrationReturnStatus = document.getElementById("registrationReturnStatus");
  const registrationReturnCountdown = document.getElementById("registrationReturnCountdown");
  const stayOnReport = document.getElementById("stayOnReport");
  const staticDemoNotice = document.getElementById("staticDemoNotice");

  function appUrl(path) {
    return APP_BASE_PATH + (path.startsWith("/") ? path : `/${path}`);
  }

  function renderIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function esc(value) {
    return String(value ?? "").replace(
      /[&<>"]/g,
      (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char],
    );
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function checkedValues(name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function setStep(step, options = {}) {
    state.currentStep = Math.min(3, Math.max(1, step));
    document.querySelectorAll(".step-panel").forEach((panel) => {
      panel.classList.toggle("active", Number(panel.dataset.step) === state.currentStep);
    });
    document.querySelectorAll("[data-step-tab]").forEach((tab) => {
      const tabStep = Number(tab.dataset.stepTab);
      tab.classList.toggle("active", tabStep === state.currentStep);
      tab.classList.toggle("done", tabStep < state.currentStep);
    });
    document.getElementById("progressFill").style.width = `${state.currentStep * 33.333}%`;
    document.getElementById("stepTitle").textContent = stepCopy[state.currentStep][0];
    document.getElementById("stepMeta").textContent = stepCopy[state.currentStep][1];
    scheduleSave();
    if (options.scroll !== false) {
      document.getElementById("assessment").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function showError(name, message) {
    const errorNode = document.querySelector(`[data-error-for="${name}"]`);
    if (errorNode) errorNode.textContent = message;
    const input = form.elements[name];
    if (input && input.classList) input.classList.toggle("invalid", Boolean(message));
  }

  function clearStepErrors(step) {
    document.querySelectorAll(`[data-step="${step}"] .error`).forEach((node) => {
      node.textContent = "";
    });
    document.querySelectorAll(`[data-step="${step}"] .invalid`).forEach((node) => {
      node.classList.remove("invalid");
    });
  }

  function validateStep(step) {
    clearStepErrors(step);
    let valid = true;

    if (step === 1) {
      if (!productName.value.trim()) {
        showError("productName", "请填写产品名称。");
        valid = false;
      }
      if (!state.images.length && !productNote.value.trim()) {
        showError("productProof", "请上传产品图片，或填写产品说明。");
        valid = false;
      }
      if (productName.value.trim() && !state.picked) {
        showError("productName", "请从实时匹配结果中选择一个最符合的类目。");
        valid = false;
      }
    }

    if (step === 2) {
      if (!checkedValues("markets").length) {
        showError("markets", "请至少选择一个意向市场。");
        valid = false;
      }
      if (!form.querySelector('input[name="stage"]:checked')) {
        showError("stage", "请选择目前的亚马逊阶段。");
        valid = false;
      }
    }

    if (step === 3) {
      ["company", "contact"].forEach((name) => {
        if (!form.elements[name].value.trim()) {
          showError(name, name === "company" ? "请填写公司或工厂名称。" : "请填写联系人。");
          valid = false;
        }
      });
      if (!/^1[3-9]\d{9}$/.test(phone.value)) {
        showError("phone", "请输入有效的 11 位手机号码。");
        valid = false;
      }
      if (sourceSelect.value === "manual" && !sourceOther.value.trim()) {
        showError("sourceOther", "请填写具体渠道名称。");
        valid = false;
      }
      if (!form.elements.consent.checked) {
        showError("consent", "请阅读并同意信息使用与隐私说明。");
        valid = false;
      }
    }

    if (!valid) {
      document
        .querySelector(`[data-step="${step}"] .error:not(:empty)`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return valid;
  }

  function serializeDraft() {
    const data = { currentStep: state.currentStep };
    new FormData(form).forEach((value, key) => {
      if (value instanceof File || key === "consent") return;
      if (data[key]) {
        data[key] = Array.isArray(data[key]) ? [...data[key], value] : [data[key], value];
      } else {
        data[key] = value;
      }
    });
    return data;
  }

  function saveDraft() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(serializeDraft()));
      draftText.textContent = "草稿已保存";
    } catch {
      draftText.textContent = "草稿保存受限";
    }
  }

  function scheduleSave() {
    draftText.textContent = "正在保存";
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveDraft, 350);
  }

  function restoreDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      draftText.textContent = "草稿自动保存";
      return;
    }
    try {
      const data = JSON.parse(raw);
      Object.entries(data).forEach(([name, value]) => {
        if (name === "currentStep") return;
        form.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((control) => {
          if (control.type === "checkbox" || control.type === "radio") {
            control.checked = Array.isArray(value) ? value.includes(control.value) : value === control.value;
          } else {
            control.value = value;
          }
        });
      });
      setStep(Number(data.currentStep) || 1, { scroll: false });
      if (productName.value.trim()) scheduleCategoryMatch();
      draftText.textContent = "已恢复草稿";
    } catch {
      localStorage.removeItem(DRAFT_KEY);
      draftText.textContent = "草稿自动保存";
    }
  }

  function loadRegistrationPrefill() {
    if (!REGISTRATION_CHANNEL) return;
    const key = `${REGISTRATION_PREFILL_KEY_PREFIX}${REGISTRATION_CHANNEL}`;
    try {
      const raw = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      if (!raw) return;
      const value = JSON.parse(raw);
      const isValid = value?.version === 1
        && value.registrationId === REGISTRATION_ID
        && Number(value.expiresAt) > Date.now();
      if (isValid) state.registrationPrefill = value;
    } catch {
      state.registrationPrefill = null;
    }
  }

  async function loadServerRegistrationHandoff() {
    if (!/^[a-f0-9]{64}$/i.test(HANDOFF_TOKEN)) return;
    try {
      const response = await fetch(
        appUrl(`/registration-handoff?token=${encodeURIComponent(HANDOFF_TOKEN)}`),
        { cache: "no-store" },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.handoff) {
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const handoff = body.handoff;
      if (handoff.registrationId !== REGISTRATION_ID) {
        throw new Error("报名编号与交接凭证不一致");
      }
      state.registrationHandoff = {
        token: HANDOFF_TOKEN,
        handoffId: handoff.handoffId || HANDOFF_ID,
        registrationId: handoff.registrationId,
        meetingCode: handoff.meetingCode || "",
        roleCode: handoff.roleCode || "",
        productMode: handoff.productMode || "",
        profile: handoff.profile || {},
      };
      state.registrationPrefill = {
        version: 2,
        registrationId: handoff.registrationId,
        ...handoff.profile,
      };
    } catch (error) {
      console.warn("registration handoff failed", error);
      showToast(`报名信息自动带入失败：${error.message}`);
    }
  }

  function applyRegistrationPrefill() {
    const prefill = state.registrationPrefill;
    if (!prefill) return;
    Object.entries(prefill).forEach(([name, value]) => {
      if (!["company", "contact", "phone", "revenue"].includes(name)
        || !value
        || !form.elements[name]
        || String(form.elements[name].value || "").trim()) return;
      if (name === "revenue"
        && ![...form.elements[name].options].some((option) => option.value === String(value))) {
        const option = document.createElement("option");
        option.value = String(value).slice(0, 80);
        option.textContent = `报名已填写：${String(value).slice(0, 80)}`;
        option.dataset.registrationPrefill = "true";
        form.elements[name].appendChild(option);
      }
      form.elements[name].value = name === "phone"
        ? String(value).replace(/\D/g, "").slice(0, 11)
        : String(value).slice(0, name === "company" ? 120 : name === "revenue" ? 80 : 50);
    });
    scheduleSave();
  }

  function normalizeOrganizationName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/[（）()]/g, "");
  }

  function applyRegistrationSourcePrefill() {
    const awarenessChannel = String(state.registrationPrefill?.awarenessChannel || "").trim();
    const organizationId = INTEGRATION_PARAMS.get("organization_id") || "";
    const organizationName = awarenessChannel
      || INTEGRATION_PARAMS.get("organization_name")
      || "";
    if (!organizationId && !organizationName) return;

    const idAliases = {
      hubei_ecommerce: "hubei-ec",
    };
    const nameAliases = {
      湖北省电子商务协会: "湖北省电子商务行业协会",
      湖北省电商协会: "湖北省电子商务行业协会",
      湖北电商协会: "湖北省电子商务行业协会",
    };
    const targetId = idAliases[organizationId] || organizationId;
    const targetName = nameAliases[organizationName] || organizationName;
    const normalizedTargetName = normalizeOrganizationName(targetName);
    const partner = state.partners.find((item) => (
      item.id.toLowerCase() === targetId.toLowerCase()
      || normalizeOrganizationName(item.name) === normalizedTargetName
      || normalizeOrganizationName(item.shortName) === normalizedTargetName
    ));

    if (partner) {
      sourceSelect.value = partner.id;
      sourceOther.value = "";
    } else {
      sourceSelect.value = "manual";
      sourceOther.value = organizationName || organizationId;
    }
    syncManualSourceField();
    scheduleSave();
  }

  function registrationResult(submitId, submission) {
    return {
      type: PRODUCT_RESULT_MESSAGE,
      channel: REGISTRATION_CHANNEL,
      assessmentSubmitId: submitId,
      productTitle: submission.product.title || "",
      productCategory:
        submission.product.categoryPathCn
        || submission.product.category
        || submission.product.title
        || "",
    };
  }

  function notifyRegistration(result) {
    if (!REGISTRATION_CHANNEL || !window.opener || window.opener.closed) return false;
    try {
      window.opener.postMessage(result, "*");
      return true;
    } catch {
      return false;
    }
  }

  function returnToRegistrationNow() {
    if (window.opener && !window.opener.closed) {
      try {
        window.opener.focus();
        window.close();
        return;
      } catch {
        // Fall through to the HTTPS return URL when the browser blocks tab closing.
      }
    }
    if (returnToRegistration.href && returnToRegistration.href !== "#") {
      location.assign(returnToRegistration.href);
    }
  }

  function stopAutomaticReturn() {
    clearInterval(state.returnTimer);
    state.returnTimer = null;
    registrationReturnStatus.hidden = true;
  }

  function startAutomaticReturn() {
    if (!AUTO_RETURN || returnToRegistration.hidden) return;
    clearTimeout(state.returnTimer);
    registrationReturnCountdown.textContent = "提交成功，正在返回报名页面…";
    registrationReturnStatus.hidden = false;
    state.returnTimer = setTimeout(() => {
      state.returnTimer = null;
      returnToRegistrationNow();
    }, 1200);
  }

  function configureRegistrationReturn(submitId, submission) {
    stopAutomaticReturn();
    returnToRegistration.hidden = true;
    returnToRegistration.removeAttribute("href");
    const result = registrationResult(submitId, submission);
    const openerNotified = notifyRegistration(result);
    let validReturnUrl = false;
    if (REGISTRATION_RETURN) {
      try {
        const url = new URL(REGISTRATION_RETURN);
        const loopbackReturn = ["127.0.0.1", "localhost"].includes(url.hostname)
          && ["127.0.0.1", "localhost"].includes(location.hostname);
        if (["http:", "https:"].includes(url.protocol)
          && (url.origin === location.origin || loopbackReturn)) {
          url.searchParams.set("assessment_submit_id", result.assessmentSubmitId);
          url.searchParams.set("product_title", result.productTitle);
          url.searchParams.set("product_category", result.productCategory);
          returnToRegistration.href = url.toString();
          validReturnUrl = true;
        }
      } catch {
        // The opener channel can still complete the return when the URL is invalid.
      }
    }
    if (openerNotified && !validReturnUrl) {
      returnToRegistration.href = "#";
    }
    if (openerNotified || validReturnUrl) {
      returnToRegistration.hidden = false;
      startAutomaticReturn();
    }
  }

  function syncManualSourceField() {
    const isManual = sourceSelect.value === "manual";
    sourceOther.hidden = !isManual;
    sourceOther.disabled = !isManual;
    if (!isManual) showError("sourceOther", "");
  }

  async function loadPartners() {
    const listNode = document.getElementById("partnerList");
    const consultPartner = document.getElementById("consultPartner");
    try {
      const response = await fetch("partners/partners.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.partners = Array.isArray(data.list) ? data.list : [];

      listNode.innerHTML = state.partners
        .map(
          (partner) => `
            <span class="partner">
              <img src="${esc(partner.logo)}" alt="" loading="lazy">
              ${esc(partner.name)}
            </span>`,
        )
        .join("");

      sourceSelect.innerHTML =
        '<option value="">请选择</option>' +
        state.partners
          .map((partner) => `<option value="${esc(partner.id)}">${esc(partner.name)}</option>`)
          .join("") +
        '<option value="referral">朋友推荐</option><option value="manual">其他（手动填写）</option>';
      consultPartner.innerHTML = state.partners
        .map((partner) => `<option value="${esc(partner.id)}">${esc(partner.name)}</option>`)
        .join("");
      syncManualSourceField();
      renderConsultQr(consultPartner.value);
    } catch (error) {
      listNode.innerHTML = '<span class="partner">合作单位信息暂时无法加载</span>';
      console.warn("partners load failed", error);
    }
  }

  async function loadVocDict() {
    try {
      const response = await fetch("voc_translations.json", { cache: "force-cache" });
      if (response.ok) state.vocDict = await response.json();
    } catch {
      state.vocDict = {};
    }
  }

  function zhVoc(keyword) {
    const normalized = String(keyword || "").toLowerCase().trim();
    return state.vocDict[normalized] || keyword || "";
  }

  function loadCategoryData() {
    if (state.categoryDataPromise) return state.categoryDataPromise;
    state.categoryDataPromise = new Promise((resolve, reject) => {
      if (window.CATEGORY_DATA) {
        prepareCategoryData();
        resolve(state.categoryData);
        return;
      }
      const script = document.createElement("script");
      script.src = "categories.js";
      script.async = true;
      script.onload = () => {
        prepareCategoryData();
        resolve(state.categoryData);
      };
      script.onerror = () => reject(new Error("类目数据加载失败"));
      document.head.appendChild(script);
    });
    return state.categoryDataPromise;
  }

  function prepareCategoryData() {
    state.categoryData = window.CATEGORY_DATA || { tree: {}, flat: [] };
    const flat = Array.isArray(state.categoryData.flat) ? state.categoryData.flat : [];
    state.searchPool = flat
      .filter((item) => item.d >= 2)
      .map((item) => ({
        item,
        labelCn: normalizeCategoryText(item.lc),
        labelEn: normalizeCategoryText(item.le),
        pathCn: normalizeCategoryText(item.pc),
        pathEn: normalizeCategoryText(item.pe),
      }));
  }

  function normalizeCategoryText(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
  }

  function addSearchTerm(termMap, value, weight, reason) {
    const normalized = normalizeCategoryText(value);
    if (normalized.length < 2) return;
    const existing = termMap.get(normalized);
    if (!existing || weight > existing.weight) {
      termMap.set(normalized, { value: normalized, weight, reason });
    }
  }

  function buildSearchTerms(raw) {
    const termMap = new Map();
    const normalizedRaw = normalizeCategoryText(raw);
    addSearchTerm(termMap, normalizedRaw, 1, "完整名称");

    String(raw)
      .toLowerCase()
      .split(/[\s,，、/|]+/)
      .filter(Boolean)
      .forEach((term) => addSearchTerm(termMap, term, 0.95, "产品关键词"));

    let core = normalizedRaw;
    PRODUCT_MODIFIERS.forEach((modifier) => {
      core = core.replaceAll(normalizeCategoryText(modifier), "");
    });
    if (core !== normalizedRaw) addSearchTerm(termMap, core, 1.2, "核心产品词");

    const chineseRuns = String(raw).match(/[\u3400-\u9fff]+/g) || [];
    chineseRuns.forEach((run) => {
      const maxSize = Math.min(5, run.length);
      for (let size = maxSize; size >= 2; size -= 1) {
        for (let index = 0; index <= run.length - size; index += 1) {
          const value = run.slice(index, index + size);
          const weight = 0.42 + (size / Math.max(run.length, 2)) * 0.38;
          addSearchTerm(termMap, value, weight, "部分词");
        }
      }
    });

    CATEGORY_ALIAS_GROUPS.forEach((group) => {
      if (!group.aliases.some((alias) => normalizedRaw.includes(normalizeCategoryText(alias)))) return;
      group.targets.forEach((target) => addSearchTerm(termMap, target, 1.35, "常用叫法"));
    });

    return [...termMap.values()];
  }

  function buildContextTerms(raw) {
    const normalizedRaw = normalizeCategoryText(raw);
    const terms = new Set();
    CATEGORY_CONTEXT_GROUPS.forEach((group) => {
      if (!group.aliases.some((alias) => normalizedRaw.includes(normalizeCategoryText(alias)))) return;
      group.targets.forEach((target) => terms.add(normalizeCategoryText(target)));
    });
    return [...terms].filter((term) => term.length >= 2);
  }

  function bigramDice(left, right) {
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.length < 2 || right.length < 2) return 0;
    const leftPairs = new Map();
    for (let index = 0; index < left.length - 1; index += 1) {
      const pair = left.slice(index, index + 2);
      leftPairs.set(pair, (leftPairs.get(pair) || 0) + 1);
    }
    let intersection = 0;
    for (let index = 0; index < right.length - 1; index += 1) {
      const pair = right.slice(index, index + 2);
      const count = leftPairs.get(pair) || 0;
      if (!count) continue;
      intersection += 1;
      leftPairs.set(pair, count - 1);
    }
    return (2 * intersection) / (left.length + right.length - 2);
  }

  function scoreLabel(term, label) {
    if (!term || !label) return 0;
    if (term === label) return 120;
    if (label.includes(term)) {
      return 82 * (0.78 + 0.22 * Math.min(term.length / label.length, 1));
    }
    if (term.includes(label) && label.length >= 2) {
      return 68 * Math.min(label.length / term.length + 0.25, 1);
    }
    const similarity = bigramDice(term, label);
    return similarity >= 0.34 ? 48 * similarity : 0;
  }

  function scoreSearchDocument(doc, terms, contextTerms, normalizedRaw) {
    const termScores = terms
      .map((term) => {
        const labelScore = Math.max(
          scoreLabel(term.value, doc.labelCn),
          scoreLabel(term.value, doc.labelEn),
        );
        let pathScore = 0;
        if (doc.pathCn === term.value || doc.pathEn === term.value) pathScore = 94;
        else if (doc.pathCn.includes(term.value)) pathScore = 42;
        else if (doc.pathEn.includes(term.value)) pathScore = 36;
        return {
          score: Math.max(labelScore, pathScore) * term.weight,
          reason: term.reason,
        };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    if (!termScores.length) return null;
    let score = termScores[0].score + (termScores[1]?.score || 0) * 0.32;

    let contextHits = 0;
    contextTerms.forEach((term) => {
      if (
        doc.labelCn.includes(term) ||
        doc.labelEn.includes(term) ||
        doc.pathCn.includes(term) ||
        doc.pathEn.includes(term)
      ) {
        contextHits += 1;
      }
    });
    score += Math.min(contextHits * 5, 20);

    const labelText = `${doc.labelCn}${doc.labelEn}`;
    const accessoryWords = ["配件", "替换零件", "保护套", "罩", "套装", "accessories", "parts", "covers"];
    if (
      accessoryWords.some((word) => labelText.includes(normalizeCategoryText(word))) &&
      !accessoryWords.some((word) => normalizedRaw.includes(normalizeCategoryText(word)))
    ) {
      score -= 10;
    }

    score += doc.item.d === 4 ? 4 : doc.item.d === 3 ? 2 : 0;
    score += Math.min(Math.log10((doc.item.cnt || 0) + 1), 6) * 0.6;
    return { item: doc.item, score, reason: termScores[0].reason };
  }

  function isPriorityDomain(pathParts) {
    if (!pathParts?.length) return false;
    if (pathParts[0] === "Clothing, Shoes & Jewelry") return true;
    if (pathParts[0] === "Toys & Games") return true;
    if (pathParts[0] === "Health & Household") return true;
    return pathParts[0] === "Home & Kitchen" && pathParts[1] === "Furniture";
  }

  function resolveInsightTarget(item) {
    if (!item?.en) return { lookupId: item?.id || "", granularity: "L4", l2Only: false };
    if (isPriorityDomain(item.en)) {
      return { lookupId: item.id, granularity: "L4", l2Only: false };
    }
    const l2 = state.categoryData.flat.find(
      (candidate) =>
        candidate.d === 2 &&
        candidate.en?.[0] === item.en[0] &&
        candidate.en?.[1] === item.en[1],
    );
    return {
      lookupId: l2?.id || item.id,
      granularity: "L2",
      l2Only: true,
      l2PathCn: l2?.pc || "",
    };
  }

  function searchCategories(raw) {
    const normalizedRaw = normalizeCategoryText(raw);
    const terms = buildSearchTerms(raw);
    const contextTerms = buildContextTerms(raw);
    const bestById = new Map();

    state.searchPool.forEach((doc) => {
      const hit = scoreSearchDocument(doc, terms, contextTerms, normalizedRaw);
      if (!hit || hit.score < 11) return;
      const existing = bestById.get(String(hit.item.id));
      if (!existing || hit.score > existing.score) bestById.set(String(hit.item.id), hit);
    });

    const ranked = [...bestById.values()]
      .sort((left, right) => right.score - left.score || (right.item.cnt || 0) - (left.item.cnt || 0));
    if (!ranked.length) return [];
    // Keep the list short and on-topic: drop weak hits and hits from an unrelated top-level
    // department (e.g. car licence-plate frames when someone types 床架).
    const top = ranked[0];
    const topDept = top.item.en?.[0];
    return ranked
      .filter((hit, index) => index === 0
        || (hit.score >= top.score * 0.45
          && (hit.item.en?.[0] === topDept || hit.score >= top.score * 0.9)))
      .slice(0, 4);
  }

  function setCategoryOptionsOpen(open) {
    categoryOptions.classList.toggle("show", open);
    productName.setAttribute("aria-expanded", String(open));
  }

  function selectCategory(item) {
    if (!item) return;
    const target = resolveInsightTarget(item);
    state.picked = {
      id: item.id || "",
      labelEn: item.le || "",
      labelCn: item.lc || "",
      pathEn: item.pe || "",
      pathCn: item.pc || "",
      cnt: item.cnt || 0,
      insightNodeId: target.lookupId || item.id || "",
      granularity: target.granularity,
      l2Only: target.l2Only,
      l2PathCn: target.l2PathCn || "",
    };
    categoryPrimaryText.textContent = `系统建议：${CATEGORY_DISPLAY_NAMES[item.id] || item.lc || item.le}`;
    categorySuggestion.classList.add("show");
    categorySuggestion.classList.remove("no-match");
    document.getElementById("changeCategory").textContent = "查看其他类目";
    setCategoryOptionsOpen(false);
    showError("productName", "");
    categoryOptions.querySelectorAll(".category-option").forEach((button) => {
      button.classList.toggle("selected", button.dataset.id === String(item.id));
    });
  }

  function useFreeTextCategory(raw) {
    state.picked = {
      id: "",
      labelEn: raw,
      labelCn: raw,
      pathEn: raw,
      pathCn: raw,
      cnt: 0,
      insightNodeId: "",
      granularity: "custom",
      l2Only: false,
    };
    categoryPrimaryText.textContent = "没关系，经理会帮您人工判断类目，可以直接填下一步";
    categorySuggestion.classList.add("show");
    categorySuggestion.classList.add("no-match");
    document.getElementById("changeCategory").textContent = state.categoryMatches.length ? "重新选择" : "";
    setCategoryOptionsOpen(false);
    showError("productName", "");
  }

  function shortCategoryPath(item) {
    const parts = String(item.pc || item.pe || "").split(/\s*>\s*/).filter(Boolean);
    return parts.slice(-3, -1).join(" · ");
  }

  function renderCategoryOptions(matches) {
    categoryOptions.innerHTML = matches
      .map(
        (match, index) => {
          const item = match.item;
          const label = CATEGORY_DISPLAY_NAMES[item.id] || item.lc || item.le;
          const path = shortCategoryPath(item);
          return `
          <button class="category-option" type="button" role="option" data-id="${esc(item.id)}" title="${esc(item.pe || "")}">
            <span class="category-option-main">
              <span class="category-option-title">
                <strong>${esc(label)}</strong>
                ${index === 0 ? '<em>最接近</em>' : ""}
              </span>
              ${path ? `<small class="category-option-path">${esc(path)}</small>` : ""}
            </span>
          </button>`;
        },
      )
      .join("") + `
          <button class="category-option category-option-none" type="button" role="option" data-none="1">
            <span class="category-option-main">
              <span class="category-option-title"><strong>都不对，请经理帮我判断</strong></span>
            </span>
          </button>`;
    categoryOptions.querySelectorAll(".category-option").forEach((button, index) => {
      button.addEventListener("click", () => {
        if (button.dataset.none) {
          useFreeTextCategory(productName.value.trim());
          return;
        }
        selectCategory(matches[index].item);
      });
    });
  }

  async function runCategoryMatch() {
    const raw = productName.value.trim();
    const requestId = ++state.matchRequestId;
    if (normalizeCategoryText(raw).length < 2) {
      state.picked = null;
      state.categoryMatches = [];
      categoryOptions.innerHTML = "";
      setCategoryOptionsOpen(false);
      categorySuggestion.classList.remove("no-match");
      document.getElementById("changeCategory").textContent = "查看其他类目";
      if (raw) {
        categoryPrimaryText.textContent = "请再输入至少 1 个字，系统将实时推荐类目";
        categorySuggestion.classList.add("show");
      } else {
        categorySuggestion.classList.remove("show");
      }
      return;
    }
    categorySuggestion.classList.remove("no-match");
    document.getElementById("changeCategory").textContent = "查看其他类目";
    categoryPrimaryText.textContent = "正在匹配亚马逊标准类目...";
    categorySuggestion.classList.add("show");
    try {
      await loadCategoryData();
      if (requestId !== state.matchRequestId || raw !== productName.value.trim()) return;
      const matches = searchCategories(raw);
      state.categoryMatches = matches;
      if (!matches.length) {
        useFreeTextCategory(raw);
        categoryOptions.innerHTML = "";
        return;
      }
      renderCategoryOptions(matches);
      state.picked = null;
      categoryPrimaryText.textContent = "点选最接近的一项";
      setCategoryOptionsOpen(true);
    } catch (error) {
      if (requestId !== state.matchRequestId) return;
      useFreeTextCategory(raw);
      console.warn("category matching failed", error);
    }
  }

  function scheduleCategoryMatch() {
    clearTimeout(state.matchTimer);
    state.matchTimer = setTimeout(runCategoryMatch, 90);
  }

  function renderConsultQr(partnerId) {
    const preview = document.getElementById("consultQrPreview");
    const partner = state.partners.find((item) => item.id === partnerId);
    const intro = document.querySelector("#consultModal .contact-notice");
    if (intro) intro.hidden = !partner?.qrWechat;
    if (!partner?.qrWechat) {
      preview.innerHTML = `
        <div class="qr-note">
          <strong>经理的企业微信二维码正在准备</strong>
          <span>现在可以先提交一款产品。亚马逊全球开店湖北经理会按您留的手机号联系您。</span>
        </div>`;
      return;
    }
    preview.innerHTML = `
      <img src="${esc(partner.qrWechat)}" alt="亚马逊全球开店湖北经理企业微信二维码">
      <div>
        <strong>亚马逊全球开店湖北经理企业微信</strong>
        <span>长按识别二维码，获取初评解读与出海建议。</span>
      </div>`;
    renderIcons();
    preview.querySelector("img").addEventListener("error", (event) => {
      event.currentTarget.outerHTML = '<div class="qr-placeholder">二维码加载失败</div>';
    });
  }

  function renderAuthorizationQr(partnerId) {
    const preview = document.getElementById("authorizationQr");
    const partner =
      state.partners.find((item) => item.id === partnerId) || state.partners[0] || {};
    preview.hidden = !partner.qrWechat;
    if (!partner.qrWechat) {
      // The bullet above already says what to do with sensitive details; no second note.
      preview.innerHTML = "";
      return;
    }
    preview.innerHTML = `
      <img src="${esc(partner.qrWechat)}" alt="亚马逊全球开店湖北经理企业微信二维码">
      <div>
        <strong>亚马逊全球开店湖北经理企业微信</strong>
        <span>有不方便在线写的内容，长按识别二维码直接沟通。</span>
      </div>`;
    renderIcons();
    preview.querySelector("img").addEventListener("error", (event) => {
      event.currentTarget.outerHTML = '<div class="qr-placeholder">二维码加载失败</div>';
    });
  }

  function formatCount(number) {
    const value = Number(number);
    if (!Number.isFinite(value)) return "—";
    if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
    return String(value);
  }

  async function compressImage(file) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const node = new Image();
        node.onload = () => resolve(node);
        node.onerror = () => reject(new Error(`无法读取图片 ${file.name}`));
        node.src = objectUrl;
      });
      const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d", { alpha: false });
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const data = canvas.toDataURL("image/jpeg", 0.82);
      return {
        name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
        data,
        originalBytes: file.size,
        outputBytes: Math.round((data.length * 3) / 4),
      };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function addImages(files) {
    const available = MAX_IMAGES - state.images.length;
    const selected = [...files].slice(0, available);
    if (!selected.length) {
      showToast(`最多上传 ${MAX_IMAGES} 张产品图片。`);
      return;
    }
    const invalid = selected.find(
      (file) => !["image/jpeg", "image/png"].includes(file.type) || file.size > MAX_IMAGE_BYTES,
    );
    if (invalid) {
      showError(
        "productProof",
        invalid.size > MAX_IMAGE_BYTES
          ? `${invalid.name} 超过 5 MB，请压缩后重新选择。`
          : `${invalid.name} 不是支持的 JPG/PNG 图片。`,
      );
      return;
    }

    uploadText.textContent = "正在压缩图片，请稍候...";
    uploadPreview.classList.add("show");
    try {
      const compressed = await Promise.all(selected.map(compressImage));
      state.images.push(...compressed);
      showError("productProof", "");
      renderImagePreviews();
    } catch (error) {
      showError("productProof", error.message || "图片处理失败，请重新选择。");
    } finally {
      uploadInput.value = "";
    }
  }

  function renderImagePreviews() {
    if (!state.images.length) {
      uploadPreview.classList.remove("show");
      uploadThumbs.innerHTML = "";
      uploadText.textContent = "";
      return;
    }
    uploadThumbs.innerHTML = state.images
      .map(
        (image, index) => `
          <div class="upload-thumb">
            <img src="${image.data}" alt="产品图片 ${index + 1}">
            <button type="button" data-remove-image="${index}" aria-label="删除图片 ${index + 1}">×</button>
          </div>`,
      )
      .join("");
    uploadText.textContent = `已处理 ${state.images.length} 张图片，将随表单安全提交。`;
    uploadPreview.classList.add("show");
    uploadThumbs.querySelectorAll("[data-remove-image]").forEach((button) => {
      button.addEventListener("click", () => {
        state.images.splice(Number(button.dataset.removeImage), 1);
        renderImagePreviews();
      });
    });
  }

  function getSelectedPartner() {
    const source = form.elements.source.value;
    const partner = state.partners.find((item) => item.id === source);
    if (partner) return { id: partner.id, name: partner.name };
    if (source === "manual") {
      return { id: "manual", name: sourceOther.value.trim() || "其他渠道" };
    }
    const selectedText = form.elements.source.selectedOptions[0]?.textContent || "";
    return { id: source || "unspecified", name: selectedText || "未填写" };
  }

  async function buildSubmission() {
    if (!state.picked && productName.value.trim()) await runCategoryMatch();
    const timestamp = new Date();
    const needs = checkedValues("needs");
    return {
      schema: "product-collect/v3",
      submitId:
        `HB-${timestamp.getFullYear()}` +
        `${String(timestamp.getMonth() + 1).padStart(2, "0")}` +
        `${String(timestamp.getDate()).padStart(2, "0")}` +
        `-${String(timestamp.getTime()).slice(-6)}`,
      submittedAt: timestamp.toISOString(),
      partner: getSelectedPartner(),
      company: {
        name: form.elements.company.value.trim(),
        contact: form.elements.contact.value.trim(),
        phone: form.elements.phone.value.trim(),
        revenueRange: form.elements.revenue.value || null,
        revenueWan: null,
        bigCustomerEligible: null,
        canRemodel: null,
      },
      business: {
        targetMarkets: checkedValues("markets"),
        amazonStage: form.querySelector('input[name="stage"]:checked')?.value || "",
        requestedSupport: needs,
      },
      product: {
        title: productName.value.trim(),
        link: form.elements.productLink.value.trim() || null,
        factoryPriceRange: form.elements.priceRange.value || null,
        category: state.picked
          ? `${state.picked.labelEn || ""}${state.picked.labelCn ? ` / ${state.picked.labelCn}` : ""}`.trim()
          : productName.value.trim(),
        categoryNodeId: state.picked?.id || "",
        categoryPath: state.picked?.pathEn || "",
        categoryPathCn: state.picked?.pathCn || "",
        categoryGoodsCount: state.picked?.cnt || null,
        insightNodeId: state.picked?.insightNodeId || state.picked?.id || "",
        insightGranularity: state.picked?.granularity || "custom",
        note: productNote.value.trim(),
        images: state.images,
      },
      consent: {
        accepted: true,
        acceptedAt: timestamp.toISOString(),
        version: "2026-07-14",
      },
      client: {
        pageVersion: "customer-redesign-v1",
        draftRestored: Boolean(localStorage.getItem(DRAFT_KEY)),
        registrationId: REGISTRATION_ID || null,
        registrationChannel: REGISTRATION_CHANNEL || null,
        handoffToken: state.registrationHandoff?.token || null,
        handoffId: state.registrationHandoff?.handoffId || HANDOFF_ID || null,
        registrationContext: state.registrationHandoff ? {
          meetingCode: state.registrationHandoff.meetingCode,
          roleCode: state.registrationHandoff.roleCode,
          productMode: state.registrationHandoff.productMode,
          city: state.registrationHandoff.profile.city || "",
          jobRole: state.registrationHandoff.profile.jobRole || "",
          mainProducts: state.registrationHandoff.profile.mainProducts || "",
        } : null,
      },
    };
  }

  async function submitAssessment(event) {
    event.preventDefault();
    if (!validateStep(3)) return;
    const button = form.querySelector('button[type="submit"]');
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "正在准备...";
    try {
      const submission = await buildSubmission();
      state.pendingSubmission = submission;
      renderAuthorizationQr(submission.partner.id);
      openModal(document.getElementById("authorizationModal"));
    } catch (error) {
      state.pendingSubmission = null;
      showToast(`暂时无法准备提交：${error.message}。请稍后重试。`);
    } finally {
      button.disabled = false;
      button.innerHTML = original;
      renderIcons();
    }
  }

  async function confirmSubmission() {
    const modal = document.getElementById("authorizationModal");
    const button = document.getElementById("confirmSubmission");
    const submission = state.pendingSubmission;
    if (!submission || modal.dataset.submitting === "true") return;

    const original = button.innerHTML;
    const acceptedAt = new Date().toISOString();
    submission.consent = {
      ...submission.consent,
      authorizationAccepted: true,
      authorizationAcceptedAt: acceptedAt,
      authorizationVersion: "2026-07-14-data-sharing-v1",
    };
    modal.dataset.submitting = "true";
    modal.setAttribute("aria-busy", "true");
    button.disabled = true;
    button.textContent = "正在提交...";

    try {
      let data;
      if (STATIC_DEMO) {
        data = { ok: true, submitId: submission.submitId };
      } else {
        const response = await fetch(appUrl("/submit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(submission),
        });
        data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || `HTTP ${response.status}`);
        }
      }
      state.pendingSubmission = null;
      modal.dataset.submitting = "false";
      modal.removeAttribute("aria-busy");
      closeModal(modal);
      localStorage.removeItem(DRAFT_KEY);
      document.getElementById("submissionId").textContent =
        `流水号：${data.submitId || submission.submitId}`;
      configureRegistrationReturn(data.submitId || submission.submitId, submission);
      formArea.style.display = "none";
      successView.classList.add("show");
      renderQrCards(submission.partner);
      loadCategoryInsight(
        submission.product.insightNodeId || submission.product.categoryNodeId,
        submission.product,
      );
      successView.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showToast(`提交失败：${error.message}。请检查网络后重试。`);
      modal.dataset.submitting = "false";
      modal.removeAttribute("aria-busy");
      button.disabled = false;
      button.innerHTML = original;
      renderIcons();
    }
  }

  function renderQrCards(partner) {
    const zone = document.getElementById("qrZone");
    const selected = state.partners.find((item) => item.id === partner?.id) || {};
    const manager = selected.qrWechat
      ? `<div class="qr-card qr-card-main">
          <img src="${esc(selected.qrWechat)}" alt="亚马逊全球开店湖北经理企业微信二维码">
          <div>
            <strong>加亚马逊全球开店湖北经理</strong>
            <span>长按识别二维码，经理一对一解读这份初评。</span>
          </div>
        </div>`
      : `<div class="qr-card qr-card-main qr-card-text">
          <strong>亚马逊全球开店湖北经理会联系您</strong>
          <span>经理会按您留的手机号联系您，解读这份初评。经理的企业微信二维码正在准备。</span>
        </div>`;
    zone.innerHTML = `${manager}
      <div class="qr-card qr-card-minor">
        <img src="assets/sellersprite-15day.png" alt="卖家精灵 15 天会员领取二维码">
        <div>
          <strong>另附：卖家精灵 15 天会员</strong>
          <span>第三方选品工具，用于自己做市场调研。</span>
        </div>
      </div>`;
    zone.querySelectorAll("img").forEach((image) => {
      image.addEventListener("error", () => {
        image.closest(".qr-card")?.remove();
      });
    });
    // Without a manager QR the "add the manager" button leads nowhere, so the next product becomes the main action.
    const consultAction = document.querySelector('.success-actions [data-open="consultModal"]');
    const anotherAction = document.getElementById("submitAnother");
    if (consultAction) consultAction.hidden = !selected.qrWechat;
    if (anotherAction) anotherAction.classList.toggle("btn-secondary", Boolean(selected.qrWechat));
  }

  async function loadCategoryInsight(nodeId, product) {
    const zone = document.getElementById("insightZone");
    if (!nodeId) {
      zone.innerHTML =
        '<div class="insight-empty">该产品暂未匹配标准类目。专员会人工复核并补充市场初评。</div>';
      return;
    }
    zone.innerHTML = '<div class="insight-loading">正在调取该类目的市场初评...</div>';
    try {
      const response = await fetch(
        STATIC_DEMO && /^[A-Za-z0-9]+$/.test(String(nodeId))
          ? `insights/${encodeURIComponent(nodeId)}.json`
          : appUrl(`/category-insight?nodeId=${encodeURIComponent(nodeId)}`),
        { cache: "no-cache" },
      );
      if (response.status === 404) {
        zone.innerHTML =
          '<div class="insight-empty">这个类目的详细初评正在生成，亚马逊全球开店湖北经理会联系您，补充初评和出海建议。</div>';
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      renderInsight(zone, await response.json(), product);
    } catch (error) {
      console.warn("insight load failed", error);
      zone.innerHTML =
        '<div class="insight-empty">市场初评暂时无法加载，您的提交已成功，专员会后续补充。</div>';
    }
  }

  function renderInsight(zone, data, product) {
    if (data.sampleStatus === "empty") {
      zone.innerHTML =
        '<div class="insight-empty">这个类目近期在售商品较少，暂时没有足够的市场数据。亚马逊全球开店湖北经理会人工复核，再给您补充初评。</div>';
      return;
    }
    const serialText = (document.getElementById("submissionId")?.textContent || "").replace(/^流水号[：:]\s*/, "");
    zone.innerHTML = reportSheetHtml(data, product, { serial: serialText ? `流水号 ${serialText}` : "", issued: true });
  }

  // The visa-page renderer lives in assets/visa-sheet.js so the build can render the static sample with it.
  const CATEGORY_DISPLAY_NAMES = (window.HBVisa && window.HBVisa.names) || {};
  const SAMPLE_NODE_ID = "3733101";

  async function renderHeroSample() {
    const slot = document.getElementById("hbSampleSheet");
    if (!slot || !window.HBVisa) return;
    try {
      const response = await fetch(
        STATIC_DEMO ? `insights/${SAMPLE_NODE_ID}.json` : appUrl(`/category-insight?nodeId=${SAMPLE_NODE_ID}`),
        { cache: "no-cache" },
      );
      if (!response.ok) return;
      slot.innerHTML = reportSheetHtml(await response.json(), null, { serial: "示例编号 HB-SAMPLE", products: false });
    } catch (error) {
      console.warn("sample sheet load failed", error);
    }
  }

  function reportSheetHtml(data, product, options = {}) {
    return window.HBVisa.reportSheetHtml(data, product, options);
  }

  const USD_TO_CNY = 6.8;

  function compactNumber(number) {
    const value = Number(number);
    if (!Number.isFinite(value)) return "—";
    if (Math.abs(value) >= 1e8) return `${(value / 1e8).toFixed(1).replace(/\.0$/, "")}亿`;
    if (Math.abs(value) >= 1e4) return `${(value / 1e4).toFixed(1).replace(/\.0$/, "")}万`;
    return String(Math.round(value));
  }

  function formatSnapshot(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]} 年 ${Number(match[2])} 月` : (value || "—");
  }

  function cnUnit(value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return "—";
    if (Math.abs(v) >= 1e8) return `${(v / 1e8).toFixed(1).replace(/\.0$/, "")} 亿`;
    if (Math.abs(v) >= 1e4) return `${Math.round(v / 1e4).toLocaleString("zh-CN")} 万`;
    return Math.round(v).toLocaleString("zh-CN");
  }

  function formatRmb(usd) {
    return `¥${cnUnit(Number(usd) * USD_TO_CNY)}`;
  }

  function formatRmbPrice(usd) {
    return `¥${Math.round(Number(usd) * USD_TO_CNY).toLocaleString("zh-CN")}`;
  }

  function priceBandRmb(value) {
    const numbers = String(value || "").match(/[\d.]+/g);
    if (!numbers || numbers.length < 2) return "";
    return `${formatRmbPrice(numbers[0])}–${Math.round(Number(numbers[1]) * USD_TO_CNY).toLocaleString("zh-CN")}`;
  }

  function formatMoney(number) {
    return `$${compactNumber(number)}（约 ¥${compactNumber(Number(number) * USD_TO_CNY)}）`;
  }

  function formatPrice(number) {
    return `$${Math.round(Number(number))}（约 ¥${Math.round(Number(number) * USD_TO_CNY)}）`;
  }

  function formatPriceBand(value) {
    const numbers = String(value || "").match(/[\d.]+/g);
    if (!numbers || numbers.length < 2) return value || "";
    return `$${Math.round(Number(numbers[0]))}–${Math.round(Number(numbers[1]))}`;
  }

  function openModal(modal) {
    modal.classList.add("show");
    document.body.style.overflow = "hidden";
    modal.querySelector("input, button")?.focus();
  }

  function closeModal(modal) {
    if (!modal || modal.dataset.submitting === "true") return;
    modal.classList.remove("show");
    document.body.style.overflow = "";
    if (modal.id === "authorizationModal") state.pendingSubmission = null;
  }

  function resetAssessment() {
    form.reset();
    state.images = [];
    state.picked = null;
    state.categoryMatches = [];
    renderImagePreviews();
    categorySuggestion.classList.remove("show");
    setCategoryOptionsOpen(false);
    successView.classList.remove("show");
    returnToRegistration.hidden = true;
    returnToRegistration.removeAttribute("href");
    formArea.style.display = "block";
    localStorage.removeItem(DRAFT_KEY);
    applyRegistrationPrefill();
    applyRegistrationSourcePrefill();
    syncManualSourceField();
    setStep(1);
  }

  function bindEvents() {
    document.querySelectorAll("[data-next]").forEach((button) => {
      button.addEventListener("click", () => {
        if (validateStep(state.currentStep)) setStep(state.currentStep + 1);
      });
    });
    document.querySelectorAll("[data-prev]").forEach((button) => {
      button.addEventListener("click", () => setStep(state.currentStep - 1));
    });
    document.querySelectorAll("[data-step-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const target = Number(button.dataset.stepTab);
        if (target <= state.currentStep || validateStep(state.currentStep)) setStep(target);
      });
    });

    productName.addEventListener("compositionstart", () => {
      state.isComposing = true;
    });
    productName.addEventListener("compositionend", () => {
      state.isComposing = false;
      state.picked = null;
      scheduleCategoryMatch();
    });
    productName.addEventListener("input", () => {
      state.picked = null;
      if (state.isComposing) return;
      scheduleCategoryMatch();
    });
    productName.addEventListener("focus", () => {
      loadCategoryData().catch(() => {});
      if (productName.value.trim().length >= 2 && state.categoryMatches.length) {
        setCategoryOptionsOpen(true);
      }
    });
    productName.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowDown" || !categoryOptions.classList.contains("show")) return;
      event.preventDefault();
      categoryOptions.querySelector(".category-option")?.focus();
    });
    document.getElementById("changeCategory").addEventListener("click", () => {
      if (categorySuggestion.classList.contains("no-match")) {
        if (!state.categoryMatches.length) return;
        state.picked = null;
        categorySuggestion.classList.remove("no-match");
        categoryPrimaryText.textContent = "点选最接近的一项";
        document.getElementById("changeCategory").textContent = "查看其他类目";
        setCategoryOptionsOpen(true);
        return;
      }
      if (!state.categoryMatches.length) {
        scheduleCategoryMatch();
        return;
      }
      setCategoryOptionsOpen(!categoryOptions.classList.contains("show"));
    });

    phone.addEventListener("input", () => {
      phone.value = phone.value.replace(/\D/g, "").slice(0, 11);
    });
    sourceSelect.addEventListener("change", syncManualSourceField);
    returnToRegistration.addEventListener("click", (event) => {
      if (window.opener && !window.opener.closed) {
        event.preventDefault();
        stopAutomaticReturn();
        returnToRegistrationNow();
      }
    });
    stayOnReport.addEventListener("click", stopAutomaticReturn);
    document.getElementById("consultPartner").addEventListener("change", (event) => {
      renderConsultQr(event.target.value);
    });

    uploadInput.addEventListener("change", () => addImages(uploadInput.files));
    document.getElementById("removeFiles").addEventListener("click", () => {
      state.images = [];
      renderImagePreviews();
    });

    ["dragenter", "dragover"].forEach((eventName) => {
      uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      uploadZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        uploadZone.classList.remove("dragging");
      });
    });
    uploadZone.addEventListener("drop", (event) => addImages(event.dataTransfer.files));

    form.addEventListener("input", scheduleSave);
    // Clear a field's error as soon as the person changes it, instead of leaving stale red text.
    const clearOwnError = (event) => {
      const name = event.target?.name;
      if (!name || name === "productName") return;
      if (name === "productNote" || name === "productImages") {
        showError("productProof", "");
        return;
      }
      showError(name, "");
    };
    form.addEventListener("input", clearOwnError);
    form.addEventListener("change", clearOwnError);
    form.addEventListener("change", scheduleSave);
    form.addEventListener("submit", submitAssessment);
    document.getElementById("confirmSubmission").addEventListener("click", confirmSubmission);

    document.getElementById("clearDraft").addEventListener("click", () => {
      localStorage.removeItem(DRAFT_KEY);
      form.reset();
      state.images = [];
      state.picked = null;
      renderImagePreviews();
      categorySuggestion.classList.remove("show");
      setCategoryOptionsOpen(false);
      applyRegistrationPrefill();
      applyRegistrationSourcePrefill();
      syncManualSourceField();
      draftText.textContent = "草稿已清空";
    });
    document.getElementById("submitAnother").addEventListener("click", resetAssessment);

    document.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => openModal(document.getElementById(button.dataset.open)));
    });
    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeModal(button.closest(".modal-backdrop")));
    });
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.addEventListener("click", (event) => {
        if (event.target === backdrop) closeModal(backdrop);
      });
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        document.querySelectorAll(".modal-backdrop.show").forEach(closeModal);
      }
    });
  }

  async function runPreviewMode() {
    const nodeId = new URLSearchParams(location.search).get("preview");
    if (!nodeId) return false;
    formArea.style.display = "none";
    successView.classList.add("show");
    document.getElementById("submissionId").textContent = `流水号：PREVIEW-${nodeId}`;
    renderQrCards({ id: "" });
    await loadCategoryInsight(nodeId, {
      title: "示例产品",
      categoryPathCn: "预览类目",
      category: nodeId,
    });
    successView.scrollIntoView({ block: "start" });
    return true;
  }

  async function init() {
    renderIcons();
    if (STATIC_DEMO && staticDemoNotice) staticDemoNotice.hidden = false;
    bindEvents();
    loadVocDict();
    await loadPartners();
    renderHeroSample();
    loadRegistrationPrefill();
    await loadServerRegistrationHandoff();
    restoreDraft();
    applyRegistrationPrefill();
    applyRegistrationSourcePrefill();
    syncManualSourceField();
    await runPreviewMode();
  }

  init();
})();
