import { headers } from "next/headers";

/**
 * Dynamic number insertion (RSOS-030): visitors who arrived from an ad or campaign (first-touch
 * cookie `rsos_src`, set by the proxy) see that source's tracking number in every tap-to-call link
 * marked `data-dni="<market slug>"`. Everyone else keeps the website number, with no request at
 * all. A small inline script (with the CSP nonce), not a client component: no JavaScript bundle
 * for the website's 150 KB budget.
 */
const SCRIPT = `(function(){function run(){var m=document.cookie.match(/(?:^|; )rsos_src=([^;]+)/);var s=m&&m[1];if(!s||s==="website")return;var f=function(e){var d=e.replace(/\\D/g,"").slice(-10);return"("+d.slice(0,3)+") "+d.slice(3,6)+"-"+d.slice(6)};var links=[].slice.call(document.querySelectorAll("a[data-dni]"));var seen={};links.forEach(function(l){var k=l.dataset.dni;if(!k||seen[k])return;seen[k]=1;fetch("/api/phone?market="+encodeURIComponent(k)+"&source="+encodeURIComponent(s)).then(function(r){return r.ok?r.json():null}).then(function(d){var p=d&&typeof d.phone==="string"?d.phone:null;if(!p||!/^\\+1\\d{10}$/.test(p))return;links.forEach(function(a){if(a.dataset.dni!==k)return;var old=f(a.href.replace(/^tel:/,""));a.href="tel:"+p;var lb=a.getAttribute("aria-label");if(lb)a.setAttribute("aria-label",lb.replace(old,f(p)));var t=a.hasAttribute("data-dni-text")?a:a.querySelector("[data-dni-text]");if(t)t.textContent=f(p)})}).catch(function(){})})}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run);else run()})();`;

export async function DniSwap() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
