"use client";

import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef } from "react";

/**
 * Get Help navigation (RSOS-116). The flow keeps, for this browser tab, the list of steps visited
 * since the page the customer came from:
 * - moving to the next step is one history entry (push); a correction on the same step replaces it;
 * - Back (the link or the phone's back gesture) goes to the previous step, and from the first step
 *   to the exact page the customer came from (the browser restores its scroll position);
 * - after submit, the request page replaces the flow, so Back from it returns to the start page;
 * - answers are also kept on the device for 2 hours (refresh, leaving and coming back).
 * Without JavaScript the plain forms and links still work.
 */
const STACK = "rsos_flow_stack";
const MEMORY = "rsos_flow_memory";
const TWO_HOURS = 2 * 3_600_000;
const LAST_PAGE = "rsos_last_page";

/** In the root layout: remembers the last site page outside the flow (where Back returns to). */
export function LastPage() {
  const path = usePathname();
  useEffect(() => {
    if (path.startsWith("/get-help") || path.startsWith("/r/")) return;
    try {
      sessionStorage.setItem(LAST_PAGE, path + location.search);
    } catch {
      /* private mode */
    }
  }, [path]);
  return null;
}

type Stack = { origin: string; steps: string[] };
const read = (): Stack | null => {
  try {
    return JSON.parse(sessionStorage.getItem(STACK) ?? "null") as Stack | null;
  } catch {
    return null;
  }
};
const write = (s: Stack | null) => {
  try {
    if (s) sessionStorage.setItem(STACK, JSON.stringify(s));
    else sessionStorage.removeItem(STACK);
  } catch {
    /* private mode */
  }
};
const here = () => location.pathname;

/** Mounted on every step: records the step and prefetches the next one. */
export function FlowTracker({ next }: { next: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const s = read();
    const path = here();
    const first = /^\/get-help(\/[a-z-]+\/problem)?$/.test(path);
    if (!s || (first && !s.steps.includes(path))) {
      // A new flow: it started from the last site page the customer saw.
      let origin = "/";
      try {
        origin = sessionStorage.getItem(LAST_PAGE) ?? "/";
      } catch {
        /* keep "/" */
      }
      write({ origin, steps: [path] });
    } else {
      const i = s.steps.indexOf(path);
      write({ origin: s.origin, steps: i >= 0 ? s.steps.slice(0, i + 1) : [...s.steps, path] });
    }
    if (next) router.prefetch(next);
  }, [next, router]);
  return null;
}

/** The in-page Back: the same as the browser's back when the previous entry is the flow's. */
export function BackLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        const s = read();
        if (!s) return;
        const i = s.steps.indexOf(here());
        // The previous history entry is the previous step, or (on the first step) the origin page.
        if (i > 0 || (i === 0 && s.origin)) {
          e.preventDefault();
          history.back();
        }
      }}
    >
      {children}
    </a>
  );
}

/** Downsizes a photo on the device (longest side 1600 px, JPEG) before it is sent. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

/** A Get Help form: submitted with fetch so history stays clean; plain POST without JavaScript. */
export function FlowForm({
  step,
  children,
  className,
  multipart = false,
}: {
  step: string;
  children: ReactNode;
  className?: string;
  multipart?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const sending = useRef(false);

  // Answers kept on the device for 2 hours: fill empty fields after a refresh or a return.
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    try {
      const all = JSON.parse(localStorage.getItem(MEMORY) ?? "{}") as Record<
        string,
        { at: number; v: Record<string, string> }
      >;
      const saved = all[step];
      if (saved && Date.now() - saved.at < TWO_HOURS)
        for (const [k, v] of Object.entries(saved.v)) {
          const els = form.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(k)}"]`);
          els.forEach((el) => {
            if (el.type === "radio" || el.type === "checkbox") {
              if (![...els].some((x) => x.checked) && el.value === v) el.checked = true;
            } else if (el.type !== "hidden" && el.type !== "file" && !el.value) el.value = v;
          });
        }
    } catch {
      /* ignore */
    }
    const save = () => {
      try {
        const v: Record<string, string> = {};
        new FormData(form).forEach((val, k) => {
          if (typeof val === "string" && k !== "cf-turnstile-response") v[k] = val;
        });
        const all = JSON.parse(localStorage.getItem(MEMORY) ?? "{}") as Record<string, unknown>;
        localStorage.setItem(MEMORY, JSON.stringify({ ...all, [step]: { at: Date.now(), v } }));
      } catch {
        /* private mode */
      }
    };
    form.addEventListener("change", save);
    return () => form.removeEventListener("change", save);
  }, [step]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    if (sending.current) return e.preventDefault();
    e.preventDefault();
    sending.current = true;
    const form = e.currentTarget;
    const body = new FormData(form);
    const files = body.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
    body.delete("photos");
    for (const f of files.slice(0, 3)) body.append("photos", await compress(f));
    try {
      const res = await fetch(form.action, { method: "POST", body, headers: { "x-flow": "1" } });
      const { to } = (await res.json()) as { to: string };
      if (to.startsWith("/r/")) {
        try {
          localStorage.removeItem(MEMORY);
        } catch {
          /* ignore */
        }
        const s = read();
        write(null);
        // Go back to the first step's entry, then put the request page there: Back from the
        // request page returns to the page the customer started from.
        const back = (s?.steps.length ?? 1) - 1;
        if (back > 0) {
          // Keep the app router from rendering (and redirecting) the emptied step meanwhile.
          addEventListener("popstate", (ev) => ev.stopImmediatePropagation(), {
            once: true,
            capture: true,
          });
          const first = s!.steps[0];
          const started = Date.now();
          const land = () => {
            if (location.pathname === first || Date.now() - started > 3000) location.replace(to);
            else setTimeout(land, 30);
          };
          history.go(-back);
          setTimeout(land, 30);
        } else location.replace(to);
        return;
      }
      if (new URL(to, location.href).pathname === here()) router.replace(to);
      else router.push(to);
    } catch {
      form.submit();
    } finally {
      sending.current = false;
    }
  };

  return (
    <form
      ref={ref}
      method="post"
      action="/api/get-help"
      encType={multipart ? "multipart/form-data" : undefined}
      onSubmit={onSubmit}
      className={className}
    >
      {children}
    </form>
  );
}
