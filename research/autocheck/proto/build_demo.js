/* Builds research/autocheck/demo.html: a standalone page (not part of the site) to try the checker on a phone and time it there. */
const fs = require("fs"), path = require("path"), C = require("./check.js"), S = path.join(__dirname, "../stand");
const tasks = [], cands = [];
for (const f of fs.readdirSync(path.join(S, "tasks"))) { const rf = path.join(S, "rubrics", f), rub = {};
  if (fs.existsSync(rf)) JSON.parse(fs.readFileSync(rf)).forEach(r => rub[r.task] = r.check);
  for (const t of JSON.parse(fs.readFileSync(path.join(S, "tasks", f)))) tasks.push(Object.assign({}, t, { check: rub[t.id] ? C.sanitize(t, rub[t.id]).check : null }));
  const cf = path.join(S, "cands", f); if (fs.existsSync(cf)) JSON.parse(fs.readFileSync(cf)).forEach(c => cands.push([c.task, c.answer, c.cls])); }
const esc = s => s.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Synapso · прототип автопроверки</title>
<style>
:root{--bg:#050607;--fg:#d7dde0;--dim:#7c868b;--c:#2DE2E6;--line:#1c2226}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 ui-monospace,Menlo,monospace;padding:16px;max-width:760px;margin:auto}
h1{font-size:15px;color:var(--c);letter-spacing:.08em}select,textarea,button{font:inherit;color:var(--fg);background:#0b0e10;border:1px solid var(--line);border-radius:6px;width:100%;padding:10px}
textarea{min-height:150px}button{width:auto;margin:8px 8px 0 0;border-color:var(--c);color:var(--c)}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#0b0e10;border:1px solid var(--line);border-radius:6px;padding:10px;font-size:12px}
.p{color:var(--dim)}.v{margin-top:12px;padding:12px;border-radius:6px;border:1px solid var(--line)}.v b{letter-spacing:.08em}
.ok{border-color:#2DE2E6}.no{border-color:#e06c75}.check{border-color:#d9b24c}.unsure{border-color:#555}li{margin:6px 0}small{color:var(--dim)}
</style>
<h1>SYNAPSO · ПРОТОТИП АВТОПРОВЕРКИ</h1>
<p class="p">Отдельная страница для исследования. С сайтом не связана, прогресс не трогает. Работает офлайн.</p>
<select id="t"></select><p id="pr"></p><pre id="code"></pre>
<textarea id="a" spellcheck="false" autocapitalize="off" autocorrect="off" placeholder="> ответ по памяти"></textarea>
<button id="go">ПРОВЕРИТЬ</button><button id="ex">ПРИМЕР ОТВЕТА</button><button id="key">КЛЮЧ</button><button id="bench">ЗАМЕР НА ЭТОМ УСТРОЙСТВЕ</button>
<div id="out"></div><pre id="k" hidden></pre>
<script>${esc(fs.readFileSync(path.join(__dirname, "check.js"), "utf8"))}</script>
<script>const TASKS=${esc(JSON.stringify(tasks))},CANDS=${esc(JSON.stringify(cands))};
const $=id=>document.getElementById(id),sel=$("t");TASKS.forEach((t,i)=>{const o=document.createElement("option");o.value=i;o.textContent=t.id+" · "+t.kind+" · "+t.title;sel.appendChild(o);});
const cur=()=>TASKS[+sel.value];let exI=0;
function show(){const t=cur();$("pr").textContent=t.prompt;$("code").textContent=t.code||"";$("a").value="";$("out").innerHTML="";$("k").hidden=true;$("k").textContent=t.key;exI=0;}
sel.onchange=show;show();
const NAME={ok:"ВЕРНО · совпало с ключом или проверенным вариантом",no:"НЕВЕРНО · узнал известную ошибку",check:"ПРОВЕРЬ · есть вопрос к ответу",unsure:"НЕ УВЕРЕН · сверь с ключом сам"};
$("go").onclick=()=>{const t=cur(),t0=performance.now(),r=SynCheck.verdict($("a").value,t,t.check),ms=performance.now()-t0;
 $("out").innerHTML='<div class="v '+r.v+'"><b>'+NAME[r.v]+'</b>'+(r.msgs&&r.msgs.length?"<ul>"+r.msgs.map(m=>"<li>"+m.replace(/</g,"&lt;")+"</li>").join("")+"</ul>":"")+'<small>этап: '+r.why+' · '+ms.toFixed(1)+' мс</small></div>';};
$("ex").onclick=()=>{const c=CANDS.filter(c=>c[0]===cur().id);if(!c.length)return;const x=c[exI++%c.length];$("a").value=x[1];$("go").click();};
$("key").onclick=()=>{$("k").hidden=!$("k").hidden;};
$("bench").onclick=()=>{const by={};TASKS.forEach(t=>by[t.id]=t);const ts=[];for(let rep=0;rep<3;rep++)CANDS.forEach(c=>{const t0=performance.now();SynCheck.verdict(c[1],by[c[0]],by[c[0]].check);ts.push(performance.now()-t0);});
 ts.sort((a,b)=>a-b);const q=f=>ts[Math.floor(f*(ts.length-1))].toFixed(2);
 $("out").innerHTML='<div class="v unsure"><b>ЗАМЕР</b><ul><li>проверок: '+ts.length+'</li><li>медиана: '+q(.5)+' мс</li><li>95%: '+q(.95)+' мс</li><li>максимум: '+q(1)+' мс</li><li>всего: '+ts.reduce((a,b)=>a+b,0).toFixed(0)+' мс</li></ul><small>пришли эти цифры — это время на твоём устройстве</small></div>';};
</script></html>`;
fs.writeFileSync(path.join(__dirname, "../demo.html"), html); console.log("demo.html", (html.length / 1024).toFixed(0) + " KB");
