import "server-only";
import { brand } from "@rsos/config/brand";
import { themes } from "@rsos/config/tokens";
import { getMessages, type Locale } from "@rsos/i18n";

/**
 * The location link page (RSOS-023) as one small HTML document: inline CSS from our design tokens
 * and a ~3 KB script (CSP nonce), so it works on slow 3G with almost no JavaScript. Google Maps
 * loads only after the driver taps "Share my location", and only when Maps is switched on (keys
 * and MAPS_ENABLED; off in batch 4, so the browser's GPS coordinates are shown as text).
 */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function vars(theme: Record<string, string>) {
  return Object.entries(theme)
    .map(([k, v]) => `--${k}:${v}`)
    .join(";");
}

const CSS = `
:root{${vars(themes.light)};color-scheme:light}
@media (prefers-color-scheme:dark){:root{${vars(themes.dark)};color-scheme:dark}}
*{box-sizing:border-box}
body{margin:0;background:var(--background);color:var(--foreground);font:17px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:34rem;margin:0 auto;padding:24px 16px 48px;display:flex;flex-direction:column;gap:16px}
h1{font-size:28px;line-height:1.2;margin:0}
p{margin:0}
.muted{color:var(--muted-foreground);font-size:15px}
.brand{font-weight:600;color:var(--muted-foreground);font-size:15px}
.btn{display:flex;align-items:center;justify-content:center;gap:8px;min-height:56px;width:100%;border-radius:12px;border:0;font:inherit;font-weight:600;font-size:19px;cursor:pointer}
.primary{background:var(--primary);color:var(--primary-foreground)}
.outline{background:transparent;color:var(--foreground);border:1px solid var(--border)}
.btn:focus-visible,input:focus-visible,textarea:focus-visible{outline:3px solid var(--ring);outline-offset:2px}
.card{border:1px solid var(--border);background:var(--card);border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:12px}
label{display:flex;flex-direction:column;gap:6px;font-weight:500}
input,textarea{font:inherit;min-height:48px;padding:10px 12px;border-radius:10px;border:1px solid var(--input);background:var(--surface);color:var(--foreground)}
#map{width:100%;aspect-ratio:16/10;border-radius:16px;border:1px solid var(--border);display:none}
.alert{border-radius:12px;padding:12px;font-weight:600}
.ok{background:var(--success-subtle);color:var(--success-strong)}
.bad{background:var(--critical-subtle);color:var(--critical-strong)}
[hidden]{display:none!important}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

type PageText = ReturnType<typeof getMessages>["locationLink"];

function shell(locale: Locale, title: string, body: string, nonce: string, script = "") {
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title><style>${CSS}</style></head><body><main id="main">${body}</main>${script ? `<script nonce="${esc(nonce)}">${script}</script>` : ""}</body></html>`;
}

export function messagePage(
  locale: Locale,
  nonce: string,
  kind: "expired" | "done" | "error",
): string {
  const t = getMessages(locale).locationLink;
  const title = kind === "done" ? t.doneTitle : kind === "expired" ? t.expiredTitle : t.errorTitle;
  const body = kind === "done" ? t.doneBody : kind === "expired" ? t.expiredBody : t.errorBody;
  return shell(
    locale,
    title,
    `<p class="brand">${esc(brand.name)}</p><h1>${esc(title)}</h1><p${kind === "done" ? ' role="status" class="alert ok"' : ""}>${esc(body)}</p>`,
    nonce,
  );
}

