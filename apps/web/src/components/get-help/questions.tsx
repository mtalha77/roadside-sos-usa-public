import type { Answers, Question } from "@rsos/core/service-questions";
import { inputClass } from "@rsos/ui/input";
import { getTranslations } from "next-intl/server";
import { ui } from "@/lib/ui-classes";

/**
 * Screen 1 questions (RSOS-116): large tap chips (no typing), follow-ups that appear when they
 * apply and red "Call 911 now" banners. Plain HTML with CSS `:has()`, so it works without
 * JavaScript. The classes are written out in full so Tailwind generates them.
 */
const SHOW_IF: Record<string, string> = {
  whenAt: "[form:has(#q-when-later:checked)_&]:flex",
  police: "[form:has(#q-accident-yes:checked)_&]:flex",
  heightLimit: "[form:has(#q-parked-garage:checked)_&]:flex",
};

/** Banners per answer: what the screen says (and offers) when that chip is chosen. */
const BANNERS: {
  when: string;
  kind: "call911" | "suggestTow" | "suggestWinch" | "evNoJump" | "evCharge";
  cls: string;
}[] = [
  { when: "safety-lane", kind: "call911", cls: "[form:has(#q-safety-lane:checked)_&]:flex" },
  {
    when: "childInside-yes",
    kind: "call911",
    cls: "[form:has(#q-childInside-yes:checked)_&]:flex",
  },
  { when: "flats-twoPlus", kind: "suggestTow", cls: "[form:has(#q-flats-twoPlus:checked)_&]:flex" },
  { when: "spare-none", kind: "suggestTow", cls: "[form:has(#q-spare-none:checked)_&]:flex" },
  { when: "upright-no", kind: "suggestTow", cls: "[form:has(#q-upright-no:checked)_&]:flex" },
  {
    when: "parked-offroad",
    kind: "suggestWinch",
    cls: "[form:has(#q-parked-offroad:checked)_&]:flex",
  },
  { when: "electric-yes", kind: "evNoJump", cls: "[form:has(#q-electric-yes:checked)_&]:flex" },
  { when: "fuel-electric", kind: "evCharge", cls: "[form:has(#q-fuel-electric:checked)_&]:flex" },
];

function Chip({
  name,
  value,
  checked,
  required,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  required: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center rounded-full border-2 border-border bg-surface px-4 py-2 text-base font-medium has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
      <input
        id={`q-${name}-${value}`}
        type="radio"
        name={`q.${name}`}
        value={value}
        defaultChecked={checked}
        required={required}
        className="sr-only"
      />
      {children}
    </label>
  );
}

export async function QuestionFields({
  questions,
  answers,
  missing,
}: {
  service?: string;
  questions: Question[];
  answers: Answers;
  missing: string[];
}) {
  const t = await getTranslations("getHelp.q");
  const tb = await getTranslations("getHelp.banner");
  const label = (id: string) => t(`${id}.label` as never);
  const opt = (id: string, o: string) => t(`${id}.options.${o}` as never);
  const bannerFor = (b: (typeof BANNERS)[number]) => (
    <div
      key={b.when}
      role={b.kind === "call911" ? "alert" : "status"}
      className={`hidden flex-col gap-3 rounded-2xl border-2 p-4 ${b.kind === "call911" ? "border-critical bg-critical-subtle" : "border-info bg-info-subtle"} ${b.cls}`}
    >
      <p className="font-semibold">{tb(`${b.kind}.${b.when}` as never)}</p>
      {b.kind === "call911" ? (
        <a href="tel:911" className={`${ui.button.primary} self-start`}>
          {tb("call911.button")}
        </a>
      ) : (
        <a
          href={`/get-help/${b.kind === "suggestWinch" ? "winch-out" : "tow"}/problem`}
          className="inline-flex min-h-touch items-center self-start font-semibold underline underline-offset-4"
        >
          {tb(b.kind === "suggestWinch" ? "switchWinch" : "switchTow")}
        </a>
      )}
    </div>
  );
  const after = (q: Question) =>
    BANNERS.filter((b) => (q.options ?? []).some((o) => b.when === `${q.id}-${o}`)).map(bannerFor);
  const fields = questions.flatMap((q) => [field(q), ...after(q)]);
  function field(q: Question) {
    const err = missing.includes(q.id);
    const shown = q.showIf ? `hidden flex-col gap-2 ${SHOW_IF[q.id] ?? ""}` : "flex flex-col gap-2";
    const optional = q.required ? "" : ` ${t("optional")}`;
    if (q.kind === "chips")
      return (
        <fieldset
          key={q.id}
          className={shown}
          aria-invalid={err || undefined}
          aria-describedby={err ? `q-${q.id}-err` : undefined}
        >
          <legend className="mb-1 font-semibold">
            {label(q.id)}
            <span className="font-normal text-muted-foreground">{optional}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {(q.options ?? []).map((o) => (
              <Chip
                key={o}
                name={q.id}
                value={o}
                checked={(answers[q.id] ?? q.default) === o}
                required={q.required && !q.showIf}
              >
                {opt(q.id, o)}
              </Chip>
            ))}
          </div>
          {err ? (
            <p
              id={`q-${q.id}-err`}
              role="alert"
              className="text-sm font-medium text-critical-strong"
            >
              {t("required")}
            </p>
          ) : null}
        </fieldset>
      );
    const input =
      q.kind === "count" ? (
        <input
          type="number"
          inputMode="numeric"
          name={`q.${q.id}`}
          min={q.min}
          max={q.max}
          defaultValue={answers[q.id] ?? ""}
          className={`${inputClass} w-28`}
        />
      ) : q.kind === "datetime" ? (
        <input
          type="datetime-local"
          name={`q.${q.id}`}
          defaultValue={answers[q.id] ?? ""}
          className={inputClass}
        />
      ) : (
        <input
          name={`q.${q.id}`}
          maxLength={q.max}
          defaultValue={answers[q.id] ?? ""}
          className={inputClass}
        />
      );
    return (
      <label key={q.id} className={`${shown} font-medium`}>
        <span>
          {label(q.id)}
          <span className="font-normal text-muted-foreground">{optional}</span>
        </span>
        {input}
        {err ? (
          <span role="alert" className="text-sm font-medium text-critical-strong">
            {t("required")}
          </span>
        ) : null}
      </label>
    );
  }
  return <>{fields}</>;
}
