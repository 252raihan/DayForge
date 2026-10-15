// End-to-end smoke: sign up a throwaway user, then walk the app's main routes
// and report what actually rendered. Read-only with respect to production data:
// the account is brand new, so nothing existing is touched.
const stamp = Date.now();
const email = `qa+${stamp}@dayforge-qa.example`;
const password = "Qa!Passw0rd123";
const out = { email, steps: [] };

export default async function run(page, ui) {
  const step = (name, value) => out.steps.push({ name, value });

  // ---- Sign up -------------------------------------------------------------
  await page.goto("http://localhost:3000/signup", { waitUntil: "domcontentloaded" });
  let snap = await ui.snapshot();
  const nameBox = snap.match(/@(e\d+) textbox "Name"/)?.[1];
  const emailBox = snap.match(/@(e\d+) textbox "Email"/)?.[1];
  const passBox = snap.match(/@(e\d+) textbox "Password"/)?.[1];
  const confBox = snap.match(/@(e\d+) textbox "Confirm password"/)?.[1];
  if (!nameBox || !emailBox || !passBox || !confBox) {
    step("signup-fields", "MISSING");
    return out;
  }

  await ui.fill(`@${nameBox}`, "QA Tester");
  await ui.fill(`@${emailBox}`, email);
  await ui.fill(`@${passBox}`, password);
  await ui.fill(`@${confBox}`, password);

  snap = await ui.snapshot();
  const createBtn = snap.match(/@(e\d+) button "Create account"/)?.[1];
  if (!createBtn) {
    step("create-button", "MISSING");
    return out;
  }
  await ui.click(`@${createBtn}`);
  await page.waitForTimeout(4000);

  const afterSignup = await page.evaluate(() => ({
    url: location.pathname,
    body: document.body.innerText.slice(0, 300),
  }));
  step("after-signup", afterSignup);

  // If email confirmation is on, we cannot proceed past this screen.
  if (afterSignup.url.includes("signup")) {
    step("result", "BLOCKED_EMAIL_CONFIRMATION");
    return out;
  }

  // ---- Walk each route -----------------------------------------------------
  const routes = [
    ["dashboard", "/dashboard"],
    ["tasks", "/tasks"],
    ["calendar", "/calendar"],
    ["notes", "/notes"],
    ["challenges", "/challenges"],
    ["habits", "/habits"],
    ["settings", "/settings"],
  ];

  for (const [name, path] of routes) {
    await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const info = await page.evaluate(() => ({
      url: location.pathname,
      headings: [...document.querySelectorAll("h1,h2")].map((h) => h.innerText).slice(0, 6),
      buttons: [...document.querySelectorAll("button")].map((b) => b.innerText.trim()).filter(Boolean).slice(0, 12),
      text: document.body.innerText.replace(/\s+/g, " ").slice(0, 220),
      hasOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    }));
    step(`route:${name}`, info);
  }

  return out;
}
