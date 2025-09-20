
const BASE_URL = "https://reports4u22.bgu.ac.il/GeneratePDF.php";
const CONSTANT_PREFIX = "server=aristo4stu419c/report=SCRR016w";

// Landing / main containers
const landing = document.getElementById("landing");
const main = document.getElementById("main");
const showMainBtn = document.getElementById("showMain");
const landingStatusText = document.getElementById("landingStatusText");

// Inputs
const yearInput = document.getElementById("year");
const semesterInput = document.getElementById("semester");
const departmentInput = document.getElementById("department");
const courseInput = document.getElementById("course");
const gradeInput = document.getElementById("gradeTerm");

// Buttons
const generateButton = document.getElementById("generateButton");
const openButton = document.getElementById("openButton");
const downloadButton = document.getElementById("downloadButton");
const copyButton = document.getElementById("copyButton");
const generatedLinkDiv = document.getElementById("generatedLink");

// internal only
let capturedPKey = null;
let hasGenerated = false;
let captureWatcherId = null;

/**
 * Save inputs
 */
function saveInputs() {
  const data = {
    year: yearInput.value,
    semester: semesterInput.value,
    department: departmentInput.value,
    course: courseInput.value,
    gradeTerm: gradeInput.value
  };
  localStorage.setItem("bguGradesInputs", JSON.stringify(data));
}

/**
 * Load saved inputs
 */
function loadInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem("bguGradesInputs") || "{}");
    yearInput.value = saved.year || "";
    semesterInput.value = saved.semester || "";
    departmentInput.value = saved.department || "";
    courseInput.value = saved.course || "";
    gradeInput.value = saved.gradeTerm || "";
  } catch (_) {}
}

// Wrap department/course codes
function wrapStarAt(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  if (v.startsWith("*")) v = v.slice(1);
  if (v.endsWith("@")) v = v.slice(0, -1);
  return `*${v}@`;
}

function stripStarAt(raw) {
  let v = String(raw || "").trim();
  if (!v) return "";
  if (v.startsWith("*")) v = v.slice(1);
  if (v.endsWith("@")) v = v.slice(0, -1);
  return v;
}

function revealMain() {
  if (landing) landing.classList.add("hidden");
  if (main) main.classList.remove("hidden");
}

function showLanding() {
  if (landing) landing.classList.remove("hidden");
  if (main) main.classList.add("hidden");
}

function canGenerate() {
  return !!(capturedPKey && yearInput.value && semesterInput.value && departmentInput.value && courseInput.value && gradeInput.value);
}

/**
 * Build the final URL
 */
function buildUrl() {
  if (!capturedPKey || !yearInput.value || !semesterInput.value || !departmentInput.value || !courseInput.value || !gradeInput.value) {
    return null;
  }

  const listDepartment = wrapStarAt(departmentInput.value);
  const listCourse = wrapStarAt(courseInput.value);

  const segments = [
    CONSTANT_PREFIX,
    `p_key=${encodeURIComponent(capturedPKey)}`,
    `p_year=${encodeURIComponent(yearInput.value)}`,
    `p_semester=${encodeURIComponent(semesterInput.value)}`,
    `out_institution=0`,
    `grade=${encodeURIComponent(gradeInput.value)}`,
    `list_department=${listDepartment}`,
    `list_degree_level=*1@`,
    `list_course=${listCourse}`,
    `LIST_GROUP=*@`,
    `P_FOR_STUDENT=1`
  ];

  const fullPath = segments.join("/");
  return `${BASE_URL}?${fullPath}`;
}

/**
 * Enable/disable buttons and visibility based on state
 */
function setButtonsEnabled() {
  generateButton.disabled = !canGenerate();

  if (hasGenerated) {
    openButton.style.display = "block";
    downloadButton.style.display = "block";
    copyButton.style.display = "block";
    openButton.disabled = false;
    downloadButton.disabled = false;
    copyButton.disabled = false;
  } else {
    openButton.style.display = "none";
    downloadButton.style.display = "none";
    copyButton.style.display = "none";
  }
}

function showGeneratedLink(url) {
  generatedLinkDiv.textContent = url || "";
}

/**
 * Capture parameters (including p_key) from the active tab
 */
async function captureParamsFromPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return false;

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        try {
          const scripts = Array.from(document.querySelectorAll("script"));
          for (const s of scripts) {
            const text = s.innerText || "";
            if (text.includes("p_key=") && text.includes("GeneratePDF.php")) {
              const match = text.match(/GeneratePDF\.php\?([^'\"]+)/);
              if (match) {
                const params = match[1].split("/");
                const out = {};
                for (const p of params) {
                  const [k, v] = p.split("=");
                  if (k && v) out[k] = v;
                }
                return out;
              }
            }
          }
          return null;
        } catch (e) {
          return null;
        }
      }
    });

    if (result && result.p_key) {
      capturedPKey = result.p_key;
      yearInput.value = result.p_year || "";
      semesterInput.value = result.p_semester || "";
      departmentInput.value = stripStarAt(result.list_department) || "";
      courseInput.value = stripStarAt(result.list_course) || "";
      safeSelect(gradeInput, result.grade);
      saveInputs();
      setButtonsEnabled();
      if (landingStatusText) landingStatusText.textContent = "נמצא! מציגים את הטופס...";
      revealMain();
      return true;
    }
  } catch (e) {
    // silent fail
  }
  return false;
}

function safeSelect(selectElement, value) {
  if (!value) return;
  const clean = String(value).trim();
  const option = Array.from(selectElement.options).find(opt => opt.value === clean);
  if (option) {
    selectElement.value = clean;
  } else {
    selectElement.selectedIndex = 0;
  }
}

function startCaptureWatcher() {
  if (captureWatcherId) return;
  captureWatcherId = setInterval(async () => {
    if (landingStatusText) landingStatusText.textContent = "ממתינים לביצוע השלבים...";
    const ok = await captureParamsFromPage();
    if (ok) {
      clearInterval(captureWatcherId);
      captureWatcherId = null;
    }
  }, 1000);
}

// Events
if (showMainBtn) {
  showMainBtn.addEventListener("click", () => {});
}

generateButton.addEventListener("click", () => {
  const url = buildUrl();
  if (!url) return;
  hasGenerated = true;
  saveInputs();
  showGeneratedLink(url);
  setButtonsEnabled();
});

openButton.addEventListener("click", () => {
  const url = buildUrl();
  if (url) chrome.tabs.create({ url });
});

downloadButton.addEventListener("click", () => {
  const url = buildUrl();
  if (!url) return;
  chrome.downloads.download({
    url,
    filename: `bgu-grade-distribution-${Date.now()}.pdf`
  });
});

copyButton.addEventListener("click", async () => {
  const url = buildUrl();
  if (!url) return;
  await navigator.clipboard.writeText(url);
  copyButton.textContent = "✔️ הועתק!";
  setTimeout(() => (copyButton.textContent = "📄 העתק קישור"), 2000);
});

// Reset generated state when inputs change
[yearInput, semesterInput, departmentInput, courseInput, gradeInput].forEach(el => {
  if (!el) return;
  el.addEventListener("input", () => {
    hasGenerated = false;
    showGeneratedLink("");
    setButtonsEnabled();
  });
  el.addEventListener("change", () => {
    hasGenerated = false;
    showGeneratedLink("");
    setButtonsEnabled();
  });
});

function init() {
  showLanding();
  loadInputs();
  setButtonsEnabled();
  startCaptureWatcher();
}

document.addEventListener("DOMContentLoaded", init);