export function sharePage(o: {
  locale: Locale;
  nonce: string;
  token: string;
  currentAddress: string | null;
  center: { lat: number; lng: number } | null;
  mapsKey: string | null;
  error: string | null;
}): string {
  const t: PageText = getMessages(o.locale).locationLink;
  const err = o.error
    ? `<p role="alert" class="alert bad">${esc(t.errors[o.error as keyof PageText["errors"]] ?? t.errors.generic)}</p>`
    : "";
  const body = `
<p class="brand">${esc(brand.name)}</p>
<h1>${esc(t.title)}</h1>
<p>${esc(t.intro)}</p>
${err}
<form class="card" method="post" action="/l/${esc(o.token)}" enctype="multipart/form-data" id="f">
  <input type="hidden" name="lat" id="lat"><input type="hidden" name="lng" id="lng">
  <button type="button" class="btn primary" id="share">${esc(t.share)}</button>
  <p id="status" role="status" aria-live="polite" class="muted"></p>
  <div id="map" role="img" aria-label="${esc(t.mapLabel)}"></div>
  <p id="drag" class="muted" hidden>${esc(t.drag)}</p>
  <label>${esc(t.address)}<input name="address" id="address" autocomplete="street-address" value="${esc(o.currentAddress ?? "")}"></label>
  <p class="muted">${esc(t.addressHint)}</p>
  <label>${esc(t.note)}<textarea name="note" rows="2" maxlength="300" placeholder="${esc(t.notePlaceholder)}"></textarea></label>
  <label>${esc(t.photo)}<input type="file" name="photo" accept="image/*" capture="environment"></label>
  <button type="submit" class="btn outline" id="send">${esc(t.send)}</button>
</form>
<p class="muted">${esc(t.safety)}</p>`;
  const script = `(function(){
var T=${JSON.stringify({ finding: t.finding, found: t.found, denied: t.denied, unsupported: t.unsupported })};
var K=${JSON.stringify(o.mapsKey)};
var $=function(i){return document.getElementById(i)};
function set(lat,lng){$("lat").value=lat.toFixed(6);$("lng").value=lng.toFixed(6);$("status").textContent=T.found.replace("{lat}",lat.toFixed(5)).replace("{lng}",lng.toFixed(5));}
function map(lat,lng){if(!K)return;window.__rsosMap=function(){google.maps.importLibrary("maps").then(function(m){return google.maps.importLibrary("marker").then(function(k){var el=$("map");el.style.display="block";var g=new m.Map(el,{center:{lat:lat,lng:lng},zoom:17,mapId:"DEMO_MAP_ID",disableDefaultUI:true,zoomControl:true,colorScheme:matchMedia("(prefers-color-scheme: dark)").matches?"DARK":"LIGHT"});var p=new k.AdvancedMarkerElement({map:g,position:{lat:lat,lng:lng},gmpDraggable:true,title:"pin"});p.addListener("dragend",function(){var q=p.position;set(typeof q.lat==="function"?q.lat():q.lat,typeof q.lng==="function"?q.lng():q.lng);});$("drag").hidden=false;});});};var s=document.createElement("script");s.src="https://maps.googleapis.com/maps/api/js?key="+encodeURIComponent(K)+"&v=weekly&loading=async&callback=__rsosMap";s.async=true;document.head.appendChild(s);}
$("share").addEventListener("click",function(){if(!navigator.geolocation){$("status").textContent=T.unsupported;$("address").focus();return;}$("status").textContent=T.finding;navigator.geolocation.getCurrentPosition(function(p){set(p.coords.latitude,p.coords.longitude);map(p.coords.latitude,p.coords.longitude);$("send").className="btn primary";$("share").className="btn outline";$("send").focus();},function(){$("status").textContent=T.denied;$("address").focus();},{enableHighAccuracy:true,timeout:15000,maximumAge:30000});});
})();`;
  return shell(o.locale, t.title, body, o.nonce, script);
}

/** /l: the driver types the 6-digit code the dispatcher read on the call (no SMS in batch 4). */
export function codePage(locale: Locale, nonce: string, error: string | null): string {
  const t: PageText = getMessages(locale).locationLink;
  const err = error
    ? `<p role="alert" class="alert bad">${esc(t.errors[error as keyof PageText["errors"]] ?? t.errors.generic)}</p>`
    : "";
  return shell(
    locale,
    t.codeTitle,
    `<p class="brand">${esc(brand.name)}</p>
<h1>${esc(t.codeTitle)}</h1>
<p>${esc(t.codeIntro)}</p>
${err}
<form class="card" method="post" action="/l">
  <label>${esc(t.code)}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required></label>
  <button type="submit" class="btn primary">${esc(t.codeSubmit)}</button>
</form>
<p class="muted">${esc(t.safety)}</p>`,
    nonce,
  );
}
