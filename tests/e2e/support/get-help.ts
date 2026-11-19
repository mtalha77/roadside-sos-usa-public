import type { Page } from "@playwright/test";

/** Taps one chip in a question group (the radio itself is visually hidden behind its label). */
export async function tap(page: Page, question: string | RegExp, answer: string) {
  await page.getByRole("group", { name: question }).getByText(answer, { exact: true }).click();
}

/** Answers Get Help screen 1 (RSOS-116) with the required questions for a service, then continues. */
export async function answerScreenOne(page: Page, service: string, go = true) {
  await tap(page, /Are you in a safe place/, "Safe spot (parking lot, driveway)");
  const required: Record<string, [RegExp, string][]> = {
    "flat-tire": [
      [/How many flat tires/, "1"],
      [/Do you have a spare/, "Full-size"],
    ],
    tow: [
      [/Vehicle type/, "Car"],
      [/Does it roll and steer/, "Yes"],
      [/Was there an accident/, "No"],
    ],
    "wont-start": [
      [/What happens when you turn the key/, "Clicking"],
      [/Electric or hybrid/, "No"],
    ],
    "locked-out": [
      [/Where are the keys/, "Locked inside"],
      [/Is a child or pet inside/, "No"],
    ],
    "out-of-gas": [[/Fuel type/, "Regular"]],
    "winch-out": [
      [/Stuck in/, "Mud"],
      [/Distance from the road/, "Under 10 ft"],
      [/Is the vehicle upright/, "Yes"],
    ],
  };
  for (const [q, a] of required[service] ?? []) await tap(page, q, a);
  if (go) await page.getByRole("button", { name: "Continue" }).click();
}
