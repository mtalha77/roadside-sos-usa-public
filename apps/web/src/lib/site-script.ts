/**
 * The website's only always-on script, inlined in <head> with the CSP nonce (RSOS-100). It replaces
 * three client components (theme provider, theme toggle, menu closer) so the home page ships less
 * JavaScript, and adds the night default and the sticky-bar trigger:
 *
 * - Theme: the visitor's saved choice wins; otherwise the system theme; with a light system theme,
 *   dark between 7pm and 6am local time (stranded drivers at night). Applied before first paint.
 * - `[data-theme-toggle]` buttons switch light and dark and save the choice.
 * - Header menus (`details[data-menu]`): one open at a time, closed by Escape (focus back to the
 *   button), an outside click or following a link inside.
 * - `html[data-hero=visible]` while a `[data-hero]` section is on screen: the phone action bar
 *   hides then (the hero already shows both actions) and appears once the hero scrolls away.
 */
export const SITE_SCRIPT = `(function(){
var d=document.documentElement,K="theme";
function stored(){try{var s=localStorage.getItem(K);return s==="light"||s==="dark"?s:null}catch(e){return null}}
function apply(t){d.classList.toggle("dark",t==="dark");d.style.colorScheme=t}
function pick(){var s=stored();if(s)return s;if(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches)return"dark";var h=new Date().getHours();return h>=19||h<6?"dark":"light"}
apply(pick());
try{matchMedia("(prefers-color-scheme: dark)").addEventListener("change",function(){if(!stored())apply(pick())})}catch(e){}
d.setAttribute("data-hero","visible");
function hero(){var h=document.querySelector("[data-hero]");var v=h&&h.getBoundingClientRect().bottom>0;if(v)d.setAttribute("data-hero","visible");else d.removeAttribute("data-hero")}
function menus(){return[].slice.call(document.querySelectorAll("details[data-menu]"))}
document.addEventListener("click",function(e){
var t=e.target&&e.target.closest?e.target:null;if(!t)return;
var tog=t.closest("[data-theme-toggle]");
if(tog){var n=d.classList.contains("dark")?"light":"dark";apply(n);try{localStorage.setItem(K,n)}catch(x){}return}
menus().forEach(function(m){if(m.open&&(!m.contains(t)||t.closest("a")))m.open=false});
setTimeout(hero,300);
});
document.addEventListener("keydown",function(e){if(e.key!=="Escape")return;menus().forEach(function(m){if(m.open){m.open=false;var s=m.querySelector("summary");if(s)s.focus()}})});
document.addEventListener("toggle",function(e){var m=e.target;if(m&&m.matches&&m.matches("details[data-menu]")&&m.open)menus().forEach(function(o){if(o!==m)o.open=false})},true);
addEventListener("scroll",hero,{passive:true});
addEventListener("popstate",function(){setTimeout(hero,300)});
document.addEventListener("DOMContentLoaded",hero);
})();`;
