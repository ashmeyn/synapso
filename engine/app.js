
(function(){
"use strict";
const DATA = JSON.parse(document.getElementById("data").textContent);
/* PHONE: computed once in <head> (pointer: coarse && min(screen.width, innerWidth) < 980, or #phone/#desktop). All phone-only behaviour is gated on it. */
const PHONE = document.documentElement.classList.contains("phone");
/* map hint «перетащи — вращать»: only the first 2 visits (pm.mapHint = visits that showed it) */
if(!PHONE) (()=>{ const h=document.getElementById("mapHint"); if(!h) return; let n=0; try{ n=+JSON.parse(localStorage.getItem("pm.mapHint")||"0")||0; }catch(e){} if(n>=2){ h.hidden=true; return; } try{ localStorage.setItem("pm.mapHint", JSON.stringify(n+1)); }catch(e){} })();

/* ---------- course structure ---------- */
const BRANCHES = [
  {code:"01", name:"КАРКАС", topics:[
    ["opt","Optional и способы развернуть","J",90],["coll","Коллекции: Array, Dictionary, Set","J",120],
    ["func","Функции: внешние имена, inout","J",60],["enum","Enum: associated values, if case let","J",90],
    ["flow","guard, switch, циклы","J",45],["hof","map, filter, reduce, compactMap","J",90],
    ["err","Ошибки: throws, do/catch, Result","J",90],["skel","Каркас функции для задачи на массив","J",60],
    ["bigo","Сложность O(n)","J",60],["setdict","Подсчёт и «уже видел»: Dictionary, Set","J",90]]},
  {code:"02", name:"SWIFTUI", topics:[
    ["state","@State и @Binding","J",90],["obs","@StateObject, @ObservedObject, @Observable","J",90],
    ["flowui","Поток данных и модификаторы","J",90],["mvvm","MVVM: зачем и где границы","J",90],
    ["nav","Навигация в SwiftUI","M",60],["uilife","Жизненный цикл SwiftUI: идентичность, .task","J",90],["env","@Environment: значения сверху вниз","J",60],
    ["proto","Протокол как контракт","J",60],
    ["di","Dependency Injection","J",90],["clos","Замыкания и capture list","J",90],
    ["access","Модификаторы доступа, final","J",45],["combine","Combine: Publisher и подписки","M",120]]},
  {code:"03", name:"СЕТЬ", topics:[
    ["rest","REST: методы, заголовки, коды","J",60],["codable","Codable","J",60],["urls","URLSession","J",90],
    ["esc","@escaping и non-escaping","J",45],["store","UserDefaults, Keychain, файлы","J",60],
    ["mapkit","MapKit: карта и аннотации","J",90],["cache","NSCache и кэш картинок","M",60],["realtime","Real-time: WebSocket, push, SSE, polling","M",90]]},
  {code:"04", name:"ПАМЯТЬ", topics:[
    ["valref","Value vs reference, stack vs heap","J",90],["cow","Copy-on-Write","M",60],
    ["arc","ARC и жизненный цикл объекта","J",90],["weak","weak, unowned, retain cycle","J",90],
    ["eq","== vs ===, Equatable","J",45],["leaks","Поиск утечек: Memory Graph","M",60],["arpool","Autorelease pool","M",45]]},
  {code:"05", name:"ПОТОКИ", topics:[
    ["queues","Очереди: serial/concurrent, sync/async","J",120],["race","Гонка данных","M",120],
    ["dead","Deadlock","M",90],["group","DispatchGroup","M",90],["gcdmore","Семафор, barrier, Operation","M",90],
    ["async","async/await, Task, TaskGroup","M",150],["actor","Actors, @MainActor, Sendable","M",120],["locks","Locks: NSLock, recursive, unfair","M",90],["runloop","RunLoop и Timer","M",90],["threadbug","Livelock, priority inversion, starvation","M",60]]},
  {code:"06", name:"ЯЗЫК", topics:[
    ["gen","Generics","M",120],["assoc","associatedtype, some и any","M",120],
    ["disp","Диспетчеризация: vtable, witness table","M",150],["pw","Property wrappers","M",60],["fp","Функциональный стиль","J",60],["objc","Objective-C runtime","S",90]]},
  {code:"07", name:"UIKIT", topics:[
    ["vclc","Жизненный цикл UIViewController","J",60],["frame","Frame vs bounds","J",30],["layout","Auto Layout","J",90],
    ["table","UITableView, переиспользование ячеек","J",90],["hit","Responder chain и hitTest","M",60],
    ["coord","Router и Coordinator","M",60],["collection","UICollectionView: Diffable, Compositional","M",120],["coreanim","CoreAnimation: слои и анимации","M",90],["render","Как рисуется UI","S",60]]},
  {code:"08", name:"ФИНАЛ", topics:[
    ["solid","SOLID, KISS, DRY","J",90],["arch","MVC, MVP, VIPER, Clean","M",90],
    ["patt","Паттерны: delegate, observer, factory","J",90],["tests","Unit-тесты и моки","M",120],
    ["git","Git: ветки, rebase, конфликты","J",60],["debug","Отладка: breakpoints, View Hierarchy","J",45],
    ["spm","SPM и модульность","M",60],["uitest","UI- и snapshot-тесты","M",90],["review","Code review и Crashlytics","J",45],["tca","TCA и Redux-подход","S",90],["sysd","Mobile system design","M",180],
    ["coredata","CoreData или SwiftData","M",120],["sort","Сортировка: sorted(by:), O(n log n)","J",60],["ptr","Два указателя, строки","J",120],
    ["live","Live-coding: 20 задач","M",600],["feature","Фича с нуля без подсказок","M",600]]}
];
const CROSS = [["clos","weak"],["proto","gen"],["di","tests"],["async","urls"],["actor","race"],["valref","cow"],
  ["state","valref"],["table","layout"],["mvvm","arch"],["err","urls"],["hof","coll"],["disp","proto"],
  ["esc","clos"],["coord","nav"],["uilife","state"],["sort","bigo"],["sort","hof"],["uilife","vclc"],["env","di"],["obs","arc"],["group","async"],["leaks","weak"],["patt","di"],["codable","enum"],["hit","vclc"],
  ["locks","race"],["locks","dead"],["runloop","weak"],["runloop","vclc"],["threadbug","dead"],["combine","obs"],["combine","clos"],["cache","store"],["realtime","urls"],["arpool","arc"],["objc","disp"],["fp","hof"],["collection","table"],["coreanim","layout"],["render","runloop"],["uitest","tests"],["tca","arch"],["review","git"]];

/* ---------- sound: generative ambience + responsive fx (synthesized, off by default) ---------- */
const sfx = (()=>{
  const ls=(k,d)=>{ try{ const v=localStorage.getItem(k); return v==null?d:v; }catch(e){ return d; } };
  let keyProf=(v=>v==="off"?"off":"drop")(ls("pm.keysnd","drop")), on = ls("pm.sfx","0")==="1", volAmb=+ls("pm.volAmb","0.45"), volFx=+ls("pm.volFx","0.7");
  let ctx=null, master, ambBus, fxBus, verb, verbSend, amb=null, scene="intro", progDone=0, progDue=0, lastTick=0, lastHover=0, lastCrack=0, sparkT=null;
  const PENTA=[0,3,5,7,10,12,15,17,19,22,24,27,29,31]; const noteF=(k,base=220)=>base*Math.pow(2,PENTA[((k%PENTA.length)+PENTA.length)%PENTA.length]/12);
  const SCENE_GAIN={intro:1, map:0.75, topic:0.16};
  function impulse(sec){ const n=ctx.sampleRate*sec, buf=ctx.createBuffer(2,n,ctx.sampleRate); for(let c=0;c<2;c++){ const d=buf.getChannelData(c); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.6); } return buf; }
  function ensure(){
    if(ctx) return true;
    try{ const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return false; ctx=new AC(); }catch(e){ return false; }
    master=ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
    ambBus=ctx.createGain(); ambBus.gain.value=0; ambBus.connect(master);
    fxBus=ctx.createGain(); fxBus.gain.value=volFx; fxBus.connect(master);
    verb=ctx.createConvolver(); verb.buffer=impulse(2.6); const vg=ctx.createGain(); vg.gain.value=0.9; verb.connect(vg); vg.connect(master);
    verbSend=ctx.createGain(); verbSend.gain.value=0.35; verbSend.connect(verb);
    return true;
  }
  function ready(){ if(!on) return false; if(!ctx && !ensure()) return false; if(ctx.state==="suspended") ctx.resume(); return true; }
  function env(g,t,a,peak,dur){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+dur); }
  function tone(f,dur,type,gain,opt={}){ if(!ready()) return; const t=ctx.currentTime+(opt.delay||0), o=ctx.createOscillator(), g=ctx.createGain(); o.type=type||"sine"; o.frequency.setValueAtTime(f,t); if(opt.to) o.frequency.exponentialRampToValueAtTime(opt.to,t+dur);
    env(g,t,opt.attack||0.008,gain,dur); let node=g; if(opt.pan!=null && ctx.createStereoPanner){ const pn=ctx.createStereoPanner(); pn.pan.value=opt.pan; g.connect(pn); node=pn; }
    o.connect(g); node.connect(opt.bus||fxBus); if(opt.verb) node.connect(verbSend); o.start(t); o.stop(t+dur+0.05); }
  function noise(dur,gain,freq,q,opt={}){ if(!ready()) return; const t=ctx.currentTime+(opt.delay||0), n=Math.max(1,(ctx.sampleRate*dur)|0), buf=ctx.createBuffer(1,n,ctx.sampleRate), d=buf.getChannelData(0); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*(1-i/n);
    const src=ctx.createBufferSource(), f=ctx.createBiquadFilter(), g=ctx.createGain(); src.buffer=buf; f.type=opt.type||"bandpass"; f.frequency.setValueAtTime(freq,t); if(opt.to) f.frequency.exponentialRampToValueAtTime(opt.to,t+dur); f.Q.value=q||1; g.gain.value=gain;
    let node=g; if(opt.pan!=null && ctx.createStereoPanner){ const pn=ctx.createStereoPanner(); pn.pan.value=opt.pan; g.connect(pn); node=pn; }
    src.connect(f); f.connect(g); node.connect(opt.bus||fxBus); if(opt.verb) node.connect(verbSend); src.start(t); }
  /* ---- generative ambience ---- */
  const VOICES=[55,82.41,110,130.81,164.81,196,246.94];
  function startAmb(){
    if(amb || !ready()) return;
    const filt=ctx.createBiquadFilter(); filt.type="lowpass"; filt.frequency.value=520; filt.Q.value=0.7; filt.connect(ambBus); filt.connect(verbSend);
    const lfo=ctx.createOscillator(), lfoG=ctx.createGain(); lfo.frequency.value=0.045; lfoG.gain.value=260; lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
    const voices=VOICES.map((f,i)=>{ const o=ctx.createOscillator(), g=ctx.createGain(), wob=ctx.createOscillator(), wg=ctx.createGain();
      o.type = i<2 ? "sine" : "triangle"; o.frequency.value=f; o.detune.value=(Math.random()-0.5)*9; g.gain.value=0;
      wob.frequency.value=0.03+Math.random()*0.06; wg.gain.value= i<2 ? 0.018 : 0.009; wob.connect(wg); wg.connect(g.gain); wob.start();
      o.connect(g); g.connect(filt); o.start(); return {o,g}; });
    const dis=ctx.createOscillator(), dg=ctx.createGain(); dis.type="sine"; dis.frequency.value=116.5; dg.gain.value=0; dis.connect(dg); dg.connect(filt); dis.start();
    amb={filt,voices,dg}; updateAmb(); sparkLoop();
  }
  function updateAmb(){
    if(!amb || !ctx) return; const t=ctx.currentTime, n=Math.min(VOICES.length, 2+Math.floor(progDone/6));
    amb.voices.forEach((v,i)=>v.g.gain.setTargetAtTime(i<n ? (i<2?0.06:0.026) : 0, t, 2.5));
    amb.dg.gain.setTargetAtTime(Math.min(0.04, progDue*0.01), t, 3);
    amb.filt.frequency.setTargetAtTime(scene==="intro" ? 760 : 520, t, 2);
    ambBus.gain.setTargetAtTime(on ? volAmb*(SCENE_GAIN[scene]??0.7)*0.5 : 0, t, scene==="topic" ? 0.8 : 1.6);
  }
  function sparkLoop(){ clearTimeout(sparkT); const wait = scene==="intro" ? 1600+Math.random()*2200 : scene==="map" ? 3500+Math.random()*4500 : 9000+Math.random()*9000;
    sparkT=setTimeout(()=>{ if(on && amb && scene!=="topic"){ const k=5+((Math.random()*7)|0); tone(noteF(k,220), 2.4, "sine", 0.035*volAmb, {bus:ambBus, verb:true, attack:0.02, pan:(Math.random()-0.5)*0.8}); if(scene==="intro" && Math.random()<0.4) tone(noteF(k+2,220), 2.6, "sine", 0.02*volAmb, {bus:ambBus, verb:true, attack:0.03, delay:0.35}); } sparkLoop(); }, wait); }
  return {
    get on(){ return on; }, get volAmb(){ return volAmb; }, get volFx(){ return volFx; },
    toggle(){ on=!on; try{ localStorage.setItem("pm.sfx", on?"1":"0"); }catch(e){}
      if(on){ ensure(); if(ctx && ctx.state==="suspended") ctx.resume(); startAmb(); updateAmb(); this.select(); } else { updateAmb(); setTimeout(()=>{ if(!on && ctx && ctx.state==="running") ctx.suspend(); }, 2500); } return on; },
    wake(){ if(on){ ensure(); if(ctx && ctx.state==="suspended") ctx.resume(); startAmb(); updateAmb(); } },
    setVol(kind,v){ v=Math.max(0,Math.min(1,v)); if(kind==="amb"){ volAmb=v; try{ localStorage.setItem("pm.volAmb",v); }catch(e){} updateAmb(); } else { volFx=v; try{ localStorage.setItem("pm.volFx",v); }catch(e){} if(fxBus) fxBus.gain.setTargetAtTime(v, ctx.currentTime, 0.05); } },
    setScene(m){ const was=scene; scene=m; updateAmb(); if(on && was!==m){ sparkLoop(); if(was==="topic" && m==="map") this.back(); } },
    setProgress(done,due){ progDone=done; progDue=due; updateAmb(); },
    hover(b,k){ const n=performance.now(); if(n-lastHover<60) return; lastHover=n; tone(noteF((b*2+(k||0))%10+3,220), 0.32, "triangle", 0.03, {verb:true}); },
    select(b){ const r=(b||0)*2%7; [0,2,4].forEach((d,j)=>tone(noteF(r+d+5,220),0.7,"sine",0.035,{delay:j*0.035,verb:true})); },
    tick(){ const n=performance.now(); if(n-lastTick<42) return; lastTick=n; noise(0.012,0.04,4200+Math.random()*1800,2.5); },
    get keyProf(){ return keyProf; },
    setKeyProf(n){ keyProf=n; try{ localStorage.setItem("pm.keysnd",n); }catch(e){} },
    key(kind,ch){ if(keyProf==="off") return; const r=Math.random(), c=ch?ch.charCodeAt(0):0;
      if(keyProf==="tw"){
        if(kind==="enter"){ tone(2600,0.55,"sine",0.04,{verb:true}); noise(0.28,0.05,1600,1,{to:300}); noise(0.05,0.06,600,1); }
        else if(kind==="space"){ noise(0.04,0.07,600,1); tone(80,0.06,"triangle",0.05); }
        else if(kind==="back"){ noise(0.03,0.06,2000,1.5); tone(300,0.05,"triangle",0.03,{to:150}); }
        else { noise(0.012,0.1,3200+r*800,2.5); noise(0.03,0.05,700,1); tone(1800+r*300,0.02,"square",0.012); }
      } else if(keyProf==="term"){
        if(kind==="enter") tone(440,0.1,"square",0.025,{to:880});
        else if(kind==="space") tone(300,0.04,"square",0.02);
        else if(kind==="back") tone(220,0.07,"square",0.02,{to:110});
        else tone(700+(c%9)*95,0.05,"square",0.02);
      } else if(keyProf==="drop"){
        if(kind==="enter") [0,2,4].forEach((d,j)=>tone(noteF(d+5,220),0.5,"sine",0.03,{delay:j*0.05,verb:true}));
        else if(kind==="space") tone(noteF(2,220),0.3,"sine",0.03,{verb:true});
        else if(kind==="back") tone(noteF(6,220),0.2,"sine",0.025,{to:noteF(2,220),verb:true});
        else tone(noteF(c%10+5,220),0.26,"sine",0.028,{verb:true,pan:((c%7)-3)/8});
      } else if(keyProf==="soft"){
        if(kind==="enter") noise(0.07,0.035,1100,0.8,{type:"lowpass"});
        else noise(kind==="space"?0.04:0.03,0.03,1300+r*500,0.8,{type:"lowpass"});
      } else {
        if(kind==="enter"){ noise(0.05,0.07,900,1,{}); tone(95,0.09,"triangle",0.05,{}); tone(2350,0.22,"sine",0.018,{delay:0.03,verb:true}); }
        else if(kind==="space"){ noise(0.026,0.06,1300+r*300,1.2); tone(105,0.04,"square",0.012); }
        else if(kind==="back"){ noise(0.02,0.045,1000+r*300,1.4); tone(140,0.03,"square",0.008); }
        else { noise(0.018,0.06,2300+r*1500,1.8); tone(150+r*40,0.03,"square",0.012); }
      }
      if(ch && "(){}[]\"`".indexOf(ch)>=0 && keyProf!=="term") tone(660,0.05,"triangle",0.018); },
    crackle(pan){ const n=performance.now(); if(n-lastCrack<55 || Math.random()<0.45) return; lastCrack=n; noise(0.007, 0.018+Math.random()*0.02, 2600+Math.random()*4200, 3, {pan:Math.max(-1,Math.min(1,pan)), verb:Math.random()<0.3}); },
    step(k,done){ tone(noteF(k+3,220),0.5,"triangle",0.06,{verb:true}); if(done) [0,2,4,7].forEach((d,j)=>tone(noteF(d+3,220)*(j===3?1:1),1.6,"sine",0.05,{delay:0.18+j*0.07,verb:true,attack:0.03})); },
    ok(){ [5,7,9].forEach((k,j)=>tone(noteF(k,220),0.32,"triangle",0.055,{delay:j*0.07,verb:true})); },
    no(){ tone(160,0.24,"sawtooth",0.035,{to:70}); noise(0.08,0.05,900,0.8); },
    open(){ noise(0.55,0.06,300,0.7,{to:3800,type:"bandpass",verb:true}); tone(110,0.6,"sine",0.05,{to:440,verb:true}); },
    back(){ noise(0.45,0.05,3200,0.7,{to:260,verb:true}); tone(440,0.5,"sine",0.04,{to:110}); },
    wave(){ tone(98,1.6,"sine",0.025,{attack:0.4,bus:ambBus,verb:true}); },
    ping(){ tone(1320,0.9,"sine",0.05,{verb:true}); tone(1320,0.9,"sine",0.025,{delay:0.28,verb:true}); tone(1320,0.9,"sine",0.012,{delay:0.56,verb:true}); }
  };
})();
document.addEventListener("pointerdown",()=>sfx.wake(),{once:true});

/* ---------- text scramble on hover ---------- */
const SCR_CH="▓▒░<>/\\#$%&*+=01{}[]ЖЗЛФЦЭ";
function scramble(el){
  if(reduceScr || el.dataset.scr==="1") return;
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); let node=null, n; while((n=w.nextNode())){ if(n.nodeValue.trim().length>1){ node=n; break; } }
  if(!node) return; const orig=node.nodeValue; el.dataset.scr="1"; const t0=performance.now(), D=320;
  (function step(){ const k=Math.min(1,(performance.now()-t0)/D), keep=Math.floor(orig.length*k);
    node.nodeValue = orig.split("").map((c,i)=> i<keep || c===" " ? c : SCR_CH[(Math.random()*SCR_CH.length)|0]).join("");
    if(k<1) requestAnimationFrame(step); else { node.nodeValue=orig; el.dataset.scr=""; } })();
}
const reduceScr = window.matchMedia("(prefers-reduced-motion: reduce)").matches || PHONE;
document.addEventListener("mouseover", e=>{ const b=e.target.closest && e.target.closest(".wtabs button, .cta, .contBtn, .runBtn, .navlist button, .deepBtn, .blabel, .ghostbtn, .more, .nbr .links button, .fontbtn, .settings summary, .kswap, .tn-b, .card-nav .textbtn, .card-x, .bank-h .textbtn"); if(b && !(e.relatedTarget && b.contains(e.relatedTarget))) scramble(b); });

/* ---------- background event log ---------- */
const fxQueue=[]; function fxLog(tag, text){ fxQueue.push({tag, text}); if(fxQueue.length>6) fxQueue.shift(); }

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
let progDirty=false;   /* progress written since the last gist sync */
const store = {
  get(k,d){ try{ const v = localStorage.getItem(k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} if(k.indexOf("pm.")===0){ askPersist(); progDirty=true; } }
};
/* ask the browser not to evict localStorage (Safari drops it after 7 days without a visit); once per page, on the first progress write */
let persistAsked=false;
function askPersist(){ if(persistAsked) return; persistAsked=true; try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p=>p||navigator.storage.persist()).catch(()=>{}); }catch(e){} }
let seed = 20261010;
function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function randDir(){ const u = rnd()*2-1, a = rnd()*Math.PI*2, s = Math.sqrt(1-u*u); return [s*Math.cos(a), u, s*Math.sin(a)]; }
const SX=1.2, SY=0.94, SZ=1.0;
function shape(x,y,z){
  const r=Math.hypot(x,y,z)||1, th=Math.atan2(z,x), ph=Math.acos(Math.max(-1,Math.min(1,y/r)));
  const gy = 1 + 0.045*Math.sin(7*th+1.3)*Math.sin(5*ph) + 0.028*Math.sin(13*th+0.4)*Math.sin(9*ph+0.7);
  let X=x*0.98*gy, Y=y*0.86*gy, Z=z*1.24*gy;
  if(Y<0) Y*=0.78;
  X += (X>=0?0.12:-0.12);
  return [X,Y,Z];
}
const HEMI=[-1,1,1,-1,1,-1,1,-1]; /* 01 КАРКАС L · 02 SWIFTUI R · 03 СЕТЬ R · 04 ПАМЯТЬ L · 05 ПОТОКИ R · 06 ЯЗЫК L · 07 UIKIT R · 08 ФИНАЛ L */
const HEMI_YZ={"-1":[[0.6,0.38],[-0.1,-0.72],[0.12,0.72],[-0.62,-0.2]], "1":[[0.6,-0.38],[0.1,0.72],[-0.12,-0.72],[-0.62,0.2]]};

/* ---------- nodes ---------- */
const TNAMES = {"opt": ["Optional", "Как работать со значением, которого может не быть."], "coll": ["Array, Dictionary, Set", "Как хранить списки, пары и уникальные значения."], "func": ["Функции и inout", "Как называть параметры и менять переданную переменную."], "enum": ["Enum", "Как описать возможные состояния экрана."], "flow": ["guard, switch, циклы", "Как вести код без лестницы вложенных if."], "hof": ["map / filter / reduce", "Как преобразовать список данных."], "err": ["Ошибки и throws", "Как сообщить, что пошло не так, и обработать это."], "skel": ["Каркас решения", "Как не зависнуть перед пустым редактором на задаче."], "bigo": ["Big-O", "Как понять, будет ли код тормозить на больших данных."], "setdict": ["Подсчёт: Dictionary и Set", "Как посчитать частоты и найти повторы за один проход."], "state": ["@State и @Binding", "Как экран хранит своё состояние и делится им."], "obs": ["@StateObject и @Observable", "Кто владеет моделью экрана и как она обновляет UI."], "flowui": ["Поток данных в SwiftUI", "Как данные идут от модели к экрану и обратно."], "mvvm": ["MVVM", "Как отделить логику от экрана, чтобы её можно было тестировать."], "nav": ["Навигация в SwiftUI", "Как переходить между экранами и передавать данные."], "sort": ["Сортировка", "Как упорядочить список своим правилом и сколько это стоит."], "uilife": ["Жизненный цикл SwiftUI", "Когда вью та же самая и когда грузить данные."], "env": ["@Environment", "Как отдать значение всему поддереву без init."], "proto": ["Протоколы", "Как описать контракт, не привязываясь к конкретному типу."], "di": ["Dependency Injection", "Как передавать зависимости снаружи, а не создавать внутри."], "clos": ["Замыкания", "Как передавать код как значение и не поймать утечку."], "access": ["Модификаторы доступа", "Как спрятать детали и показать только нужное."], "combine": ["Combine", "Как подписаться на поток событий и реагировать на него."], "rest": ["REST", "Как приложение разговаривает с сервером."], "codable": ["Codable", "Как превратить JSON в модели Swift и обратно."], "urls": ["URLSession", "Как отправить запрос и получить ответ из сети."], "esc": ["@escaping", "Почему замыкание иногда живёт дольше функции."], "store": ["UserDefaults и Keychain", "Где хранить настройки, секреты и файлы."], "mapkit": ["MapKit", "Как показать карту и точки на ней."], "cache": ["NSCache", "Как не скачивать одну и ту же картинку дважды."], "realtime": ["Real-time", "Как получать обновления без перезагрузки экрана."], "valref": ["Value и Reference", "Чем копия отличается от общей ссылки на объект."], "cow": ["Copy-on-Write", "Почему копировать массив дёшево, пока его не меняют."], "arc": ["ARC", "Как Swift решает, когда освободить объект."], "weak": ["weak и unowned", "Как не дать объектам держать друг друга вечно."], "eq": ["== и ===", "Чем равные значения отличаются от одного и того же объекта."], "leaks": ["Поиск утечек", "Как найти объект, который не освобождается."], "arpool": ["Autorelease pool", "Как сбросить временную память в тяжёлом цикле."], "queues": ["GCD: очереди", "Как сделать работу в фоне и вернуться на главный поток."], "race": ["Гонка данных", "Почему два потока портят общие данные."], "dead": ["Deadlock", "Почему приложение может навсегда зависнуть."], "group": ["DispatchGroup", "Как дождаться нескольких задач сразу."], "gcdmore": ["Semaphore, barrier, Operation", "Как ограничить и упорядочить параллельную работу."], "async": ["async/await", "Как писать асинхронный код без лестницы колбэков."], "actor": ["Actors", "Как защитить состояние от гонок средствами языка."], "locks": ["Locks", "Как пускать в общий код только один поток."], "runloop": ["RunLoop и Timer", "Почему таймер замирает при скролле и держит экран."], "threadbug": ["Livelock и priority inversion", "Какие ещё ловушки бывают у потоков, кроме deadlock."], "gen": ["Generics", "Как написать код один раз для разных типов."], "assoc": ["some, any, associatedtype", "Как протоколы работают с заранее неизвестными типами."], "disp": ["Диспетчеризация", "Как Swift решает, какую реализацию метода вызвать."], "pw": ["Property wrappers", "Как вынести повторяющуюся логику свойства в обёртку."], "fp": ["Функциональный стиль", "Как собирать код из маленьких чистых функций."], "objc": ["Objective-C runtime", "Как устроена динамика под капотом UIKit."], "vclc": ["Жизненный цикл VC", "В каком порядке экран загружается и появляется."], "frame": ["frame и bounds", "Где view стоит и как устроены её координаты."], "layout": ["Auto Layout", "Как описать расположение view правилами."], "table": ["UITableView", "Как показать длинный список и переиспользовать ячейки."], "hit": ["hitTest и Responder chain", "Как касание находит нужную view."], "coord": ["Coordinator", "Как вынести навигацию из контроллеров."], "collection": ["UICollectionView", "Как собрать сетку и сложные списки."], "coreanim": ["Core Animation", "Как устроены слои и плавные анимации."], "render": ["Отрисовка UI", "Что происходит между изменением view и кадром на экране."], "solid": ["SOLID", "Как писать код, который легко менять."], "arch": ["Архитектуры", "Чем отличаются MVC, MVP, VIPER и Clean."], "patt": ["Паттерны", "Delegate, observer и factory на живых примерах."], "tests": ["Unit-тесты", "Как проверить логику и подменить зависимости моками."], "git": ["Git", "Как работать в ветках и решать конфликты."], "debug": ["Отладка", "Как поймать баг с breakpoints и View Hierarchy."], "spm": ["SPM и модули", "Как подключать пакеты и делить проект на модули."], "uitest": ["UI- и snapshot-тесты", "Как проверить экран целиком."], "review": ["Code review", "Как читать чужой код и следить за крэшами."], "tca": ["TCA", "Как построить приложение на однонаправленном потоке данных."], "sysd": ["System design", "Как спроектировать мобильное приложение целиком."], "coredata": ["Core Data и SwiftData", "Как хранить данные в базе на устройстве."], "ptr": ["Два указателя", "Как решать задачи на строки и массивы за один проход."], "live": ["Live-coding", "Как решать задачу на собесе вслух и без паники."], "feature": ["Фича с нуля", "Как довести задачу от требований до работающего экрана."]};
const topics = [], bcenters = [];
const hemiCount={"-1":0,"1":0};
BRANCHES.forEach((br,bi)=>{
  const side=HEMI[bi%HEMI.length], slot=HEMI_YZ[side][hemiCount[side]++ % 4], y=slot[0], z=slot[1], x=side*Math.sqrt(Math.max(0.08,1-y*y-z*z));
  bcenters.push([x, y, z]);
  br.topics.forEach(([id,title,lvl,min],k)=>{
    const status = "none";
    const tn=TNAMES[id]||[title,""];
    topics.push({id,title:tn[0],sub:tn[1],full:title,lvl,min,b:bi,k,status});
  });
});
const T = topics.length, F = 1000, N = T + F;
const pos = new Float32Array(N*3), nodeBranch = new Int16Array(N);
topics.forEach((t,i)=>{
  const c = bcenters[t.b];
  const d = [c[0]+(rnd()-0.5)*0.42, c[1]+(rnd()-0.5)*0.42, c[2]+(rnd()-0.5)*0.42]; if(Math.sign(d[0])!==Math.sign(c[0])) d[0]=c[0]*0.35;
  const l = Math.hypot(d[0],d[1],d[2]), rr = 0.84 + rnd()*0.14;
  pos.set(shape(d[0]/l*rr, d[1]/l*rr, d[2]/l*rr), i*3); nodeBranch[i] = t.b;
});
for(let k=0;k<F;k++){
  const d = randDir(), rr = 0.32 + 0.66*Math.pow(rnd(),0.32);
  const p = shape(d[0]*rr, d[1]*rr, d[2]*rr), i = T+k; pos.set(p, i*3);
  let best=-1, bd=1e9;
  for(let b=0;b<bcenters.length;b++){ const c=shape(...bcenters[b]); const dd=(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2; if(dd<bd){bd=dd;best=b;} }
  nodeBranch[i]=best;
}
const idIndex = Object.fromEntries(topics.map((t,i)=>[t.id,i]));
function d2(a,b){ return (pos[a*3]-pos[b*3])**2+(pos[a*3+1]-pos[b*3+1])**2+(pos[a*3+2]-pos[b*3+2])**2; }

/* ---------- edges ---------- */
const edges = [], adj = Array.from({length:N},()=>[]), topicLinks = Array.from({length:T},()=>new Set()), seen = new Set();
function addEdge(a,b,kind){ if(a===b||a<0||b<0) return; if(kind!=="x" && kind!=="c" && Math.sign(pos[a*3])!==Math.sign(pos[b*3]) && rnd()>0.05) return; const k = a<b? a+"_"+b : b+"_"+a; if(seen.has(k)) return; seen.add(k); edges.push([a,b,kind]); adj[a].push(b); adj[b].push(a); }
for(let i=T;i<N;i++){
  let n1=-1,n2=-1,a1=1e9,a2=1e9;
  for(let j=T;j<N;j++){ if(j===i) continue; const d=d2(i,j); if(d<a1){a2=a1;n2=n1;a1=d;n1=j;} else if(d<a2){a2=d;n2=j;} }
  addEdge(i,n1,"f"); if(a2<0.05) addEdge(i,n2,"f");
}
for(let i=0;i<T;i++){
  const near=[]; for(let j=T;j<N;j++) near.push([d2(i,j),j]); near.sort((a,b)=>a[0]-b[0]);
  for(let k=0;k<4;k++) addEdge(i,near[k][1],"d");
}
for(let i=0;i<T;i++){
  const near=[]; for(let j=T;j<N;j++) near.push([d2(i,j),j]); near.sort((a,b)=>a[0]-b[0]);
  for(let k=4;k<11;k++) addEdge(i,near[k][1],"g");
}
const fillTopic=new Int16Array(N).fill(-1);
for(let j=T;j<N;j++){ let bt=-1, bd=0.07; for(let i=0;i<T;i++){ const d=d2(i,j); if(d<bd){bd=d;bt=i;} } fillTopic[j]=bt; }
let off=0; BRANCHES.forEach(br=>{ for(let k=0;k<br.topics.length-1;k++){ addEdge(off+k,off+k+1,"c"); topicLinks[off+k].add(off+k+1); topicLinks[off+k+1].add(off+k);} off+=br.topics.length; });
CROSS.forEach(([a,b])=>{ const i=idIndex[a], j=idIndex[b]; if(i==null||j==null) return; addEdge(i,j,"x"); topicLinks[i].add(j); topicLinks[j].add(i); });
let curIdx = 0, hotList = [], routeAt = 0;
const hot = new Uint8Array(N);
let IMPORTED = store.get("pm.imported", {}), KNOWN = store.get("pm.known", {}), SKIP = store.get("pm.skip", {});
let checkMode = null, forceStep = -1;
function topicProgress(id){ const c=DATA.content[id]; const steps=c?c.steps:[]; const p=progressOf(id); return {ok:steps.filter(x=>p[x.id]==="ok").length, total:steps.length, p, steps}; }
/* honest status (02.11): a topic is "done" only after step 7 recalled from memory (pm.recall.<id>) AND the «Выгрузка»
   (pm.out.<id>) passed. Topics that were done by the old rule (5 of 7 steps / «Уже знаю» / old import) are kept once
   as pm.legacy (migration marker pm.honest); their next SRS review goes through the honest path. */
let LEGACY = store.get("pm.legacy", {});
function recallOf(id){ return store.get("pm.recall."+id, null); }   /* {at, v:"ok"|"part"|"no", pass:ts|0} — step 7 by memory */
function rootOf(id){ return store.get("pm.roots."+id, null)||{}; }    /* {at, v:"ok"|"no"} — last recall of this topic as a root («Корни») of another */
function outOf(id){ return store.get("pm.out."+id, null); }         /* {at, g:[...], v, pass:ts|0} — «Выгрузка» */
function gradesOf(id){ return store.get("pm.grade."+id, {}); }       /* {s1:"ok"|"part"|"no", ...} — 3-level self-grade */
function honestDone(id){ const r=recallOf(id), o=outOf(id); return !!(r && r.pass && o && o.pass); }
function migrateHonest(){
  if(store.get("pm.honest", null)) return;
  const L=store.get("pm.legacy", {}), now=Date.now();
  Object.keys(DATA.content).forEach(id=>{ const pr=topicProgress(id); if(pr.ok>=5 || KNOWN[id] || IMPORTED[id]==="done") L[id]=store.get("pm.doneAt."+id,0)||now; });
  LEGACY=L; store.set("pm.legacy", L); store.set("pm.honest", {v:1, at:now});
}
migrateHonest();
function statusOf(id){ if(!DATA.content[id]) return "dark"; if(LEGACY[id] || honestDone(id)) return "done"; const pr=topicProgress(id); if(pr.ok>0 || Object.keys(pr.p).length || IMPORTED[id]==="prog" || recallOf(id) || outOf(id)) return "prog"; return "none"; }
const DAY=86400000, SRS_DAYS=[1,3,7,14,30,60];
function srsOf(id){
  let r=store.get("pm.srs."+id,null);
  if(!r && statusOf(id)==="done"){ const at=store.get("pm.doneAt."+id,0)||Date.now(); const p=progressOf(id);
    r = p.s7==="ok" ? {stage:1, due:at+SRS_DAYS[1]*DAY, lapses:0} : {stage:0, due:at+20*3600*1000, lapses:0}; store.set("pm.srs."+id, r); }
  return r;
}
function isDue(id){
  if(statusOf(id)!=="done"){ const r=store.get("pm.srs."+id,null); const o=outOf(id); return !!r && r.due<=Date.now() && ((!!o && o.v!=="ok") || rootOf(id).v==="no"); } /* «нет» in Выгрузка before the topic is done: come back tomorrow */
  const r=srsOf(id); return !!r && r.due<=Date.now(); }
function srsHold(id){ const r=srsOf(id)||{stage:0,lapses:0}; r.due=Date.now()+DAY; store.set("pm.srs."+id, r); }
/* one self-grade into the existing SRS: recalled → next rung, partly → same rung tomorrow, no → reset, tomorrow */
function srsGrade(id, v){ v==="ok" ? srsPass(id) : v==="part" ? srsHold(id) : srsFail(id); }
const GATE_CHARS=12, GATE_WORDS=6;
function plural(n, f){ const a=n%10, b=n%100; return f[(a===1&&b!==11)?0:(a>=2&&a<=4&&(b<10||b>=20))?1:2]; }
/* how much is still missing before the key may open: written answers need 12 non-space characters, oral ones 6 words */
function answerLeft(v, oral){ const s=String(v||""); return oral ? Math.max(0, GATE_WORDS-(s.match(/[\p{L}\p{N}_]{2,}/gu)||[]).length) : Math.max(0, GATE_CHARS-s.replace(/\s/g,"").length); }
function gateText(v, oral){ const n=answerLeft(v, oral); return n ? "Ключ откроется после ответа · ещё "+n+" "+(oral?plural(n,["слово","слова","слов"]):plural(n,["знак","знака","знаков"])) : ""; }
function srsPass(id){ fxLog("SRS","NODE://"+id.toUpperCase()+" · ПОВТОР ЗАСЧИТАН"); const r=srsOf(id)||{stage:0,lapses:0}; r.stage=Math.min(SRS_DAYS.length-1, r.stage+1); r.due=Date.now()+SRS_DAYS[r.stage]*DAY; store.set("pm.srs."+id, r); }
function srsFail(id){ fxLog("SRS","NODE://"+id.toUpperCase()+" · ЛЕСЕНКА СБРОШЕНА"); const r=srsOf(id)||{stage:0,lapses:0}; r.stage=0; r.lapses=(r.lapses||0)+1; r.due=Date.now()+DAY; store.set("pm.srs."+id, r); }
function logErr(id, q, note){ const list=store.get("pm.err."+id,[]); list.unshift({at:Date.now(), q:String(q).slice(0,400), note:String(note||"").slice(0,600)}); store.set("pm.err."+id, list.slice(0,20)); }
/* ---------- errors come back (pm.back, pm.err stays as is): an item graded «нет» returns to the daily run on day 1 and day 3 after the miss;
   two «вспомнил» in a row on its due day close it. pm.back = {"<k>:<topic>:<ref>": {t, k, ref, q?, a?, eq, at, ok, next, done?}}
   k: "s" step · "b" bank task · "o" «Проверь себя» question (ref = index) · "q" run card (q/a kept, ref = hash). eq = the pm.err text it matches. */
const BACK_DAYS=[1,3];
function dayStart(ts){ const d=new Date(ts); d.setHours(0,0,0,0); return d.getTime(); }
function addDays(ts, n){ const d=new Date(dayStart(ts)); d.setDate(d.getDate()+n); return d.getTime(); }
function daysTo(ts){ return Math.round((dayStart(ts)-dayStart(Date.now()))/DAY); }
function strHash(s){ let h=5381; s=String(s); for(let i=0;i<s.length;i++) h=((h<<5)+h+s.charCodeAt(i))|0; return (h>>>0).toString(36); }
function backAll(){ const m=store.get("pm.back",{}); return m && typeof m==="object" && !Array.isArray(m) ? m : {}; }
function backSave(all){ const now=Date.now(); let ks=Object.keys(all).filter(k=>!all[k].done || now-all[k].done<30*DAY);
  if(ks.length>300) ks=ks.sort((a,b)=>(all[b].at||0)-(all[a].at||0)).slice(0,300);
  const out={}; ks.forEach(k=>out[k]=all[k]); store.set("pm.back", out); }
function backKey(k, t, ref){ return k+":"+t+":"+ref; }
function backFail(k, t, ref, eq, q, a){ const all=backAll(), key=backKey(k,t,ref), now=Date.now(), old=all[key]||{};
  const e={t, k, ref, eq:String(eq||old.eq||"").slice(0,400), at:now, ok:0, next:addDays(now, BACK_DAYS[0])};
  if(k==="q"){ e.q=String(q!=null?q:old.q||"").slice(0,400); e.a=String(a!=null?a:old.a||"").slice(0,1200); }
  all[key]=e; backSave(all); return key; }
/* a «вспомнил» counts only on the day the item is due (a quick re-try right after the miss does not close it) */
function backPass(key){ const all=backAll(), e=all[key], now=Date.now(); if(!e || e.done || e.next>now) return false;
  e.ok=(e.ok||0)+1; if(e.ok>=BACK_DAYS.length) e.done=now; else e.next=Math.max(addDays(e.at, BACK_DAYS[e.ok]), addDays(now,1));
  backSave(all); fxLog("BACK", e.done ? "ОШИБКА ЗАКРЫТА · ВСПОМНИЛ ДВАЖДЫ" : "ОШИБКА ВЕРНЁТСЯ ЕЩЁ РАЗ"); return true; }
function backDueList(){ const now=Date.now(); return Object.entries(backAll()).filter(([k,e])=>!e.done && e.next<=now && DATA.content[e.t]).sort((a,b)=>a[1].next-b[1].next); }
function backFor(t, eq){ let best=null; Object.values(backAll()).forEach(e=>{ if(e.t===t && e.eq===eq && (!best || e.at>best.at)) best=e; }); return best; }
function backLabel(e){
  if(!e) return "";
  if(e.done) return "ЗАКРЫТА · ВСПОМНИЛ 2 РАЗА ПОДРЯД";
  const d=daysTo(e.next), when = d<=0 ? "СЕГОДНЯ В РАНЕ" : d===1 ? "ЗАВТРА" : "ЧЕРЕЗ "+d+" "+plural(d,["ДЕНЬ","ДНЯ","ДНЕЙ"]);
  return "ВЕРНЁТСЯ "+when+" · "+(e.ok||0)+" / "+BACK_DAYS.length; }
const stepEq = s => short(s.title)+": "+s.prompt;
const bankEq = s => s.title+": "+s.prompt;
const outEq = q => "Выгрузка: "+htmlText(q);
function fmtDate(ts){ const d=new Date(ts); return String(d.getDate()).padStart(2,"0")+"."+String(d.getMonth()+1).padStart(2,"0"); }
function whenLabel(ts){ const d=Math.round((ts-Date.now())/DAY); return d<=0?"СЕГОДНЯ":d===1?"ЗАВТРА":"ЧЕРЕЗ "+d+" ДН."; }
/* stages (09.11 backlog p.9): 4 stages over the branches; a topic is "in fog" while any of its lesson prereqs is not «освоено» */
const STAGES = [{n:1, name:"SWIFT-БАЗА", br:[0]}, {n:2, name:"SWIFTUI-ПРИЛОЖЕНИЕ", br:[1]}, {n:3, name:"СЕТЬ И ПАМЯТЬ", br:[2,3,4]}, {n:4, name:"СОБЕСЕДОВАНИЕ", br:[5,6,7]}];
function stageOfB(b){ const k=STAGES.findIndex(s=>s.br.includes(b)); return k<0 ? STAGES.length-1 : k; }
const TIDX = {}; topics.forEach((t,i)=>{ TIDX[t.id]=i; });
const PRE = topics.map(t=>{ const L=(DATA.content[t.id]||{}).lesson; return ((L&&L.prereqs)||[]).map(p=>TIDX[p]).filter(j=>j!=null && topics[j].id!==t.id); });
function stageStats(k){ const idx=topics.map((t,i)=>i).filter(i=>STAGES[k].br.includes(topics[i].b));
  return {total:idx.length, done:idx.filter(i=>topics[i].status==="done").length, fog:idx.filter(i=>topics[i].fog).length}; }
function computeStatuses(){
  topics.forEach(t=>{ t.status=statusOf(t.id); t.due=isDue(t.id); t.legacy = t.status==="done" && !honestDone(t.id) && !!LEGACY[t.id]; });
  topics.forEach((t,i)=>{ t.miss = PRE[i].filter(j=>topics[j].status!=="done"); t.fog = t.status==="none" && !t.due && t.miss.length>0; });
  let nx = topics.findIndex(t=>t.due); if(nx<0) nx = topics.findIndex(t=>t.status==="prog"); if(nx<0) nx = topics.findIndex(t=>t.status==="none" && !t.fog && !SKIP[t.id]); if(nx<0) nx = topics.findIndex(t=>t.status==="none" && !t.fog); if(nx<0) nx = topics.findIndex(t=>t.status==="none"); if(nx<0) nx=0;
  curIdx = nx; topics.forEach((t,i)=>{ t.cur = i===curIdx; if(t.cur) t.fog=false; });
  routeAt = topics.findIndex(t=>t.status!=="done" && t.status!=="dark" && !t.fog); if(routeAt<0) routeAt = topics.findIndex(t=>t.status!=="done" && t.status!=="dark"); if(routeAt<0) routeAt = topics.length-1;
  for(let i=0;i<N;i++) hot[i] = (i<T && topics[i].b===topics[curIdx].b) || d2(i,curIdx) < 0.09 ? 1 : 0;
  hotList = topics.map((t,i)=>i).filter(i=>topics[i].b===topics[curIdx].b);
}
computeStatuses();
/* TIDX (topic id -> index) is declared once above, next to STAGES; «Корни» uses the same map */
function prereqsOf(id){ const L=(DATA.content[id]||{}).lesson; return ((L && L.prereqs)||[]).filter(p=>p!==id && TIDX[p]!==undefined); }
const GROWS={}; topics.forEach((t,i)=>prereqsOf(t.id).forEach(p=>{ (GROWS[p]=GROWS[p]||[]).push(i); }));   /* reverse prereqs */
function nextIdx(i){ for(let j=i+1;j<topics.length;j++) if(topics[j].status!=="dark") return j; return -1; }
function prevIdx(i){ for(let j=i-1;j>=0;j--) if(topics[j].status!=="dark") return j; return -1; }
function startCheck(i){ const t=topics[i]; checkMode=t.id; const st=(DATA.content[t.id]||{}).steps||[]; forceStep=Math.max(0, st.findIndex(x=>x.id==="s7")); fxLog("SCAN","NODE://"+t.id.toUpperCase()+" · ПРОВЕРКА ЗНАНИЯ"); openTopic(i,"practice"); }
function skipTopic(i){ SKIP[topics[i].id]=Date.now(); store.set("pm.skip",SKIP); fxLog("SKIP","NODE://"+topics[i].id.toUpperCase()+" · ОТЛОЖЕНА"); refreshProgress(); }

/* ---------- three.js scene ---------- */
const brain = $("brain"), canvas = $("c"), mainEl = $("main");
let NOGL=false, renderer;
if(PHONE){ renderer={setClearColor(){},setPixelRatio(){},setSize(){},render(){},domElement:canvas}; } /* phone: no WebGL context, the 3D map is replaced by a list */
else try{ renderer = new THREE.WebGLRenderer({canvas, antialias:true}); }
catch(err){ NOGL=true; renderer={setClearColor(){},setPixelRatio(){},setSize(){},render(){},domElement:canvas};
  canvas.style.display="none";
  mainEl.insertAdjacentHTML("beforeend",'<div class="nogl" id="noGl"><b>КАРТА НЕДОСТУПНА</b> · в этом браузере нет WebGL. Темы и практика работают: открой список тем.<button type="button" class="fontbtn" id="noGlBtn">СПИСОК ТЕМ</button></div>'); }
renderer.setClearColor(0x050607, 1);
const PR = Math.min(window.devicePixelRatio||1, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2); renderer.setPixelRatio(PR);
let composer=null, bloomPass=null;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50), root = new THREE.Group(); scene.add(root);
const WHITE=[0.95,0.96,0.96], GREY=[0.55,0.6,0.63], CYAN=[0.176,0.886,0.902], VIOLET=[0.62,0.42,1.0];
const INTRO_TINT=new THREE.Color(0.78,0.62,1.25), NO_TINT=new THREE.Color(1,1,1);
const VS = `attribute float size; attribute float alpha; attribute float ring; attribute vec3 color; attribute vec3 scatter;
varying vec3 vColor; varying float vAlpha; varying float vRing; uniform float uPR; uniform float uScale; uniform vec2 uFog; uniform float uAsm;
void main(){ vec3 pp = mix(scatter, position, uAsm); vec4 mv = modelViewMatrix*vec4(pp,1.0); float dz = -mv.z;
  gl_PointSize = size*uPR*uScale*(3.6/ dz); gl_Position = projectionMatrix*mv; vColor=color; vRing=ring;
  vAlpha = alpha * mix(0.22, 1.0, 1.0 - smoothstep(uFog.x, uFog.y, dz)); }`;
const FS = `varying vec3 vColor; varying float vAlpha; varying float vRing;
void main(){ vec2 p = gl_PointCoord-0.5; float d = length(p); if(d>0.5) discard;
  float a = vRing>0.5 ? smoothstep(0.07,0.0,abs(d-0.34))*0.95 + smoothstep(0.5,0.0,d)*0.12 : pow(smoothstep(0.5,0.0,d),1.7);
  gl_FragColor = vec4(vColor, a*vAlpha); }`;
const uScale = {value:1}, uFog = {value:new THREE.Vector2(3.2,5.2)}, uAsm = {value:1};
function pmat(){ return new THREE.ShaderMaterial({uniforms:{uPR:{value:PR}, uScale, uFog, uAsm}, vertexShader:VS, fragmentShader:FS, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending}); }

const nGeo = new THREE.BufferGeometry(); nGeo.setAttribute("position", new THREE.BufferAttribute(pos,3));
const nCol = new Float32Array(N*3), nSize = new Float32Array(N), nAlpha = new Float32Array(N), nRing = new Float32Array(N), baseSize = new Float32Array(N), baseAlpha = new Float32Array(N);
function retentionOf(i){ const t=topics[i]; if(t.status!=="done") return 1; const r=srsOf(t.id); if(!r) return 1; const od=(Date.now()-r.due)/DAY; return od<=0 ? 1 : Math.max(0.28, 0.85 - od*0.09); }
function growthOf(i){ const t=topics[i]; if(t.status==="done") return 1; if(t.status!=="prog") return 0; const pr=topicProgress(t.id); return pr.total ? Math.max(0.15, pr.ok/pr.total) : 0.15; }
const mixc=(a,b,k)=>[a[0]+(b[0]-a[0])*k, a[1]+(b[1]-a[1])*k, a[2]+(b[2]-a[2])*k];
const IBLUE=[0.45,0.55,1.0], ISEED=new Float32Array(20000).map(()=>Math.random());
function applyNodeStyles(){
  if(typeof mode!=="undefined" && mode==="intro"){
    for(let i=0;i<N;i++){ const r=ISEED[i]; const c = r<0.3 ? VIOLET : r<0.55 ? IBLUE : r<0.68 ? CYAN : [0.75,0.78,0.95];
      nCol.set(c,i*3); baseSize[i] = i<T ? 4.5+ISEED[i+5000]*3 : 1.8+ISEED[i+5000]*1.4; baseAlpha[i] = i<T ? 0.7 : 0.35+ISEED[i+9000]*0.25; nRing[i]=0; }
    if(nGeo.attributes.color){ nGeo.attributes.color.needsUpdate=true; nGeo.attributes.ring.needsUpdate=true; }
    return;
  }
  for(let i=0;i<N;i++){
    let c=GREY, s=2.1, a=0.42, r=0;
    if(i<T){ const t=topics[i], ret=retentionOf(i), gr=growthOf(i);
      if(t.cur){ c=CYAN; s=12+gr*3; a=1; r=t.due?1:0; }
      else if(t.due){ c=mixc(GREY,CYAN,ret); s=7+5*ret; a=0.45+0.5*ret; r=1; }
      else if(t.status==="done"){ c=WHITE; s=12.5; a=1; }
      else if(t.status==="prog"){ c=WHITE; s=6+6*gr; a=0.75+0.2*gr; r=1; }
      else if(t.status==="dark"){ c=GREY; s=6; a=0.4; r=1; }
      else if(t.fog){ c=GREY; s=3; a=0.16; }   /* in fog: prereqs not «освоено» yet */
      else { c=GREY; s=5; a=0.62; } }
    else if(fillTopic[i]>=0 && topics[fillTopic[i]].status==="done"){ const ret=retentionOf(fillTopic[i]); c=mixc(GREY,[0.78,0.94,0.96],ret); a=0.42+0.4*ret; s=2.1+1.1*ret; }
    else if(fillTopic[i]>=0 && topics[fillTopic[i]].status==="prog"){ const gr=growthOf(fillTopic[i]); a=0.42+0.22*gr; s=2.1+0.6*gr; }
    else if(hot[i]){ c=[0.35,0.75,0.77]; a=0.5; }
    nCol.set(c,i*3); baseSize[i]=s; baseAlpha[i]=a; nRing[i]=r;
  }
  if(nGeo.attributes.color){ nGeo.attributes.color.needsUpdate=true; nGeo.attributes.ring.needsUpdate=true; }
}
applyNodeStyles();
nSize.set(baseSize); nAlpha.set(baseAlpha);
const scatter = new Float32Array(N*3);
for(let i=0;i<N;i++){ const d=randDir(), f=2.2+rnd()*2.6; scatter[i*3]=pos[i*3]*f+d[0]*1.4; scatter[i*3+1]=pos[i*3+1]*f+d[1]*1.4; scatter[i*3+2]=pos[i*3+2]*f+d[2]*1.4; }
nGeo.setAttribute("scatter", new THREE.BufferAttribute(scatter,3));
nGeo.setAttribute("color", new THREE.BufferAttribute(nCol,3)); nGeo.setAttribute("size", new THREE.BufferAttribute(nSize,1));
nGeo.setAttribute("alpha", new THREE.BufferAttribute(nAlpha,1)); nGeo.setAttribute("ring", new THREE.BufferAttribute(nRing,1));
root.add(new THREE.Points(nGeo, pmat()));
const DUST=700, dPos=new Float32Array(DUST*3), dGeo=new THREE.BufferGeometry();
for(let k=0;k<DUST;k++){ const d=randDir(), rr=1.6+Math.pow(rnd(),0.6)*3.4; dPos.set([d[0]*rr,d[1]*rr,d[2]*rr],k*3); }
dGeo.setAttribute("position", new THREE.BufferAttribute(dPos,3)); dGeo.setAttribute("scatter", new THREE.BufferAttribute(dPos,3));
dGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(DUST*3).fill(0.62),3));
dGeo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(DUST).map(()=>0.9+rnd()*1.4),1));
dGeo.setAttribute("alpha", new THREE.BufferAttribute(new Float32Array(DUST).map(()=>0.12+rnd()*0.22),1));
dGeo.setAttribute("ring", new THREE.BufferAttribute(new Float32Array(DUST),1));
const dust=new THREE.Points(dGeo, pmat()); scene.add(dust);
let waveT=99, waveDir=[0,1,0], waveNext=4, cursorSpawn=0; const glowArr=new Float32Array(N);

const hPos = new Float32Array(3), hGeo = new THREE.BufferGeometry();
hGeo.setAttribute("position", new THREE.BufferAttribute(hPos,3));
hGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(CYAN),3));
const hSize = new THREE.BufferAttribute(new Float32Array([46]),1), hAlpha = new THREE.BufferAttribute(new Float32Array([0.2]),1);
hGeo.setAttribute("size", hSize); hGeo.setAttribute("alpha", hAlpha); hGeo.setAttribute("ring", new THREE.BufferAttribute(new Float32Array([0]),1));
root.add(new THREE.Points(hGeo, pmat()));

let highlight=-1, focusNode=-1, focusSet=null;
const ePos = new Float32Array(edges.length*6), eCol = new Float32Array(edges.length*6), eBase = new Float32Array(edges.length*3);
edges.forEach(([a,b],k)=>{ ePos.set([pos[a*3],pos[a*3+1],pos[a*3+2],pos[b*3],pos[b*3+1],pos[b*3+2]], k*6); });
const eGeo = new THREE.BufferGeometry(); eGeo.setAttribute("position", new THREE.BufferAttribute(ePos,3)); eGeo.setAttribute("color", new THREE.BufferAttribute(eCol,3));
const eMat = new THREE.LineBasicMaterial({vertexColors:true, transparent:true, opacity:1, depthWrite:false, blending:THREE.AdditiveBlending});
root.add(new THREE.LineSegments(eGeo, eMat));
scene.fog = new THREE.Fog(0x050607, 3.2, 5.6);
function applyEdgeColors(){
  if(typeof mode!=="undefined" && mode==="intro"){ edges.forEach(([a,b,kind],k)=>{ const v = kind==="f"?0.09 : kind==="g"?0.05 : 0.14; eBase.set([v*0.85,v*0.8,v*1.15],k*3); }); paintEdges(); return; }
  edges.forEach(([a,b,kind],k)=>{
    const on = x => topics[x].status==="done"||topics[x].status==="prog";
    const lit = a<T && b<T && on(a) && on(b);
    const both = a<T && b<T && topics[a].status==="done" && topics[b].status==="done";
    const tr = a<T ? retentionOf(a) : 1, tr2 = b<T ? retentionOf(b) : 1, rr=Math.min(tr,tr2);
    let v = kind==="f"?0.075 : kind==="d"?0.13 : kind==="c"?(both?0.5*rr:lit?0.3:0.14) : (both?0.34*rr:lit?0.2:0.09);
    if(kind==="g"){ const ti = a<T ? a : b; v = topics[ti].status==="done" ? 0.3*retentionOf(ti) : 0.16*growthOf(ti); }
    let col=[v,v,v];
    if(hot[a]&&hot[b]&&kind!=="f") col=[CYAN[0]*v*1.4,CYAN[1]*v*1.4,CYAN[2]*v*1.4];
    else if(hot[a]&&hot[b]) col=[CYAN[0]*0.12,CYAN[1]*0.12,CYAN[2]*0.12];
    eBase.set(col,k*3);
  });
  paintEdges();
}
function paintEdges(){
  for(let k=0;k<edges.length;k++){
    const a=edges[k][0], b=edges[k][1]; let f=1;
    if(focusSet) f = (a===focusNode||b===focusNode) ? 3.4 : (focusSet.has(a)&&focusSet.has(b)) ? 1.1 : 0.2;
    else if(highlight>=0) f = (nodeBranch[a]===highlight&&nodeBranch[b]===highlight) ? 1 : 0.28;
    for(let j=0;j<3;j++){ const c=Math.min(1,eBase[k*3+j]*f); eCol[k*6+j]=c; eCol[k*6+3+j]=c; }
  }
  eGeo.attributes.color.needsUpdate=true;
}
applyEdgeColors();

const MAXP = 280, pPos = new Float32Array(MAXP*3), pCol = new Float32Array(MAXP*3), pSize = new Float32Array(MAXP), pAlpha = new Float32Array(MAXP);
const pulses = Array.from({length:MAXP},()=>({on:false,a:0,b:0,t:0,dur:1,depth:0,cyan:false}));
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos,3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol,3));
pGeo.setAttribute("size", new THREE.BufferAttribute(pSize,1)); pGeo.setAttribute("alpha", new THREE.BufferAttribute(pAlpha,1));
pGeo.setAttribute("ring", new THREE.BufferAttribute(new Float32Array(MAXP),1));
root.add(new THREE.Points(pGeo, pmat()));
const flash = new Float32Array(N);
function spawn(from, prev, depth, forceCyan){
  const nb = adj[from]; if(!nb.length) return;
  let to = nb[(rnd()*nb.length)|0]; if(to===prev && nb.length>1) to = nb[(rnd()*nb.length)|0];
  const p = pulses.find(q=>!q.on); if(!p) return;
  p.on=true; p.a=from; p.b=to; p.t=0; p.depth=depth; p.dur = 0.28 + Math.sqrt(d2(from,to))*1.9;
  p.cyan = !!forceCyan || !!(hot[from] && hot[to]);
}
function burst(i, n){ for(let k=0;k<n;k++) spawn(i,-1,0,true); flash[i]=1.6; }

/* ---------- camera ---------- */
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || PHONE; /* phone: no typewriter, no dive, no tab CRT timers */
let theta=0.6, phi=1.25, radius=3.7, tTheta=theta, tPhi=phi, tRadius=3.7;
let idleUntil=0, dragging=false, moved=0, lastX=0, lastY=0;
const autoSpin = reduce ? 0 : 0.06;
function placeCamera(){ camera.position.set(radius*Math.sin(phi)*Math.sin(theta), radius*Math.cos(phi), radius*Math.sin(phi)*Math.cos(theta)); camera.lookAt(0,0,0); }
function focusOn(i){ const x=pos[i*3], y=pos[i*3+1], z=pos[i*3+2], l=Math.hypot(x,y,z);
  let th=Math.atan2(x,z); while(th-theta>Math.PI) th-=Math.PI*2; while(th-theta<-Math.PI) th+=Math.PI*2;
  tTheta=th; tPhi=Math.min(2.6,Math.max(0.55,Math.acos(y/l))); idleUntil=performance.now()+6000; }

/* ---------- mode & layout ---------- */
var mode = "intro";
function narrow(){ return window.innerWidth < 980; } /* see also PHONE (top of script): touch + small screen -> list instead of 3D map, no rAF loops */
const appEl=document.querySelector(".app");
function scaleUI(){
  const W=window.innerWidth, H=window.innerHeight, k = narrow() ? 1 : Math.max(1, Math.min(1.55, W/1600, H/860)), st=document.documentElement.style;
  [["--fs-label",11],["--fs-ui",13],["--fs-read",15],["--fs-code",13],["--fs-title",30],["--read-size",15],["--code-size",13]].forEach(a=>st.setProperty(a[0], (a[1]*k).toFixed(2)+"px"));
  st.setProperty("--win-max", narrow() ? "none" : (W>1500 ? Math.round(Math.min(2700, W)) : 1180)+"px");
}
function layout(){
  scaleUI();
  const H = mainEl.clientHeight, W = narrow() ? mainEl.clientWidth : (mode==="topic" ? appEl.clientWidth : appEl.clientWidth-220);
  let r;
  if(mode==="intro"){ const Wf=appEl.clientWidth, Sh=Math.round(H*0.62), Sw=Math.round(Math.min(Wf*0.86, Sh*1.55)); r={l:Math.round((Wf-Sw)/2), t:Math.round(H*0.07), w:Sw, h:Sh}; }
  else if(mode==="map") r = {l:0,t:0,w:W,h:H};
  else { const S = narrow() ? 52 : Math.min(140, Math.round(W*0.12)); r = narrow() ? {l:W-S-10, t:8, w:S, h:S} : {l:W-S-24, t:16, w:S, h:S};
    document.documentElement.style.setProperty("--mini-gap", (S+48)+"px"); }
  brain.style.left=r.l+"px"; brain.style.top=r.t+"px"; brain.style.width=r.w+"px"; brain.style.height=r.h+"px";
}
function setMode(m){
  if(m===mode) return; mode=m; if(typeof exitKb==="function") exitKb();
  appEl.classList.toggle("intro-on", m==="intro"); brain.classList.toggle("intro", m==="intro"); sfx.setScene(m);
  mainEl.classList.toggle("is-topic", m==="topic");
  appEl.classList.toggle("topic-on", m==="topic");
  brain.classList.toggle("mini", m==="topic");
  tRadius = m==="topic" ? 3.15 : m==="intro" ? 3.25 : 3.7;
  $("navMap").classList.toggle("on", m==="map");
  $("navTopic").classList.toggle("on", m==="topic" && activeTab!=="tasks");
  $("navTasks").classList.toggle("on", m==="topic" && activeTab==="tasks");
  hideTip(); layout(); if(m==="map") stopTyping();
  applyNodeStyles(); applyEdgeColors();
  if(m==="topic"){ const sw=$("sweep"); sw.classList.remove("go"); void sw.offsetWidth; sw.classList.add("go"); }
  if(PHONE) plistShow(m==="map");
}
window.addEventListener("resize", layout);

/* ---------- pointer ---------- */
canvas.addEventListener("pointerdown", e=>{ dragging=true; moved=0; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture(e.pointerId); if(mode==="map") canvas.classList.add("drag"); });
let mX=-1, mY=-1, mIn=false, hoverNode=-1, rX=0, rY=0, rInit=false;
canvas.addEventListener("pointerenter", ()=>{ mIn=true; });
canvas.addEventListener("pointerleave", ()=>{ mIn=false; hoverNode=-1; });
canvas.addEventListener("pointermove", e=>{ const r=canvas.getBoundingClientRect(); mX=e.clientX-r.left; mY=e.clientY-r.top; mIn=true; });
canvas.addEventListener("pointermove", e=>{
  if(dragging){ const dx=e.clientX-lastX, dy=e.clientY-lastY; moved+=Math.abs(dx)+Math.abs(dy); lastX=e.clientX; lastY=e.clientY;
    if(mode==="map"){ theta-=dx*0.006; phi=Math.min(2.6,Math.max(0.55,phi-dy*0.006)); tTheta=theta; tPhi=phi; idleUntil=performance.now()+3500; hideTip(); }
    return; }
  if(mode==="map") hover(e);
});
canvas.addEventListener("pointerup", e=>{
  if(!dragging) return; dragging=false; canvas.classList.remove("drag");
  if(mode==="intro") return;
  if(moved>=5) return;
  if(mode==="topic"){ setMode("map"); return; }
  const i=pick(e); if(i<0) return;
  if(i===selected) openTopic(i); else select(i,true);
});
canvas.addEventListener("pointercancel", ()=>{ dragging=false; canvas.classList.remove("drag"); });
canvas.addEventListener("pointerleave", hideTip);
canvas.addEventListener("dblclick", e=>{ if(mode!=="map") return; const i=pick(e); if(i>=0) openTopic(i); });
canvas.addEventListener("wheel", e=>{ if(mode!=="map") return; e.preventDefault(); tRadius=Math.min(5.4,Math.max(2.3,tRadius+e.deltaY*0.0022)); }, {passive:false});
document.addEventListener("keydown", e=>{ if(e.key==="Escape"){ if(mode==="topic") setMode("map"); else if(cardOn && $("palette").hidden) hideCard(); } });

/* ---------- projection, picking, overlay ---------- */
let W=1,H=1; const v3 = new THREE.Vector3();
function drawRoute(breath){
  const pv=prevIdx(routeAt), ids=[pv, routeAt];
  let k=routeAt; for(let n=0;n<3;n++){ k = k>=0 ? nextIdx(k) : -1; ids.push(k); }
  const pts=ids.map(i=>{ if(i<0) return null; const p=[pos[i*3]*breath,pos[i*3+1]*breath,pos[i*3+2]*breath]; const [x,y]=project(...p); return {x,y,f:facing(...p),i}; });
  const str=a=>a.filter(Boolean).map(q=>q.x.toFixed(1)+","+q.y.toFixed(1)).join(" ");
  $("rDone").setAttribute("points", str([pts[0],pts[1]])); $("rNext").setAttribute("points", str(pts.slice(1)));
}
function project(x,y,z){ v3.set(x,y,z).project(camera); return [(v3.x*0.5+0.5)*W, (-v3.y*0.5+0.5)*H]; }
function facing(x,y,z){ const c=camera.position; return (x*c.x+y*c.y+z*c.z)/radius; }
function pick(e){
  const r=canvas.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top; let best=-1, bd=18*18;
  for(let i=0;i<T;i++){ const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2]; if(facing(x,y,z)<-0.35) continue; const [sx,sy]=project(x,y,z); const d=(sx-mx)**2+(sy-my)**2; if(d<bd){bd=d;best=i;} }
  return best;
}
const tip=$("tip");
function hover(e){
  const i=pick(e); if(i!==hoverNode){ hoverNode=i; if(i>=0) sfx.hover(topics[i].b, topics[i].k); } setFocus(i); if(i<0){ hideTip(); return; }
  canvas.classList.add("hover"); const r=canvas.getBoundingClientRect();
  tip.style.left=(e.clientX-r.left)+"px"; tip.style.top=(e.clientY-r.top)+"px";
  tip.style.opacity=0;
}
function hideTip(){ tip.style.opacity=0; canvas.classList.remove("hover"); if(typeof setFocus==="function" && focusNode>=0) setFocus(-1); }
const overlay=$("overlay");
const labels = BRANCHES.map((br,bi)=>{
  const b=document.createElement("button"); b.type="button"; b.className="blabel"; b.textContent=br.code+" "+br.name;
  b.addEventListener("mouseenter",()=>setHighlight(bi)); b.addEventListener("mouseleave",()=>setHighlight(-1));
  b.addEventListener("focus",()=>setHighlight(bi)); b.addEventListener("blur",()=>setHighlight(-1));
  b.addEventListener("click",()=>select(topics.findIndex(t=>t.b===bi),true));
  overlay.appendChild(b); return b;
});
const labelPos = bcenters.map(c=>shape(c[0]*1.18,c[1]*1.18,c[2]*1.18));
const hemiLabels = [["ЯЗЫК И ИНЖЕНЕРИЯ",-1],["ПЛАТФОРМА iOS",1]].map(([txt,side])=>{ const d=document.createElement("div"); d.className="hlabel"; d.textContent=txt; overlay.appendChild(d); return {el:d, p:[side*1.55,1.02,0]}; });
let nbShown=[];
const nbLabels = Array.from({length:8},()=>{ const d=document.createElement("div"); d.className="nlabel"; d.hidden=true; overlay.appendChild(d); return d; });
const marker=$("marker");
const leaderSvg=document.createElementNS("http://www.w3.org/2000/svg","svg"); leaderSvg.setAttribute("class","leaders"); overlay.appendChild(leaderSvg);
const tLabs = topics.map(t=>{ const d=document.createElement("div"); d.className="tlab"; d.innerHTML=`<span class="tn"><i class="tk">${String(t.k+1).padStart(2,"0")}</i>${esc(t.title)}<em class="nxt">ДАЛЬШЕ</em></span><span class="ts">${esc(t.sub)}</span><span class="need"></span>`; overlay.appendChild(d); return {el:d, w:0, h:0, line:null, need:d.querySelector(".need"), needKey:null}; });
let labBranch=-1;
function layoutTopicLabels(breath){
  const ab = hoverNode>=0 ? topics[hoverNode].b : highlight;
  if(ab!==labBranch){ tLabs.forEach(L=>{ L.el.classList.remove("on","back"); L.el.style.opacity=""; if(L.line){ L.line.remove(); L.line=null; } }); labBranch=ab; labels.forEach((l,q)=>l.style.visibility = (ab>=0 && q===ab) ? "hidden" : ""); }
  if(ab<0) return;
  const items=[]; let cx=0, cy=0;
  topics.forEach((t,i)=>{ if(t.b!==ab) return; const p=[pos[i*3]*breath,pos[i*3+1]*breath,pos[i*3+2]*breath]; const [x,y]=project(...p); items.push({i,x,y,f:facing(...p)}); cx+=x; cy+=y; });
  cx/=items.length; cy/=items.length;
  const card=$("card"), cr = (cardOn && !card.hidden) ? {l:cardX-12, t:cardY-12, r:cardX+card.offsetWidth+12, b:cardY+card.offsetHeight+12} : null;
  items.forEach(it=>{ const L=tLabs[it.i], t=topics[it.i]; L.el.classList.add("on"); L.el.classList.toggle("hot", it.i===hoverNode); L.el.classList.toggle("done", t.status==="done"); L.el.classList.toggle("dark", t.status==="dark"); L.el.classList.toggle("fog", !!t.fog);
    const nk = t.fog ? t.miss.join(",") : ""; if(L.needKey!==nk){ L.needKey=nk; L.need.innerHTML = nk ? "В ТУМАНЕ · СНАЧАЛА <b>"+missNames(t).map(esc).join(" · ")+"</b>" : ""; } L.el.classList.toggle("nx", it.i===curIdx);
    L.w=L.el.offsetWidth; L.h=L.el.offsetHeight; it.side = it.x>=cx ? 1 : -1; it.ly = it.y + (it.y-cy)*0.25; });
  const place=it=>{ const L=tLabs[it.i]; it.lx = it.side>0 ? it.x+26 : it.x-26-L.w; };
  items.forEach(it=>{ place(it); if(cr){ const L=tLabs[it.i]; if(it.lx<cr.r && it.lx+L.w>cr.l && it.ly+L.h/2>cr.t && it.ly-L.h/2<cr.b){ it.side=-it.side; place(it); } } });
  [1,-1].forEach(side=>{ const col=items.filter(it=>it.side===side).sort((a,b)=>a.ly-b.ly); for(let k=1;k<col.length;k++){ const prev=col[k-1], gap=(tLabs[prev.i].h+tLabs[col[k].i].h)/2+4; if(col[k].ly-prev.ly<gap) col[k].ly=prev.ly+gap; }
    const over = col.length ? (col[col.length-1].ly + tLabs[col[col.length-1].i].h/2) - (H-40) : 0; if(over>0) col.forEach(it=>it.ly-=over); });
  items.forEach(it=>{ const L=tLabs[it.i]; const x=Math.max(8,Math.min(W-L.w-8,it.lx)), y=it.ly;
    L.el.style.transform=`translate(${x.toFixed(1)}px,${(y-L.h/2).toFixed(1)}px)`; L.el.classList.toggle("back", it.f<-0.35);
    if(!L.line){ L.line=document.createElementNS("http://www.w3.org/2000/svg","line"); leaderSvg.appendChild(L.line); }
    const ex = it.side>0 ? x-4 : x+L.w+4, ey = y - (it.i===hoverNode ? L.h/2-10 : 0);
    L.line.setAttribute("x1",it.x.toFixed(1)); L.line.setAttribute("y1",it.y.toFixed(1)); L.line.setAttribute("x2",ex.toFixed(1)); L.line.setAttribute("y2",ey.toFixed(1)); L.line.setAttribute("class", it.i===hoverNode?"hot":""); });
}

/* ---------- selection / map panel ---------- */
let selected=curIdx;
const alphaMul = new Float32Array(N).fill(1);
function applyDim(){
  for(let i=0;i<N;i++) alphaMul[i] = focusSet ? (focusSet.has(i)?1:0.2) : (highlight<0||nodeBranch[i]===highlight)?1:0.16;
  paintEdges();
}
function setFocus(i){
  if(i===focusNode) return; focusNode=i;
  if(i<0){ focusSet=null; nbShown=[]; }
  else { focusSet=new Set([i]); topicLinks[i].forEach(j=>{ focusSet.add(j); adj[j].forEach(q=>{ if(q>=T) focusSet.add(q); }); }); adj[i].forEach(q=>focusSet.add(q)); nbShown=[...topicLinks[i]].slice(0,8); }
  nbLabels.forEach((el,k)=>{ const j=nbShown[k]; el.hidden = j==null; if(j!=null) el.textContent=topics[j].title; });
  applyDim();
}
function setHighlight(bi){
  highlight=bi; applyDim();
  labels.forEach((l,k)=>l.classList.toggle("on",k===bi));
  document.querySelectorAll("#pBranches button").forEach((b,k)=>b.classList.toggle("on",k===bi));
}
const STATUS={done:"ОСВОЕНО",prog:"В ПРОЦЕССЕ",none:"НЕ НАЧАТО",dark:"ТЁМНЫЙ НЕЙРОН"};
const LVL={J:"JUNIOR",M:"MIDDLE",S:"SENIOR"};
function statusLabel(t){ return t.due ? "ПОВТОРИТЬ" : t.cur ? (t.status==="none"?"СЛЕДУЮЩАЯ":"ТЕКУЩАЯ") : t.fog ? "В ТУМАНЕ" : STATUS[t.status]; }
function missNames(t){ return (t.miss||[]).map(j=>topics[j].title); }
function metaHTML(t){
  const pr=topicProgress(t.id);
  return `<span class="${t.cur||t.due?"st-cur":""}" style="color:${(t.status==="none"||t.status==="dark")&&!t.cur?"var(--muted)":"var(--ink)"}">${statusLabel(t)}</span>${t.fog?`<span class="fogNeed">СНАЧАЛА <b>${missNames(t).map(esc).join(" · ")}</b></span>`:""}${pr.total?`<span><b>${pr.ok}</b>/${pr.total} СТУПЕНЕЙ</span>`:""}${t.legacy?`<span title="Засчитано по старому правилу: ступень 7 и Выгрузка по памяти ещё впереди — на ближайшем повторе">СТАРЫЙ ЗАЧЁТ</span>`:""}<span><b>${LVL[t.lvl]}</b></span><span>~<b>${t.min}</b> МИН</span>`;
}
function linkList(ul, i, onPick){
  ul.textContent="";
  [...topicLinks[i]].forEach(j=>{ const li=document.createElement("li"), b=document.createElement("button"); b.type="button";
    b.innerHTML="<span>"+esc(topics[j].title)+"</span><em>"+BRANCHES[topics[j].b].code+"</em>";
    b.addEventListener("click",()=>onPick(j)); li.appendChild(b); ul.appendChild(li); });
}
let cardOn=false, cardX=0, cardY=0, cardSnap=true;
function showCard(){ const c=$("card"); const was=cardOn; cardOn=true; c.hidden=false; if(!was) cardSnap=true; c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop"); }
function hideCard(){ cardOn=false; $("card").hidden=true; $("lead").style.opacity=0; renderTrack(); }
$("cClose").addEventListener("click",hideCard);
function select(i, fly){
  selected=i; const t=topics[i]; if(fly) sfx.select(t.b);
  $("cId").textContent="NODE://"+t.id.toUpperCase()+" · "+String(i).padStart(3,"0");
  $("pBranch").textContent="ВЕТКА "+BRANCHES[t.b].code+" · "+BRANCHES[t.b].name;
  $("pTitle").textContent=t.title; $("pSub").textContent=t.sub; $("pMeta").innerHTML=metaHTML(t);
  refreshCardNav(i);
  hPos.set([pos[i*3],pos[i*3+1],pos[i*3+2]]); hGeo.attributes.position.needsUpdate=true;
  for(let k=0;k<4;k++) spawn(i,-1,0); flash[i]=1.4;
  if(fly) focusOn(i);
  showCard();
}
$("cta").addEventListener("click",()=>{ const t=topics[selected]; if(t && t.fog) select(t.miss[0], true); else openTopic(selected); });   /* in fog: the main button leads to the missing prereq */
$("cAnyway").addEventListener("click",()=>openTopic(selected));
$("tNav").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; if(b.dataset.check) startCheck(+b.dataset.check); else if(b.dataset.go) openTopic(+b.dataset.go, "theory");
  else if(b.dataset.step){ stepIdx=+b.dataset.step; bankIdx=-1; if(activeTab!=="practice") setTab("practice"); renderPractice(); startTyping("practice"); }
  else if(b.dataset.out) openOut(); });
$("cKnow").addEventListener("click",()=>startCheck(selected));
$("cNext").addEventListener("click",()=>{ const nx=nextIdx(selected); if(nx>=0) select(nx,true); });
$("cPrev").addEventListener("click",()=>{ const pv=prevIdx(selected); if(pv>=0) select(pv,true); });
let trackCenter=-1;
function renderTrack(c){
  if(!$("track")) return; if(c==null) c = selected>=0 && cardOn ? selected : routeAt; trackCenter=c;
  const idx=[]; let k=c; for(let n=0;n<1;n++){ const pv=prevIdx(k); if(pv<0) break; idx.unshift(pv); k=pv; }
  idx.push(c); k=c; while(idx.length<5){ const nx=nextIdx(k); if(nx<0) break; idx.push(nx); k=nx; }
  const first=idx[0], last=idx[idx.length-1];
  let h = prevIdx(first)>=0 ? `<button type="button" class="tmore" data-go="${prevIdx(first)}" aria-label="Раньше">‹</button>` : "";
  idx.forEach((i,n)=>{ const t=topics[i], br = (n===0 || topics[idx[n-1]].b!==t.b) ? BRANCHES[t.b].code+" "+BRANCHES[t.b].name : "";
    const tag = i===routeAt ? "ТЫ ЗДЕСЬ" : br || (i===nextIdx(routeAt) ? "ДАЛЬШЕ" : "");
    h += `<button type="button" data-go="${i}" class="${t.status==="done"?"done":""} ${i===routeAt?"here":""} ${t.status==="dark"?"dark":""} ${t.fog?"fog":""} ${i===selected&&cardOn?"sel":""}" title="${esc(t.title)}"><span class="tb">${esc(tag)}</span><span class="tl"><span class="tt">${String(i+1).padStart(2,"0")} ${esc(t.title)}</span></span></button>`; });
  if(nextIdx(last)>=0) h += `<button type="button" class="tmore" data-go="${nextIdx(last)}" aria-label="Дальше">›</button>`;
  $("track").innerHTML=h;
}
$("track") && $("track").addEventListener("click",e=>{ const b=e.target.closest("button[data-go]"); if(!b) return; select(+b.dataset.go, true); });
function refreshCardNav(i){
  const t=topics[i], nx=nextIdx(i), pv=prevIdx(i), hasSteps=((DATA.content[t.id]||{}).steps||[]).length>0;
  $("cKnow").hidden = t.status==="done" || !hasSteps || !!t.fog; $("cAnyway").hidden = !t.fog;
  $("cNext").disabled = nx<0; $("cPrev").disabled = pv<0;
  const where = i===routeAt ? "<em>ТЫ ЗДЕСЬ</em>" : i<routeAt ? (t.status==="done"?"ПРОЙДЕНА":"ПРОПУЩЕНА") : i===nextIdx(routeAt) ? "СЛЕДУЮЩАЯ" : "ВПЕРЕДИ · ЧЕРЕЗ "+(i-routeAt);
  $("cStep").innerHTML = `ШАГ <b>${i+1}</b> / ${topics.length} · ${where}`;
  renderTrack(i);
  $("cta").textContent = t.fog ? "СНАЧАЛА: "+topics[t.miss[0]].title+" ▸" : t.status==="dark" ? "ОТКРЫТЬ ТЕМУ ▸" : t.due ? "ПОВТОРИТЬ ▸" : t.status==="none" ? "НАЧАТЬ ТЕМУ ▸" : t.status==="done" ? "ОТКРЫТЬ ТЕМУ ▸" : "ПРОДОЛЖИТЬ ▸";
}
const bl=$("pBranches");
BRANCHES.forEach((br,bi)=>{
  const list=topics.filter(t=>t.b===bi), done=list.filter(t=>t.status==="done").length;
  const li=document.createElement("li"), b=document.createElement("button"); b.type="button";
  b.innerHTML="<span>"+br.code+"  "+br.name+"</span><em data-bc=\""+bi+"\">"+done+" / "+list.length+"</em>";
  b.addEventListener("mouseenter",()=>setHighlight(bi)); b.addEventListener("mouseleave",()=>setHighlight(-1));
  b.addEventListener("click",()=>select(topics.findIndex(t=>t.b===bi),true));
  li.appendChild(b); bl.appendChild(li);
});
function runDays(){ return store.get("pm.runs",[]); }
function dayKey(d){ d=d||new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function streak(){ const set=new Set(runDays()); let n=0, d=new Date(); if(!set.has(dayKey(d))) d.setDate(d.getDate()-1); while(set.has(dayKey(d))){ n++; d.setDate(d.getDate()-1); } return n; }
function dueList(){ return topics.map((t,i)=>i).filter(i=>topics[i].due).sort((a,b)=>(srsOf(topics[a].id).due)-(srsOf(topics[b].id).due)); }
function refreshRun(){
  const nd=dueList().length, st=streak(), today=runDays().includes(dayKey());
  $("runBtn").innerHTML = `⚡ РАН · 5 МИН${nd?` <small>· ${nd} ${nd===1?"ПОВТОР":nd<5?"ПОВТОРА":"ПОВТОРОВ"}</small>`:today?" <small>· ✓ СЕГОДНЯ</small>":""}`;
  $("streak").innerHTML = st ? `СЕРИЯ <b>${st}</b> ${st===1?"ДЕНЬ":st<5?"ДНЯ":"ДНЕЙ"}${today?"":" · СЕГОДНЯ ЕЩЁ НЕ БЫЛО"}` : "СЕРИЯ <b>0</b> · НАЧНИ С РАНА";
}
function renderStages(){
  const el=$("stages"); if(!el) return; const here=stageOfB(topics[curIdx].b);
  el.innerHTML = STAGES.map((st,k)=>{ const x=stageStats(k), cls = k===here ? "on" : x.done===x.total ? "done" : "";
    return `${k?'<span class="ar" aria-hidden="true">→</span>':""}<div class="stg ${cls}"><span class="sn">${st.n} ${esc(st.name)}</span><i><b style="width:${Math.round(x.done/x.total*100)}%"></b></i><small>${x.done} / ${x.total}${x.fog?" · В ТУМАНЕ "+x.fog:""}</small></div>`; }).join("");
}
function refreshUI(){
  renderStages();
  try{ sfx.setProgress(topics.filter(t=>t.status==="done").length, topics.filter(t=>t.due).length); }catch(e){}
  const doneN=topics.filter(t=>t.status==="done").length, pct=Math.round(doneN/T*100);
  $("doneCount").textContent=doneN; $("donePct").textContent=pct+"%"; $("doneBar").style.width=pct+"%";
  document.querySelectorAll("[data-bc]").forEach(el=>{ const bi=+el.dataset.bc, list=topics.filter(t=>t.b===bi); el.textContent=list.filter(t=>t.status==="done").length+" / "+list.length; });
  const t=topics[curIdx];
  $("contBtn").innerHTML = `<span class="k">▸ ${t.due?"ПОВТОРИТЬ":t.status==="none"?"НАЧАТЬ":"ПРОДОЛЖИТЬ"}</span><span class="t">${esc(t.title)}</span>`;
  $("stCount").textContent = doneN; document.querySelectorAll(".tTot").forEach(e=>e.textContent=topics.length);
  if(current>=0 && mode==="topic"){ const ct=topics[current], cb=BRANCHES[ct.b], nb=topics.filter(x=>x.b===ct.b).length; $("tCrumb").innerHTML = crumbHTML(ct,cb,nb); }
  if(selected>=0 && $("pMeta")){ $("pMeta").innerHTML=metaHTML(topics[selected]); refreshCardNav(selected); } else renderTrack();
  if($("runBtn")) refreshRun();
  if($("exportBtn") && typeof refreshBackupNote==="function") refreshBackupNote();
  if(PHONE) renderPList();
}
function refreshProgress(){
  const before = new Set(topics.filter(t=>t.status==="done").map(t=>t.id));
  computeStatuses();
  topics.forEach(t=>{ if(t.status==="done" && !before.has(t.id) && !store.get("pm.doneAt."+t.id,0)) store.set("pm.doneAt."+t.id, Date.now()); });
  topics.forEach(t=>{ if(t.status==="done") srsOf(t.id); });
  computeStatuses();
  applyNodeStyles(); applyEdgeColors(); refreshUI();
}
/* ---------- PHONE: a plain scrollable topic list replaces the 3D map (no WebGL, no rAF) ---------- */
let plEl=null, plOpen=null, plScroll=0;
function plistBuild(){
  plEl=document.createElement("section"); plEl.id="plist"; plEl.className="plist"; plEl.hidden=true; plEl.setAttribute("aria-label","Список тем");
  plEl.innerHTML=`<div class="pl-top"><button type="button" class="pl-cont" id="plCont"></button><div class="pl-acts" id="plActs"></div><div class="pl-prog" id="plProg"></div></div><div class="pl-brs" id="plBrs"></div>`;
  mainEl.appendChild(plEl);
  const acts=$("plActs"); ["runBtn","mixBtn","srchBtn"].forEach(id=>{ const b=$(id); if(b) acts.appendChild(b); });
  const sk=$("streak"); if(sk) $("plProg").before(sk);   /* phone: the streak lives in the list header, not in the ≡ menu */
  const tc=$("tab-cheat"); if(tc){ tc.textContent="Шпарг."; tc.setAttribute("aria-label","Шпаргалка"); }
  plEl.addEventListener("click",e=>{
    if(e.target.closest(".pl-cont")){ const t=topics[curIdx], pr=topicProgress(t.id); plScroll=plEl.scrollTop; doOpen(curIdx, (pr.ok>0||t.due||Object.keys(pr.p).length)?"practice":"theory"); return; }
    const h=e.target.closest(".pl-bh");
    if(h){ const bi=+h.dataset.b, on=!plOpen.has(bi); if(on) plOpen.add(bi); else plOpen.delete(bi); h.parentNode.classList.toggle("open",on); h.setAttribute("aria-expanded",on); return; }
    const go=e.target.closest("[data-go]"); if(go){ plScroll=plEl.scrollTop; doOpen(+go.dataset.go, "theory"); return; }   /* fog: a missing prereq, or «открыть всё равно» */
    const b=e.target.closest(".pl-t"); if(b){ const i=+b.dataset.i;
      if(topics[i].fog){ const li=b.parentNode, on=!li.classList.contains("ask"); plEl.querySelectorAll(".pl-ts li.ask").forEach(x=>x.classList.remove("ask")); li.classList.toggle("ask",on); b.setAttribute("aria-expanded",on); return; }
      plScroll=plEl.scrollTop; doOpen(i, "theory"); }
  });
  $("pBranches").addEventListener("click",e=>{ const li=e.target.closest("li"); if(!li) return; const bi=[...li.parentNode.children].indexOf(li); if(bi<0) return;
    plOpen.add(bi); setMode("map"); renderPList(); const h=plEl.querySelector(`.pl-bh[data-b="${bi}"]`); if(h) plEl.scrollTop=h.parentNode.offsetTop-8; });
}
function renderPList(){
  if(!PHONE) return; if(!plEl) plistBuild();
  if(!plOpen) plOpen=new Set([topics[curIdx].b]);
  const ct=topics[curIdx], cb=BRANCHES[ct.b], doneN=topics.filter(t=>t.status==="done").length;
  $("plCont").innerHTML=`<span class="k">▸ ${ct.due?"ПОВТОРИТЬ":ct.status==="none"?"НАЧАТЬ":"ПРОДОЛЖИТЬ"}</span><span class="t">${esc(ct.title)}</span><span class="s">${cb.code} ${esc(cb.name)} · ${ct.k+1}/${topics.filter(x=>x.b===ct.b).length}</span>`;
  $("plProg").innerHTML=`<span>ОСВОЕНО <b>${doneN}</b> / ${T}</span><span class="bar"><i style="width:${Math.round(doneN/T*100)}%"></i></span>`;
  let h=""; const here=stageOfB(ct.b);
  BRANCHES.forEach((br,bi)=>{
    const sk=STAGES.findIndex(st=>st.br[0]===bi);
    if(sk>=0){ const x=stageStats(sk); h+=`<div class="pl-stg ${sk===here?"on":x.done===x.total?"done":""}">ЭТАП ${STAGES[sk].n} · ${esc(STAGES[sk].name)}<small>ОСВОЕНО ${x.done} / ${x.total}${x.fog?" · В ТУМАНЕ "+x.fog:""}</small><i><b style="width:${Math.round(x.done/x.total*100)}%"></b></i></div>`; }
    const idx=topics.map((t,i)=>i).filter(i=>topics[i].b===bi), dn=idx.filter(i=>topics[i].status==="done").length, open=plOpen.has(bi);
    h+=`<div class="pl-br${open?" open":""}${bi===ct.b?" here":""}"><button type="button" class="pl-bh" data-b="${bi}" aria-expanded="${open}"><span class="pl-bc">${br.code}</span><span class="pl-bn">${esc(br.name)}</span><span class="pl-bd"><b>${dn}</b> / ${idx.length}</span><i class="pl-chev" aria-hidden="true">▸</i></button><ol class="pl-ts">`;
    idx.forEach(i=>{ const t=topics[i], st=t.due?"due":t.cur?"cur":t.fog?"fog":t.status, pr=topicProgress(t.id);
      const extra = t.status==="prog" && pr.total ? ` · ${pr.ok}/${pr.total}` : t.legacy ? " · старый зачёт" : "";
      const need = t.fog ? `<span class="pl-need">сначала: <b>${missNames(t).map(esc).join(", ")}</b></span>` : "";
      const ask = t.fog ? `<div class="pl-ask">${t.miss.map(j=>`<button type="button" class="pl-go" data-go="${j}">▸ ${esc(topics[j].title)}</button>`).join("")}<button type="button" class="pl-any" data-go="${i}">открыть всё равно</button></div>` : "";
      h+=`<li><button type="button" class="pl-t st-${st}" data-i="${i}"${t.fog?' aria-expanded="false"':""}><span class="pl-n">${String(i+1).padStart(2,"0")}</span><span class="pl-tt">${esc(t.title)}${t.sub?`<small>${esc(t.sub)}</small>`:""}${need}</span><span class="pl-st">${statusLabel(t)}${extra}</span></button>${ask}</li>`; });
    h+=`</ol></div>`;
  });
  const sc=plEl.scrollTop; $("plBrs").innerHTML=h; plEl.scrollTop=sc;
}
function plistShow(on){
  if(!plEl) renderPList(); if(!plEl) return;
  if(on){ renderPList(); plEl.hidden=false; plEl.scrollTop=plScroll; }
  else { if(!plEl.hidden) plScroll=plEl.scrollTop; plEl.hidden=true; }
}
refreshUI();
$("contBtn").addEventListener("click",()=>{ const t=topics[curIdx], pr=topicProgress(t.id); openTopic(curIdx, (pr.ok>0||t.due||Object.keys(pr.p).length)?"practice":"theory"); });

/* ---------- topic view ---------- */
const KW = new Set("let var func class struct enum case if else guard return for in while repeat switch default protocol extension import init deinit self Self weak unowned final private fileprivate public internal open static async await throws throw rethrows try catch some any true false nil break continue where inout lazy mutating override super typealias associatedtype defer do actor nonisolated".split(" "));
function hl(code){
  const re=/(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|\b([A-Za-z_][A-Za-z0-9_]*)\b|(\b\d+(?:\.\d+)?\b)/g; let out="", last=0, m;
  while((m=re.exec(code))){ out+=esc(code.slice(last,m.index));
    if(m[1]) out+='<span class="t-com">'+esc(m[1])+"</span>";
    else if(m[2]) out+='<span class="t-str">'+esc(m[2])+"</span>";
    else if(m[3]){ const w=m[3]; out += KW.has(w) ? '<b class="t-kw">'+w+"</b>" : /^[A-Z]/.test(w) ? '<span class="t-ty">'+w+"</span>" : w; }
    else out+='<span class="t-num">'+m[4]+"</span>";
    last=re.lastIndex; }
  return out+esc(code.slice(last));
}
function proseCode(c){ const ls=c.split("\n").filter(l=>l.trim()); return ls.length>0 && ls.filter(l=>(l.replace(/\/\/.*$/,"").replace(/"[^"]*"/g,"").match(/[а-яё]/gi)||[]).length>=10).length >= ls.length/2; }
function terminal(code, head, right, opts){
  opts = opts||{};
  const html = opts.plain ? esc(code) : hl(code);
  const raw = code.split("\n"), isProse = l => (l.replace(/\/\/.*$/,"").replace(/"[^"]*"/g,"").match(/[а-яё]/gi)||[]).length >= 10;
  const maxW = Math.max(1, ...raw.filter(l=>!(opts.plain && isProse(l))).map(l=>l.replace(/\t/g,"    ").length));
  const rows = html.split("\n").map((l,i)=>`<div class="ln${opts.plain && isProse(raw[i]||"") ? " prose" : ""}"><i>${i+1}</i><code>${l||" "}</code></div>`).join("");
  return `<div class="term${opts.plain?" plain":""}${opts.key?" key":""}" data-w="${maxW}"><div class="term-h"><span>${head}</span><span>${right||""}</span></div><div class="term-b">${rows}</div></div>`;
}
var current=-1, activeTab="theory", stepIdx=0, bankIdx=-1;
const short = s => s.replace(/^Ступень\s*\d+\.\s*/,"");
function progressOf(id){ return store.get("pm.steps."+id, {}); }
function showCheckResult(ok){
  const t=topics[current], nx=nextIdx(current), box=document.querySelector("#pane-practice .p-side");
  const html = ok
    ? (statusOf(t.id)==="done"
      ? `<div class="chk-res ok"><b>Засчитано.</b> Ступень 7 и Выгрузка пройдены по памяти — тема освоена, первый повтор — через ${SRS_DAYS[1]} дня. Ступени 1–6 остаются открыты, если захочешь потренироваться.${nx>=0?`<button type="button" class="cta" id="chkNext">ДАЛЬШЕ · ${esc(topics[nx].title)} ▸</button>`:""}</div>`
      : `<div class="chk-res ok"><b>Ступень 7 по памяти засчитана.</b> Чтобы тема стала освоенной, осталась Выгрузка — вопросы «Проверь себя» без текста урока.<button type="button" class="cta" id="chkOut">К ВЫГРУЗКЕ ▸</button></div>`)
    : `<div class="chk-res"><b>Пока не вышло — и это нормально.</b> Значит, тему стоит пройти: начни с теории, она короткая. Ошибка записана в журнал.<button type="button" class="cta" id="chkTheory">К ТЕОРИИ ▸</button></div>`;
  if(box) box.innerHTML = html;
  if($("chkNext")) $("chkNext").addEventListener("click",()=>openTopic(nx, "theory"));
  if($("chkTheory")) $("chkTheory").addEventListener("click",()=>setTab("theory"));
  if($("chkOut")) $("chkOut").addEventListener("click",()=>openOut());
}
/* backlog 8: the bottom line leads through the topic — Теория → Практика 1…7 → Выгрузка → next topic.
   Returns {label, attr} for the next screen, or null when the next move is the next topic. */
function nextInTopic(i){
  const t=topics[i], id=t.id; if(t.status==="done" || activeTab==="tasks") return null;
  const tp=topicProgress(id), n=tp.steps.length; if(!n) return null;
  const outNext=()=>!(outOf(id)||{}).pass && outQs(id).length ? {label:"Выгрузка", attr:'data-out="1"'} : null;
  if(activeTab==="theory" && outSt) return null;   /* already on «Выгрузка» */
  if(activeTab==="practice" && bankIdx<0){
    if(stepIdx<n-1) return {label:"Практика "+(stepIdx+2)+" из "+n, attr:`data-step="${stepIdx+1}"`};
    return outNext();
  }
  const f=tp.steps.findIndex(x=>tp.p[x.id]!=="ok");
  return f>=0 ? {label:"Практика "+(f+1)+" из "+n, attr:`data-step="${f}"`} : outNext();
}
function refreshTopicNav(i){
  if(i<0 || !topics[i]) return;
  const t=topics[i], pv=prevIdx(i), nx=nextIdx(i), el=$("tNav"); if(!el) return;
  const known = t.status==="done", step = nextInTopic(i);
  el.innerHTML =
    (pv>=0?`<button type="button" class="tn-b pv" data-go="${pv}" title="Назад: ${esc(topics[pv].title)}" aria-label="Предыдущая тема: ${esc(topics[pv].title)}"><span class="k">◂</span><span class="tn-t"> Назад</span></button>`:"") +
    (!known && (DATA.content[t.id]||{}).steps && DATA.content[t.id].steps.length ? `<button type="button" class="tn-b know" data-check="${i}">Уже знаю<span class="tn-t"> — проверка</span></button>` : "") +
    (step ? `<button type="button" class="tn-b nx" ${step.attr}>Дальше: ${step.label} <span class="k">▸</span></button>`
      : nx>=0?`<button type="button" class="tn-b nx${known?" hot":""}" data-go="${nx}">${known?"Тема освоена · дальше":"Дальше"}: ${esc(topics[nx].title)} <span class="k">▸</span></button>`:"");
}
function crumbHTML(t, br, inBranch){ return `<b>${br.code} ${br.name}</b><span>·</span><span>${t.k+1}/${inBranch}</span><span>·</span><span>~${t.min} мин</span>${t.due?`<span>·</span><span class="st">повторить</span>`:""}`; }
let diving=false, diveBoost=0;
function openTopic(i, tab){
  if(mode==="map" && !reduce){
    if(diving) return; diving=true; if(selected!==i) select(i,false);
    focusOn(i); tRadius=1.75; diveBoost=1; burst(i,18); setFocus(-1); sfx.open();
    setTimeout(()=>{ diving=false; diveBoost=0; doOpen(i,tab); }, 620);
    return;
  }
  doOpen(i,tab);
}
// "3/7 +12": passed steps of the ladder, plus the bank size
function setPracticeSup(id){ const c=DATA.content[id], steps=c?c.steps:[], p=progressOf(id), nb=bankFor(id).length;
  $("supPractice").textContent = steps.length ? steps.filter(s=>p[s.id]==="ok").length+"/"+steps.length+(nb?" +"+nb:"") : ""; }
function doOpen(i, tab){
  if(selected!==i) select(i,false);
  current=i; const t=topics[i], br=BRANCHES[t.b], c=DATA.content[t.id];
  const inBranch = topics.filter(x=>x.b===t.b).length;
  $("tCrumb").innerHTML = crumbHTML(t, br, inBranch);
  $("tTitle").textContent = t.title; $("tSub").textContent = t.sub;
  const steps = c ? c.steps : [];
  const prog = progressOf(t.id);
  setPracticeSup(t.id);
  const tasks = tasksFor(t.id); $("supTasks").textContent = tasks.length ? String(tasks.length) : "";
  const firstOpen = steps.findIndex(s=>prog[s.id]!=="ok");
  stepIdx = firstOpen<0 ? 0 : firstOpen; bankIdx=-1;
  if(firstOpen<0 && bankFor(t.id).length) bankIdx = pickBank(t.id);
  if(t.due){ const k7=steps.findIndex(s=>s.id==="s7"); if(k7>=0){ stepIdx=k7; bankIdx=-1; } }
  if(checkMode && checkMode!==t.id) checkMode=null;
  if(forceStep>=0){ stepIdx=Math.min(forceStep, Math.max(0,steps.length-1)); bankIdx=-1; forceStep=-1; }
  if(t.due && t.status!=="done" && tab!=="cheat" && tab!=="tasks" && outQs(t.id).length) tab="out";   /* a failed «Выгрузка» is due: start there */
  refreshTopicNav(i);
  outSt=null; rootsSt=null; renderTheory(); renderCheat(); renderPractice(); renderTasks();
  if(tab==="out"){ renderOut(); tab="theory"; }
  else if((!tab || tab==="theory") && !checkMode) openRoots(t.id);
  setTab(tab || "theory");
  focusOn(i); burst(i, 8);
  setMode("topic");
  $("winBody").scrollTop=0;
}
const WIN_NAMES={theory:"Теория",cheat:"Шпаргалка",practice:"Практика",tasks:"Задания"};
let winToken=0;
function setTab(name){
  const win=$("winBody"); activeTab=name; stopTyping(); exitKb(); refreshTopicNav(current);
  ["theory","cheat","practice","tasks"].forEach(n=>$("tab-"+n).setAttribute("aria-selected", n===name));
  $("navTopic").classList.toggle("on", mode==="topic" && name!=="tasks");
  $("navTasks").classList.toggle("on", mode==="topic" && name==="tasks");
  if(name==="theory" && outSt && outSt.saved){ outSt=null; renderTheory(); }   /* a finished «Выгрузка» summary does not linger */
  const show=()=>{
    ["theory","cheat","practice","tasks"].forEach(n=>{ $("pane-"+n).hidden = n!==name; });
    $("winBody").scrollTop=0;
    $("winBody").classList.toggle("fit", name==="practice");
    if(name==="practice") requestAnimationFrame(fitCode);
    win.classList.remove("closing"); win.classList.add("opening");
    setTimeout(()=>win.classList.remove("opening"), 380);
    startTyping(name);
  };
  if(reduce){ show(); return; }
  const tk=++winToken; win.classList.remove("opening"); win.classList.add("closing");
  setTimeout(()=>{ if(tk===winToken) show(); }, 210);
}

const _mc=document.createElement("canvas").getContext("2d");
function codeAdvance(px){ _mc.font=px+"px "+getComputedStyle(document.documentElement).getPropertyValue("--f-code"); return _mc.measureText("0000000000").width/10 || px*0.6; }
function fitWidth(term, base, minPx){
  const tb=term.querySelector(".term-b"); if(!tb) return base;
  const chars=+term.dataset.w||1, avail=tb.clientWidth-76-4; if(avail<=0) return base;
  const need=chars*codeAdvance(base);
  return need<=avail ? base : Math.max(minPx, base*avail/need);
}
function sizePractice(animate){
  const pane=$("pane-practice"), wb=$("winBody"); if(!pane) return;
  pane.classList.toggle("anim", animate===true);
  if(narrow() || !wb.classList.contains("fit")){ pane.style.removeProperty("--pc-w"); return; }
  const W=pane.clientWidth; if(W<=0) return;
  const term=[...pane.querySelectorAll(".p-code .term")].find(t=>t.style.display!=="none"), chars=term?(+term.dataset.w||1):1;
  const base=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--code-size"))||13;
  const need=chars*codeAdvance(base)+84, man=+store.get("pm.split",0)||0;
  let w;
  if(man) w=man*W;
  else if(pane.classList.contains("typing")) w=Math.min(Math.max(need*0.8, W*0.24), W*0.38);
  else w=Math.min(Math.max(need, W*0.3), W*0.62);
  if(!man) w=Math.max(w, Math.min(chars*codeAdvance(11)+84, W*0.7));
  pane.style.setProperty("--pc-w", Math.round(w)+"px");
}
function fitCode(animate){
  sizePractice(animate===true);
  const base=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--code-size"))||14;
  document.querySelectorAll("#pane-practice .term").forEach(term=>{
    term.style.removeProperty("--code-size");
    const tb=term.querySelector(".term-b"); if(!tb || term.style.display==="none") return;
    let fs=fitWidth(term, base, 11);
    if(term.closest(".p-code") && $("winBody").classList.contains("fit") && !narrow()){
      const pane=$("pane-practice"), lad=pane.querySelector(".ladder"), hd=term.querySelector(".term-h");
      const n=tb.querySelectorAll(".ln").length||1, avail=pane.clientHeight-(lad?lad.offsetHeight:0)-14-(hd?hd.offsetHeight:0)-24-8;
      if(avail>0) fs=Math.max(10.5, Math.min(fs, avail/(n*1.68)));
    }
    if(Math.abs(fs-base)>0.05) term.style.setProperty("--code-size", fs.toFixed(2)+"px");
  });
}
(function(){ const pane=document.getElementById("pane-practice"); if(pane) pane.addEventListener("transitionend",e=>{ if(e.target===pane && e.propertyName==="grid-template-columns") requestAnimationFrame(()=>fitCode()); }); })();
if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>requestAnimationFrame(fitCode));
window.addEventListener("resize", ()=>requestAnimationFrame(fitCode));

/* ---------- typewriter ---------- */
let typeJob=null;
function stopTyping(){ if(typeJob){ typeJob.finish(); typeJob=null; } $("skipType").hidden=true; }
function prepType(el,cps){ const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT); const nodes=[],full=[]; let n; while((n=w.nextNode())){ nodes.push(n); full.push(n.nodeValue); } nodes.forEach(x=>x.nodeValue=""); return {nodes,full,ni:0,ci:0,budget:0,cps}; }
function typeSeq(items){
  stopTyping();
  if(reduce) return;
  const jobs=items.filter(x=>x.el).map(x=>prepType(x.el,x.cps));
  if(!jobs.length) return;
  const caret=document.createElement("span"); caret.className="caret"; caret.setAttribute("aria-hidden","true");
  let idx=0, raf=0, lastT=performance.now(), alive=true;
  function finish(){ if(!alive) return; alive=false; cancelAnimationFrame(raf); jobs.forEach(j=>j.nodes.forEach((n,i)=>{ n.nodeValue=j.full[i]; })); caret.remove(); $("skipType").hidden=true; }
  function step(now){
    const dt=Math.min(0.05,(now-lastT)/1000); lastT=now;
    const j=jobs[idx];
    if(!j){ alive=false; $("skipType").hidden=true; setTimeout(()=>caret.remove(),1600); typeJob=null; return; }
    j.budget+=j.cps*dt;
    while(j.ni<j.nodes.length){
      const n=j.nodes[j.ni], full=j.full[j.ni], take=Math.min(full.length-j.ci, Math.floor(j.budget));
      j.ci+=take; j.budget-=take; n.nodeValue=full.slice(0,j.ci); if(take>0) sfx.tick();
      if(j.ci>=full.length){ j.ni++; j.ci=0; } else break;
    }
    const cur=j.nodes[Math.min(j.ni,j.nodes.length-1)];
    if(cur && cur.parentNode) cur.parentNode.insertBefore(caret, cur.nextSibling);
    if(j.ni>=j.nodes.length) idx++;
    raf=requestAnimationFrame(step);
  }
  $("skipType").hidden=false;
  raf=requestAnimationFrame(step);
  typeJob={finish};
}
function startTyping(name){
  if(name==="theory"){ const el=thBlocks[0]; typeSeq([{el, cps:340}]); }
  else if(name==="practice"){ const pn=$("pane-practice"); typeSeq([{el:pn.querySelector(".step-title"),cps:60},{el:pn.querySelector(".prompt"),cps:140},{el:pn.querySelector(".term-b"),cps:900}]); }
  else if(name==="cheat"){ typeSeq([{el:$("pane-cheat").querySelector(".ch-list"),cps:420}]); }
  else { const first=$("pane-tasks").querySelector(".task-b p"); typeSeq([{el:first,cps:260}]); }
}
$("skipType").addEventListener("click",()=>stopTyping());

/* ---------- theory: one block at a time ---------- */
let thBlocks=[], thShown=0, lastReveal=0;
function updateMore(){
  const m=$("tMore"), foot=$("pane-theory").querySelector(".t-foot"); if(!m) return;
  const n=thBlocks.length, left=n-thShown;
  m.hidden = left<=0;
  if(foot) foot.classList.toggle("locked", left>0);
  m.setAttribute("aria-label", "Дальше: часть "+(thShown+1)+" из "+n);
  if(left>0) m.innerHTML = `<span class="mlab">ДАЛЬШЕ · ${String(thShown+1).padStart(2,"0")} / ${String(n).padStart(2,"0")}</span><span class="chev">▾</span><span class="segs">${thBlocks.map((_,k)=>`<i class="${k<thShown?"on":""}"></i>`).join("")}</span>`;
}
function revealNext(force){
  if(mode!=="topic" || activeTab!=="theory") return;
  const now=performance.now(); if(!force && now-lastReveal<700) return; lastReveal=now;
  if(typeJob){ stopTyping(); return; }
  if(thShown>=thBlocks.length) return;
  if(!(thBlocks[0] && thBlocks[0].classList.contains("tb"))) thBlocks.forEach((b,k)=>b.classList.toggle("past", k<thShown));
  const b=thBlocks[thShown]; b.classList.remove("locked"); b.classList.add("fresh"); thShown++;
  updateMore();
  const tp=$("winBody"); const y=b.getBoundingClientRect().top - tp.getBoundingClientRect().top + tp.scrollTop - 60;
  tp.scrollTo({top:Math.max(0,y), behavior: reduce ? "auto" : "smooth"});
  typeSeq([{el:b, cps:340}]);
}
function nearBottom(){ const tp=$("winBody"); return tp.scrollTop + tp.clientHeight >= tp.scrollHeight - 140; }

let touchY=null;
$("winBody").addEventListener("touchstart",e=>{ touchY=e.touches[0].clientY; },{passive:true});

document.addEventListener("keydown",e=>{
  if(mode!=="topic" || activeTab!=="theory") return;
  if(e.target.closest && e.target.closest("textarea,input")) return;
  if(e.target.closest && e.target.closest("button") && (e.key===" "||e.key==="Enter")) return;
  if(e.key==="Enter"){ e.preventDefault(); revealNext(true); }
});
$("win").addEventListener("click",e=>{ if(typeJob && !e.target.closest("button,textarea,a")) stopTyping(); });
$("winClose").addEventListener("click",()=>setMode("map"));
/* fonts are fixed: Handjet (titles, labels) + IBM Plex Mono (all text) + JetBrains Mono (code) */

["theory","cheat","practice","tasks"].forEach(n=>$("tab-"+n).addEventListener("click",()=>setTab(n)));
document.querySelector(".tabs").addEventListener("keydown",e=>{
  const order=["theory","cheat","practice","tasks"], k=order.indexOf(activeTab);
  if(e.key==="ArrowRight"){ setTab(order[(k+1)%4]); $("tab-"+activeTab).focus(); }
  if(e.key==="ArrowLeft"){ setTab(order[(k+3)%4]); $("tab-"+activeTab).focus(); }
});

function lessonHTML(L){
  const body=list=>list.map(n=> n.t==="p" ? `<p>${n.html}</p>` : n.t==="ul" ? `<ul>${n.items.map(x=>`<li>${x}</li>`).join("")}</ul>` : n.t==="note" ? `<div class="lnote">${n.html}</div>` : `<pre class="lcode"><code>${hl(n.code)}</code></pre>`).join("");
  const sec=(x,k,deep)=>`<section class="tb${deep?" deep":""}${/^Аналогия/.test(x.h)?" analogy":""}${/^Проверь себя/.test(x.h)?" check":""}"><h3><i>${deep?"+":""}${String(k+1).padStart(2,"0")}</i>${x.h}</h3>${body(x.body)}</section>`;
  const mission = L.mission ? `<section class="tb mission"><div class="m-k">${L.mission}</div>${L.scenario?`<h2>${L.scenario}</h2>`:""}${L.goals.length?`<div class="m-g"><span>ПОСЛЕ МИССИИ ТЫ СМОЖЕШЬ</span><ul>${L.goals.map(g=>`<li>${g}</li>`).join("")}</ul></div>`:""}</section>` : "";
  return mission + L.base.map((x,k)=>sec(x,k,false)).join("") + (L.deeper.length?`<div class="deep-sep tb deep"><span>ГЛУБЖЕ</span></div>`:"") + L.deeper.map((x,k)=>sec(x,k,true)).join("");
}
function renderTheory(){
  const t=topics[current], c=DATA.content[t.id], pane=$("pane-theory");
  const nextIdx = topics.findIndex(x=>x.b===t.b && x.k===t.k+1);
  const L = c && c.lesson, nDeep = L ? L.deeper.length : 0, outPass = !!(outOf(t.id)||{}).pass;
  if(PHONE && L){ renderEpisode(t, c, L, nextIdx); return; }   /* phone: the lesson is a stack of cards («Эпизод») */
  pane.innerHTML = `<div class="theory${L?" lesson":""}">${c ? (L ? lessonHTML(L) : c.theory) : `<p class="empty">Теория для этой темы ещё не написана. Она появится по тому же шаблону: что это, почему так устроено, последствия и аналогия.</p>`}</div>
    <button type="button" class="more" id="tMore" hidden></button>
    <div class="t-foot">
      ${growsHTML(t.id)}
      ${nDeep ? `<button class="deepBtn" type="button" id="toDeep"><span>ГЛУБЖЕ ▾</span><small>${nDeep} ${nDeep<5?"РАЗДЕЛА":"РАЗДЕЛОВ"} · ДЛЯ СОБЕСА И MIDDLE</small></button>` : ""}
      ${outQs(t.id).length ? (outPass ? `<button class="ghostbtn" type="button" id="toOut">ВЫГРУЗКА ✓ · ПРОЙТИ ЕЩЁ РАЗ</button>` : `<button class="cta" type="button" id="toOut">ВЫГРУЗКА ▸ <small>${outQs(t.id).length} ${plural(outQs(t.id).length,["ВОПРОС","ВОПРОСА","ВОПРОСОВ"])} ПО ПАМЯТИ</small></button>`) : ""}
      ${c && c.steps.length ? `<button class="${outPass||!outQs(t.id).length?"cta":"ghostbtn"}" type="button" id="toPractice">ЗАПУСТИТЬ ПРАКТИКУ ▸</button>` : ""}
      <div class="sect"><h3>СВЯЗИ</h3><ul class="links" id="tLinks"></ul></div>
      ${nextIdx>=0 ? `<div class="sect"><h3>ДАЛЬШЕ В ВЕТКЕ</h3><ul class="links"><li><button type="button" id="tNext"><span>${esc(topics[nextIdx].title)}</span><em>→</em></button></li></ul></div>` : ""}
    </div>`;
  thBlocks=[...pane.querySelectorAll(L ? ".theory > .tb:not(.deep)" : ".theory > p")]; thShown=Math.min(1,thBlocks.length);
  thBlocks.forEach((b,k)=>b.classList.toggle("locked", k>=thShown));
  const deepBlocks=[...pane.querySelectorAll(".theory > .tb.deep")]; deepBlocks.forEach(b=>b.classList.add("locked"));
  if($("toDeep")) $("toDeep").addEventListener("click",()=>{ $("toDeep").hidden=true; thBlocks=thBlocks.concat(deepBlocks); revealNext(true); });
  $("tMore").addEventListener("click",()=>revealNext(true));
  pane.querySelector(".theory").addEventListener("click",e=>{ const b=e.target.closest(".theory > p.past, .theory > .tb.past"); if(b) b.classList.toggle("open"); });
  updateMore();
  linkList($("tLinks"), current, j=>openTopic(j));
  if($("toPractice")) $("toPractice").addEventListener("click",()=>setTab("practice"));
  if($("toOut")) $("toOut").addEventListener("click",()=>openOut());
  if($("tNext")) $("tNext").addEventListener("click",()=>openTopic(nextIdx));
  if($("tGrows")) $("tGrows").addEventListener("click",e=>{ const b=e.target.closest("[data-i]"); if(b) openTopic(+b.dataset.i); });
}

/* ---------- PHONE «Эпизод»: the lesson as a stack of cards, one ## section per screen ----------
   Swipe = native CSS scroll-snap on .ep-track (no JS animation, no rAF); buttons and dots jump by scrollLeft.
   The current card is read on "scroll" events only. ГЛУБЖЕ is a separate bonus episode opened from the last card.
   Position lives in memory (epPos), so «← К УРОКУ» from «Выгрузка» or a tab switch returns to the same card. */
const epPos={};   /* id -> {deep, k} */
function renderEpisode(t, c, L, nextI){
  const id=t.id, pane=$("pane-theory"), P=epPos[id]||(epPos[id]={deep:false, k:0});
  const deep=P.deep && L.deeper.length>0; if(!deep) P.deep=false;
  stopTyping(); thBlocks=[]; thShown=0;
  const nDeep=L.deeper.length, qn=outQs(id).length, outPass=!!(outOf(id)||{}).pass;
  const body=list=>list.map(n=> n.t==="p" ? `<p>${n.html}</p>` : n.t==="ul" ? `<ul>${n.items.map(x=>`<li>${x}</li>`).join("")}</ul>` : n.t==="note" ? `<div class="lnote">${n.html}</div>` : `<pre class="lcode"><code>${hl(n.code)}</code></pre>`).join("");
  const sec=(x,k)=>`<section class="ep-card tb${deep?" deep":""}${/^Аналогия/.test(x.h)?" analogy":""}${/^Проверь себя/.test(x.h)?" check":""}"><h3><i>${deep?"+":""}${String(k+1).padStart(2,"0")}</i>${x.h}</h3>${body(x.body)}</section>`;
  const cards=[];
  if(!deep && L.mission) cards.push(`<section class="ep-card tb mission"><div class="m-k">${L.mission}</div>${L.scenario?`<h2>${L.scenario}</h2>`:""}${L.goals.length?`<div class="m-g"><span>ПОСЛЕ МИССИИ ТЫ СМОЖЕШЬ</span><ul>${L.goals.map(g=>`<li>${g}</li>`).join("")}</ul></div>`:""}</section>`);
  (deep ? L.deeper : L.base).forEach((x,k)=>cards.push(sec(x,k)));
  const outBtn = qn ? (outPass ? `<button class="ghostbtn" type="button" id="toOut">ВЫГРУЗКА ✓ · ПРОЙТИ ЕЩЁ РАЗ</button>` : `<button class="cta" type="button" id="toOut">ВЫГРУЗКА ▸ <small>${qn} ${plural(qn,["ВОПРОС","ВОПРОСА","ВОПРОСОВ"])} ПО ПАМЯТИ</small></button>`) : "";
  cards.push(`<section class="ep-card ep-end"><h3>${deep?"КОНЕЦ БОНУСА":"КОНЕЦ ЭПИЗОДА"}</h3>
    <p class="ep-tip">${qn ? "Текст урока закроется. Вытащи главное из головы — так тема и запоминается." : "Закрепи урок практикой: ответ — по памяти, потом сверка."}</p>
    <div class="ep-acts">${outBtn}
      ${c.steps && c.steps.length ? `<button class="${outPass||!qn?"cta":"ghostbtn"}" type="button" id="toPractice">ЗАПУСТИТЬ ПРАКТИКУ ▸</button>` : ""}
      ${!deep && nDeep ? `<button class="deepBtn" type="button" id="toDeep"><span>БОНУС · ГЛУБЖЕ ▸</span><small>${nDeep} ${nDeep<5?"РАЗДЕЛА":"РАЗДЕЛОВ"} · ДЛЯ СОБЕСА И MIDDLE</small></button>` : ""}
      ${deep ? `<button class="textbtn" type="button" id="epBase">← К ОСНОВНОМУ ЭПИЗОДУ</button>` : ""}</div>
    ${deep ? "" : growsHTML(id)}
    <div class="sect"><h3>СВЯЗИ</h3><ul class="links" id="tLinks"></ul></div>
    ${nextI>=0 ? `<div class="sect"><h3>ДАЛЬШЕ В ВЕТКЕ</h3><ul class="links"><li><button type="button" id="tNext"><span>${esc(topics[nextI].title)}</span><em>→</em></button></li></ul></div>` : ""}</section>`);
  const n=cards.length; P.k=Math.max(0, Math.min(P.k, n-1));
  pane.innerHTML = `<div class="ep${deep?" bonus":""}" id="ep">
    <div class="ep-h"><span class="ep-k">${deep?"БОНУС · ГЛУБЖЕ":"ЭПИЗОД"}</span><span class="ep-n" id="epN"></span></div>
    <div class="ep-dots" id="epDots">${cards.map((_,k)=>`<button type="button" data-k="${k}" aria-label="${k===n-1?"Финал":"Карточка "+(k+1)}"><i></i></button>`).join("")}</div>
    <div class="ep-track theory lesson" id="epTrack" tabindex="-1">${cards.join("")}</div>
    <div class="ep-nav"><button type="button" class="ghostbtn" id="epPrev" aria-label="Назад">◂</button><button type="button" class="cta" id="epNext">ДАЛЬШЕ ▸</button></div></div>`;
  const track=$("epTrack"), dots=[...$("epDots").children];
  if($("tGrows")) $("tGrows").addEventListener("click",e=>{ const b=e.target.closest("[data-i]"); if(b) openTopic(+b.dataset.i); });   /* «Корни»: reverse prereqs on the finale card */
  const paint=()=>{
    dots.forEach((d,k)=>{ d.classList.toggle("on", k===P.k); d.classList.toggle("past", k<P.k); if(k===P.k) d.setAttribute("aria-current","step"); else d.removeAttribute("aria-current"); });
    $("epN").textContent = String(P.k+1).padStart(2,"0")+" / "+String(n).padStart(2,"0");
    $("epPrev").disabled = P.k===0 && !deep;   /* in the bonus, ◂ on the first card returns to the base finale */
    const last=P.k>=n-1; $("epNext").hidden=last; $("epNext").textContent = P.k===n-2 ? "ФИНАЛ ▸" : "ДАЛЬШЕ ▸";
  };
  const go=k=>{ P.k=Math.max(0, Math.min(k, n-1)); paint(); if(track.clientWidth) track.scrollTo({left:P.k*track.clientWidth, behavior:"auto"}); };
  track.addEventListener("scroll",()=>{ const w=track.clientWidth; if(!w) return; const k=Math.round(track.scrollLeft/w); if(k!==P.k && k>=0 && k<n){ P.k=k; paint(); } },{passive:true});
  /* the pane may be hidden while rendering (openTopic), and the phone may rotate: snap back to the current card on resize */
  if(window.ResizeObserver){ const ro=new ResizeObserver(()=>{ if(!track.isConnected){ ro.disconnect(); return; } if(track.clientWidth) track.scrollLeft=P.k*track.clientWidth; }); ro.observe(track); }
  dots.forEach(d=>d.addEventListener("click",()=>go(+d.dataset.k)));
  $("epPrev").addEventListener("click",()=>{ if(deep && P.k===0){ epPos[id]={deep:false, k:1e9}; renderEpisode(t, c, L, nextI); } else go(P.k-1); });
  $("epNext").addEventListener("click",()=>go(P.k+1));
  track.addEventListener("keydown",e=>{ if(e.key==="ArrowRight"){ e.preventDefault(); go(P.k+1); } if(e.key==="ArrowLeft"){ e.preventDefault(); go(P.k-1); } });
  paint(); go(P.k);
  linkList($("tLinks"), current, j=>openTopic(j));
  if($("toPractice")) $("toPractice").addEventListener("click",()=>setTab("practice"));
  if($("toOut")) $("toOut").addEventListener("click",()=>openOut());
  if($("tNext")) $("tNext").addEventListener("click",()=>openTopic(nextI));
  if($("toDeep")) $("toDeep").addEventListener("click",()=>{ epPos[id]={deep:true, k:0}; renderEpisode(t, c, L, nextI); });
  if($("epBase")) $("epBase").addEventListener("click",()=>{ epPos[id]={deep:false, k:1e9};   /* back to the base finale (k is clamped) */ renderEpisode(t, c, L, nextI); });
}

/* ---------- «Выгрузка»: the lesson text is closed, the «Проверь себя» questions one by one, answer → reveal → self-grade ---------- */
let outSt=null;   /* {id, k, g:[grades], dunno, shown} — current run of the screen */
function outQs(id){ const L=(DATA.content[id]||{}).lesson; if(!L) return [];
  if(L.check) return L.check;
  const sec=L.base.find(x=>/^Проверь себя/.test(x.h)), ul=sec && sec.body.find(n=>n.t==="ul"); return ul ? ul.items : []; }
function htmlText(h){ const d=document.createElement("div"); d.innerHTML=h; return d.textContent; }
function openOut(){ if(current<0) return; outSt=null; renderOut(); if(activeTab!=="theory") setTab("theory"); else $("winBody").scrollTop=0; }
function outVerdict(g){ return g.includes("no") ? "no" : g.length && g.every(x=>x==="ok") ? "ok" : "part"; }   /* passed only when every answer was recalled */
function renderOut(){ setTimeout(()=>refreshTopicNav(current),0);
  const t=topics[current], id=t.id, qs=outQs(id), L=(DATA.content[id]||{}).lesson||{}, pane=$("pane-theory");
  stopTyping(); thBlocks=[]; thShown=0;
  if(!outSt || outSt.id!==id) outSt={id, k:0, g:[], dunno:false, shown:false};
  const S=outSt, n=qs.length;
  if(S.k>=n){ renderOutDone(t, S); return; }
  const drafts=store.get("pm.outAns."+id, []), draft=S.shown ? (drafts[S.k]||"") : "";
  pane.innerHTML = `<div class="out" id="out">
    <div class="out-h"><span>ВЫГРУЗКА · ВОПРОС <b>${S.k+1}</b> / ${n}</span><button type="button" class="textbtn" id="outBack">← К УРОКУ</button></div>
    <p class="out-tip">Текст урока закрыт. Вытащи ответ из головы: напиши его или ответь про себя. Потом открой ответ и честно оцени.</p>
    <h2 class="out-q">${qs[S.k]}</h2>
    <div class="answer"><label for="outAns">ТВОЙ ОТВЕТ</label><div class="ed"><textarea id="outAns" class="prose" spellcheck="false" placeholder="Своими словами: что → почему → последствия">${esc(draft)}</textarea></div>
      <div class="row-actions" id="outActs">
        <button type="button" class="cta" id="outShow" disabled>ПОКАЗАТЬ ОТВЕТ</button>
        <button type="button" class="textbtn" id="outSilent">ОТВЕТИЛ ПРО СЕБЯ</button>
        <button type="button" class="textbtn dunno" id="outDunno">НЕ ЗНАЮ — ПОКАЖИ</button>
        <span class="gate" id="outGate">${gateText("", true)}</span>
      </div></div>
    <div id="outKey"></div></div>`;
  const ta=$("outAns"), btn=$("outShow"), gate=$("outGate");
  const upd=()=>{ const left=answerLeft(ta.value, true); btn.disabled=left>0; gate.textContent=gateText(ta.value, true); };
  ta.addEventListener("input", upd); upd();
  $("outBack").addEventListener("click",()=>{ outSt=null; renderTheory(); $("winBody").scrollTop=0; });
  const reveal=dunno=>{
    S.shown=true; S.dunno=dunno;
    if(ta.value.trim()){ const d=store.get("pm.outAns."+id, []); d[S.k]=ta.value; store.set("pm.outAns."+id, d); }
    ta.readOnly=true; $("outActs").hidden=true;
    const a=L.answers && L.answers[S.k], ch=DATA.ref.cheat[id];
    const ansHTML = a ? `<div class="out-a">${a}</div>`
      : `<div class="out-a none"><span class="out-miss">ЭТАЛОННЫЙ ОТВЕТ ЕЩЁ НЕ НАПИСАН · СВЕРЬСЯ СО ШПАРГАЛКОЙ ТЕМЫ</span>${ch&&ch.length?`<ol class="ch-list">${ch.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`:`<p>Шпаргалки тоже нет — сверься с уроком после оценки.</p>`}</div>`;
    $("outKey").innerHTML = ansHTML + (dunno
      ? `<div class="assess"><span class="q">Записано: «нет». Разбери ответ — вопрос вернётся завтра.</span><button type="button" class="cta" id="outNext">${S.k+1<n?"СЛЕДУЮЩИЙ ВОПРОС ▸":"ИТОГ ▸"}</button></div>`
      : `<div class="assess"><span class="q">Насколько ты вспомнил это сам?</span><button type="button" class="cta" data-g="ok">ВСПОМНИЛ</button><button type="button" class="ghostbtn" data-g="part">ЧАСТИЧНО</button><button type="button" class="ghostbtn" data-g="no">НЕТ</button></div>`);
    if(dunno){ S.g[S.k]="no"; $("outNext").addEventListener("click",()=>{ S.k++; S.shown=false; renderOut(); $("winBody").scrollTop=0; }); }
    $("outKey").querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>{ S.g[S.k]=b.dataset.g; S.k++; S.shown=false; renderOut(); $("winBody").scrollTop=0; }));
    const kb=$("outKey"); if(kb.scrollIntoView) kb.scrollIntoView({block:"nearest"});
  };
  btn.addEventListener("click",()=>reveal(false));
  $("outSilent").addEventListener("click",()=>reveal(false));
  $("outDunno").addEventListener("click",()=>reveal(true));
}
function renderOutDone(t, S){
  const id=t.id, qs=outQs(id), g=S.g.slice(0, qs.length), v=outVerdict(g), now=Date.now();
  if(!S.saved){ S.saved=true;
    const old=outOf(id)||{}, wasDue=t.due;
    store.set("pm.out."+id, {at:now, g, v, pass: v==="ok" ? (old.pass||now) : (old.pass||0)});
    g.forEach((x,k)=>{ if(x!=="ok") logErr(id, "Выгрузка: "+htmlText(qs[k]), x==="no" ? "Не вспомнил — вопрос вернётся завтра." : "Вспомнил частично — сверь с ответом."); });
    const r=store.get("pm.srs."+id, null);
    if(v==="no") srsFail(id);
    else if(v==="ok" && !LEGACY[id] && !(recallOf(id)||{}).pass){ try{ localStorage.removeItem("pm.srs."+id); }catch(e){} }   /* not done yet: off the ladder, it starts when the topic is done */
    else if(r && (wasDue || r.due<=now)) srsGrade(id, v);
    if(pendingRun===dayKey()){ pendingRun=null; finishRunDay(); }
    fxLog(v==="ok"?"OK":"FAIL", "NODE://"+id.toUpperCase()+" · ВЫГРУЗКА "+(v==="ok"?"ЗАСЧИТАНА":v==="part"?"ЧАСТИЧНО":"· ПОВТОР ЗАВТРА"));
    v==="ok" ? sfx.ok() : sfx.no();
    refreshProgress(); refreshTopicNav(current); setPracticeSup(id);
    if(v==="ok") burst(current, 14);
  }
  const cnt=k=>g.filter(x=>x===k).length, done=statusOf(id)==="done", rec=recallOf(id);
  const msg = v==="ok"
    ? (done ? `<b>Засчитано.</b> Ступень 7 и Выгрузка пройдены по памяти — тема освоена. Повтор придёт сам по лесенке.`
            : `<b>Выгрузка засчитана.</b> Для статуса «освоено» осталась ступень 7 по памяти${rec&&rec.v?" — в прошлый раз она не засчитана":""}.`)
    : v==="part" ? `<b>Пока не засчитано.</b> «Частично» — это ещё не воспроизведение. Перечитай слабые места и пройди Выгрузку снова.`
    : `<b>Не вспомнил — это нормально.</b> Повтор поставлен на завтра, вопросы записаны в журнал ошибок (вкладка «Шпаргалка»).`;
  $("pane-theory").innerHTML = `<div class="out" id="out">
    <div class="out-h"><span>ВЫГРУЗКА · ИТОГ</span><button type="button" class="textbtn" id="outBack">← К УРОКУ</button></div>
    <div class="out-sum"><span>ВСПОМНИЛ <b>${cnt("ok")}</b></span><span>ЧАСТИЧНО <b>${cnt("part")}</b></span><span>НЕТ <b>${cnt("no")}</b></span></div>
    <div class="chk-res${v==="ok"?" ok":""}">${msg}
      <div class="out-acts">${(DATA.content[id]||{}).steps && DATA.content[id].steps.length && !(done && v==="ok") ? `<button type="button" class="cta" id="outPractice">${rec&&rec.pass?"К ПРАКТИКЕ ▸":"К СТУПЕНИ 7 ▸"}</button>` : ""}
      ${v!=="ok" ? `<button type="button" class="ghostbtn" id="outAgain">ПРОЙТИ ЕЩЁ РАЗ</button>` : ""}
      ${done && v==="ok" && nextIdx(current)>=0 ? `<button type="button" class="cta" id="outNextT">ДАЛЬШЕ · ${esc(topics[nextIdx(current)].title)} ▸</button>` : ""}</div></div></div>`;
  $("outBack").addEventListener("click",()=>{ outSt=null; renderTheory(); $("winBody").scrollTop=0; });
  if($("outAgain")) $("outAgain").addEventListener("click",()=>openOut());
  if($("outNextT")) $("outNextT").addEventListener("click",()=>openTopic(nextIdx(current),"theory"));
  if($("outPractice")) $("outPractice").addEventListener("click",()=>{ const st=DATA.content[id].steps; if(!(rec&&rec.pass)){ const k7=st.findIndex(x=>x.id==="s7"); if(k7>=0){ stepIdx=k7; bankIdx=-1; } } renderPractice(); setTab("practice"); });
}

/* ---------- «Корни»: before a lesson, each prereq not recalled lately → one question from memory → reveal → вспомнил / нет ---------- */
const ROOTS_FRESH=3*DAY;
let rootsSt=null;   /* {id, list:[prereq ids], k, shown, g:[]} */
function rootQ(p){ const o=DATA.ref.one[p], ch=DATA.ref.cheat[p], t=topics[TIDX[p]];
  if(o && o.q) return {q:o.q, a:o.a||""};
  if(ch && ch.length) return {q:"Что главное про «"+t.title+"»? Сформулируй одной фразой.", a:ch[0]};
  return null; }
/* last time a topic was pulled from memory: as a root, step 7, «Выгрузка» or an SRS grade */
function lastRecall(p){ const r=store.get("pm.srs."+p, null);
  const srsAt = r && r.due ? r.due-SRS_DAYS[Math.min(r.stage||0, SRS_DAYS.length-1)]*DAY : 0;
  return Math.max(rootOf(p).at||0, (recallOf(p)||{}).at||0, (outOf(p)||{}).at||0, Math.min(srsAt, Date.now())); }
function rootsDue(id){
  if(Date.now()-(store.get("pm.rootsSkip."+id, 0)||0) < DAY) return [];
  return prereqsOf(id).filter(p=>rootQ(p) && Date.now()-lastRecall(p) > ROOTS_FRESH); }
function openRoots(id){ const list=rootsDue(id); if(!list.length) return false; rootsSt={id, list, k:0, shown:false, g:[]}; renderRoots(); return true; }
function closeRoots(){ rootsSt=null; renderTheory(); $("winBody").scrollTop=0; }
function renderRoots(){
  const S=rootsSt, pane=$("pane-theory"); if(!S) return;
  stopTyping(); thBlocks=[]; thShown=0;
  if(S.k>=S.list.length){ renderRootsDone(); return; }
  const p=S.list[S.k], t=topics[TIDX[p]], q=rootQ(p);
  pane.innerHTML = `<div class="out roots" id="roots">
    <div class="out-h"><span>КОРНИ · <b>${S.k+1}</b> / ${S.list.length}</span><button type="button" class="textbtn" id="rootsSkip">ПРОПУСТИТЬ →</button></div>
    <p class="out-tip">Урок стоит на этих темах. Вспомни ответ по памяти, потом открой его и честно отметь. «Нет» поставит тему в повтор.</p>
    <div class="roots-t">${BRANCHES[t.b].code} · ${esc(t.title)}</div>
    <h2 class="out-q" id="rootsQ">${esc(q.q)}</h2>
    <div class="row-actions" id="rootsActs"><button type="button" class="cta" id="rootsShow">ПОКАЗАТЬ ОТВЕТ</button></div>
    <div id="rootsKey"></div></div>`;
  $("rootsSkip").addEventListener("click",()=>{ store.set("pm.rootsSkip."+S.id, Date.now()); closeRoots(); });
  $("rootsShow").addEventListener("click",()=>{
    S.shown=true; $("rootsActs").hidden=true;
    $("rootsKey").innerHTML = `<div class="out-a">${esc(q.a)}</div>
      <div class="assess"><span class="q">Вспомнил это сам, до ответа?</span><button type="button" class="cta" data-g="ok">ВСПОМНИЛ</button><button type="button" class="ghostbtn" data-g="no">НЕТ</button></div>`;
    $("rootsKey").querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>{
      const v=b.dataset.g; S.g[S.k]=v; store.set("pm.roots."+p, {at:Date.now(), v});
      if(v==="no"){ srsFail(p); logErr(p, "Корни: "+q.q, "Не вспомнил перед темой «"+topics[TIDX[S.id]].title+"». Ответ: "+q.a); sfx.no(); refreshProgress(); }
      else sfx.ok();
      S.k++; S.shown=false; renderRoots(); $("winBody").scrollTop=0; }));
    const kb=$("rootsKey"); if(kb.scrollIntoView) kb.scrollIntoView({block:"nearest"});
  });
}
function renderRootsDone(){
  const S=rootsSt, ok=S.g.filter(x=>x==="ok").length, n=S.list.length, miss=S.list.filter((p,k)=>S.g[k]==="no");
  $("pane-theory").innerHTML = `<div class="out roots" id="roots">
    <div class="out-h"><span>КОРНИ · ИТОГ</span></div>
    <div class="out-sum"><span>ВСПОМНИЛ <b>${ok}</b> / ${n}</span></div>
    <ul class="roots-sum">${S.list.map((p,k)=>`<li class="${S.g[k]==="no"?"no":""}"><b>${S.g[k]==="no"?"В ПОВТОР":"ВСПОМНИЛ"}</b><span>${esc(topics[TIDX[p]].title)}</span></li>`).join("")}</ul>
    <p class="out-tip">${miss.length ? "Темы с «нет» вернутся в повторе уже завтра. Урок можно читать и сейчас." : "Опора на месте — можно в урок."}</p>
    <div class="out-acts"><button type="button" class="cta" id="rootsGo">К УРОКУ ▸</button>
      ${miss.map(p=>`<button type="button" class="ghostbtn" data-i="${TIDX[p]}">ОТКРЫТЬ · ${esc(topics[TIDX[p]].title)}</button>`).join("")}</div></div>`;
  $("rootsGo").addEventListener("click",closeRoots);
  $("pane-theory").querySelectorAll(".out-acts [data-i]").forEach(b=>b.addEventListener("click",()=>{ rootsSt=null; openTopic(+b.dataset.i); }));
}
function growsHTML(id){ const g=GROWS[id]; if(!g || !g.length) return "";
  return `<p class="grows" id="tGrows"><span>Из этой темы растут:</span>${g.map((j,k)=>(k?"<i>·</i>":"")+`<button type="button" data-i="${j}">${esc(topics[j].title)}</button>`).join("")}</p>`; }

/* ---------- answer editor: auto-pairs, indent, tab, highlight, key sounds ---------- */
function attachEditor(ta, hlEl, opts){
  opts=opts||{}; const code=!opts.prose, IND="    ", PAIRS={"(":")","[":"]","{":"}",'"':'"',"`":"`"}, WORD=/[\p{L}\p{N}_]/u;
  let busy=false, free=false;
  const sync=()=>{ if(hlEl) hlEl.style.transform="translate("+(-ta.scrollLeft)+"px,"+(-ta.scrollTop)+"px)"; };
  const paint=()=>{ if(hlEl){ hlEl.innerHTML=hl(ta.value)+"\n "; sync(); } };
  const ins=txt=>{ busy=true; ta.focus(); let ok=false; try{ ok=document.execCommand("insertText",false,txt); }catch(e){}
    if(!ok){ ta.setRangeText(txt,ta.selectionStart,ta.selectionEnd,"end"); ta.dispatchEvent(new Event("input",{bubbles:true})); } busy=false; };
  const del=(a,b)=>{ ta.setSelectionRange(a,b); busy=true; let ok=false; try{ ok=document.execCommand("delete"); }catch(e){}
    if(!ok){ ta.setRangeText("",a,b,"end"); ta.dispatchEvent(new Event("input",{bubbles:true})); } busy=false; };
  const lineStart=(v,i)=>v.lastIndexOf("\n",i-1)+1;
  /* iOS smart punctuation turns " into “ ”, ... into … and -- into — : undo it in code answers */
  const SMART=/[“”„«»‘’…—]/, unsmart=x=>x.replace(/[“”„«»]/g,'"').replace(/[‘’]/g,"'").replace(/…/g,"...").replace(/—/g,"--");
  if(code) ta.addEventListener("input",()=>{ const v=ta.value; if(!SMART.test(v)) return; const s=ta.selectionStart; const nb=unsmart(v.slice(0,s)); ta.value=unsmart(v); ta.setSelectionRange(nb.length,nb.length); });
  if(hlEl && code){ hlEl.hidden=false; ta.classList.add("hl"); paint(); ta.addEventListener("input",paint); ta.addEventListener("scroll",sync); new ResizeObserver(sync).observe(ta); }
  if(!code) ta.classList.add("prose");
  /* one typed character with pairing rules; returns true when it handled the insertion itself */
  function smart(ch){
    const s=ta.selectionStart, en=ta.selectionEnd, v=ta.value, prev=v[s-1]||"", next=v[en]||"";
    if(s===en && next===ch && (ch===")"||ch==="]"||ch==="}"||ch==='"'||ch==="`")){ ta.setSelectionRange(s+1,s+1); return true; }
    if(PAIRS[ch]!==undefined){
      if(s!==en){ const sel=v.slice(s,en); ins(ch+sel+PAIRS[ch]); ta.setSelectionRange(s+1,s+1+sel.length); return true; }
      const q=(ch==='"'||ch==="`");
      if(q ? (WORD.test(prev)||WORD.test(next)||next==='"') : WORD.test(next)) return false;
      ins(ch+PAIRS[ch]); ta.setSelectionRange(s+1,s+1); return true;
    }
    if(ch==="}" && s===en){ const ls=lineStart(v,s), pre=v.slice(ls,s);
      if(pre.length && !pre.trim()){ const n=Math.min(pre.length, pre.length%4||4); ta.setSelectionRange(s-n,s); ins("}"); return true; } }
    return false;
  }
  function enterSmart(){
    const s=ta.selectionStart, en=ta.selectionEnd, v=ta.value, ls=lineStart(v,s), ind=v.slice(ls,s).match(/^[ \t]*/)[0].replace(/\t/g,IND), o="([{".indexOf(v[s-1]||"#"), between=o>=0 && v[en]===")]}"[o];
    if(between){ ins("\n"+ind+IND+"\n"+ind); const pos=s+1+ind.length+IND.length; ta.setSelectionRange(pos,pos); }
    else ins("\n"+ind+(o>=0?IND:""));
  }
  function backSmart(){
    const s=ta.selectionStart, en=ta.selectionEnd, v=ta.value; if(s!==en || s<1) return false;
    const p=v[s-1], n=v[s];
    if(PAIRS[p]!==undefined && PAIRS[p]===n){ del(s-1,s+1); return true; }
    const ls=lineStart(v,s), pre=v.slice(ls,s);
    if(pre.length>1 && !pre.trim()){ const k=Math.min(pre.length, pre.length%4||4); del(s-k,s); return true; }
    return false;
  }
  function tab(shift){
    const v=ta.value, s=ta.selectionStart, en=ta.selectionEnd;
    if(s===en && !shift){ const col=s-lineStart(v,s); ins(" ".repeat(4-col%4)); return; }
    const a=lineStart(v,s); let b=en; if(en>s && v[en-1]==="\n") b=en-1; const e2=v.indexOf("\n",b), end=e2<0?v.length:e2;
    const out=v.slice(a,end).split("\n").map(l=>shift ? l.replace(/^( {1,4}|\t)/,"") : (l.length?IND+l:l)).join("\n");
    ta.setSelectionRange(a,end); ins(out); ta.setSelectionRange(a, a+out.length);
  }
  ta.addEventListener("beforeinput",e=>{
    if(busy || !e.cancelable || e.isComposing) return;
    const t=e.inputType, s=ta.selectionStart, en=ta.selectionEnd, v=ta.value;
    if(t==="insertText") sfx.key(e.data===" "?"space":"key", e.data);
    else if(t==="insertLineBreak"||t==="insertParagraph") sfx.key("enter");
    else if(t && t.indexOf("delete")===0) sfx.key("back");
    if(!code) return;
    if(t==="insertText" && e.data && e.data.length===1){ const ch=unsmart(e.data);
      if(ch.length===1 && smart(ch)){ e.preventDefault(); return; }
      if(ch!==e.data){ e.preventDefault(); ins(ch); } return; }
    if((t==="insertLineBreak"||t==="insertParagraph")){ e.preventDefault(); enterSmart(); return; }
    if(t==="deleteContentBackward" && backSmart()) e.preventDefault();
  });
  ta.addEventListener("keydown",e=>{
    if(e.key==="Enter" && (e.ctrlKey||e.metaKey) && opts.onSubmit){ e.preventDefault(); opts.onSubmit(); return; }
    if(e.key==="Escape"){ free=true; return; }
    if(e.key!=="Tab"){ free=false; return; }
    if(!code || free || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault(); tab(e.shiftKey);
  });
  /* API for the on-screen symbol bar (phone) */
  return {
    sym(t){ ta.focus(); sfx.key(t===" "?"space":"key", t[0]); if(!code){ ins(t); return; }
      if(t==="\\(") { ins("\\"); if(!smart("(")) ins("("); return; }
      if(t.length===1 && smart(t)) return; ins(t); },
    tab(shift){ ta.focus(); if(code) tab(!!shift); else ins("    "); },
    newline(){ ta.focus(); sfx.key("enter"); if(code) enterSmart(); else ins("\n"); },
    back(){ ta.focus(); sfx.key("back"); if(code && backSmart()) return; const s=ta.selectionStart, en=ta.selectionEnd; if(s!==en) del(s,en); else if(s>0) del(s-1,s); },
    move(d){ ta.focus(); const p=Math.max(0, Math.min(ta.value.length, (d<0?ta.selectionStart:ta.selectionEnd)+d)); ta.setSelectionRange(p,p); },
    prefix(){ const v=ta.value; let a=ta.selectionStart; while(a>0 && /[A-Za-z0-9_]/.test(v[a-1])) a--; return v.slice(a, ta.selectionStart); },
    complete(w, space){ ta.focus(); sfx.key("key", w[0]); const v=ta.value, s=ta.selectionStart; let a=s; while(a>0 && /[A-Za-z0-9_]/.test(v[a-1])) a--; ta.setSelectionRange(a,s); ins(w+(space?" ":"")); }
  };
}

/* ---------- Synapso on-screen keyboard (phone, code answers): no system keyboard -> no overlap, no page shift ---------- */
const SKB_KW=["let","var","func","guard","return","if","else","print","nil","self","true","false","struct","class","enum","case","switch","for","in","while","init","String","Int","Bool","Double","Array","weak","private","static","protocol","extension","import","async","await","try","throws","some","any","where","default","break","continue","map","filter","reduce","compactMap","isEmpty","count","append","first","last","contains","sorted"];
const SKB_SPACE=new Set(["let","var","func","guard","return","if","else","struct","class","enum","case","switch","for","in","while","weak","private","static","protocol","extension","import","async","await","try","throws","some","any","where"]);
function canSkb(){ return narrow() && (navigator.maxTouchPoints>0 || "ontouchstart" in window); }
function buildSkb(host, ed, act, src){
  const ids=[...new Set((String(src||"").replace(/"(?:[^"\\\n]|\\.)*"/g," ").replace(/\/\/[^\n]*/g," ").match(/[A-Za-z_][A-Za-z0-9_]*/g)||[]))].filter(w=>w.length>1);
  const words=[...ids.filter(w=>!SKB_KW.includes(w)), ...SKB_KW];
  let layer="abc", shift=0, lastShift=0, rep=null;
  const LAY={ abc:["qwertyuiop","asdfghjkl","⇧zxcvbnm⌫"], num:["1234567890","-/+*%&|^~'","#_\\@$`;,⌫"] };
  const keyHtml=(k,cls)=>`<button type="button" class="${cls||""}" data-k="${esc(k)}">${esc(k)}</button>`;
  host.innerHTML = `<div class="skb-sug"><button type="button" class="w" data-k="done">Готово</button><div class="sug" id="skbSug"></div><button type="button" class="w" data-k="key">Ключ</button></div>
    <div class="skb-row sym">${["⇥","{","}","(",")","[","]",'"',".",":","=","?","!"].map(k=>keyHtml(k)).join("")}</div>
    <div class="skb-keys" id="skbKeys"></div>
    <div class="skb-row bot">${keyHtml("123","w lay")}${keyHtml("⌨","w")}${keyHtml("←","w")}<button type="button" class="space" data-k=" ">space</button>${keyHtml("→","w")}${keyHtml("⏎","w ret")}</div>`;
  const keysEl=host.querySelector("#skbKeys"), sugEl=host.querySelector("#skbSug"), layBtn=host.querySelector(".lay");
  function drawKeys(){ keysEl.innerHTML = LAY[layer].map(row=>`<div class="skb-row">${[...row].map(c=>{
      if(c==="⇧") return keyHtml("⇧","w shift"+(shift?" on":"")+(shift===2?" lock":""));
      if(c==="⌫") return keyHtml("⌫","w bs");
      return keyHtml(layer==="abc" && shift ? c.toUpperCase() : c); }).join("")}</div>`).join("");
    layBtn.textContent = layer==="abc" ? "123" : "ABC"; layBtn.dataset.k = layer==="abc" ? "123" : "ABC"; }
  function drawSug(){ const p=ed.prefix(); let list;
    if(p){ const lp=p.toLowerCase(); list=words.filter(w=>w!==p && w.toLowerCase().startsWith(lp)).slice(0,10); }
    else list=["let","var","func","guard","return","if", ...ids.slice(0,6), "print"].filter((w,i,a)=>a.indexOf(w)===i).slice(0,10);
    sugEl.innerHTML = list.map(w=>`<button type="button" data-w="${esc(w)}">${esc(w)}</button>`).join(""); sugEl.scrollLeft=0; }
  function press(b){
    if(b.dataset.w){ ed.complete(b.dataset.w, SKB_SPACE.has(b.dataset.w)); drawSug(); return; }
    const k=b.dataset.k; if(k==null) return;
    if(k==="done"||k==="key"||k==="kbd"){ act(k); return; }
    if(k==="⌨"){ act("sys"); return; }
    if(k==="123"||k==="ABC"){ layer = layer==="abc" ? "num" : "abc"; shift=0; drawKeys(); return; }
    if(k==="⇧"){ const now=Date.now(); shift = shift ? 0 : (now-lastShift<350 ? 2 : 1); if(shift===0 && now-lastShift<350) shift=2; lastShift=now; drawKeys(); return; }
    if(k==="⌫"){ ed.back(); drawSug(); return; }
    if(k==="←"){ ed.move(-1); drawSug(); return; } if(k==="→"){ ed.move(1); drawSug(); return; }
    if(k==="⏎"){ ed.newline(); drawSug(); return; }
    if(k==="⇥"){ ed.tab(false); drawSug(); return; }
    ed.sym(k); if(shift===1 && layer==="abc"){ shift=0; drawKeys(); } drawSug();
  }
  const REPEAT=new Set(["⌫","←","→"]);
  const stopRep=()=>{ if(rep){ clearTimeout(rep.t); clearInterval(rep.i); rep=null; } };
  let tBtn=null;
  host.addEventListener("touchstart",e=>{ const b=e.target.closest("button"); if(!b) return;
    if(b.closest(".sug")){ tBtn=b; tBtn._x=e.touches[0].clientX; return; }  /* suggestions scroll sideways: act on touchend if it did not move */
    e.preventDefault(); tBtn=b; b.classList.add("down");
    if(REPEAT.has(b.dataset.k)){ press(b); rep={t:setTimeout(()=>{ rep.i=setInterval(()=>press(b),70); },380)}; tBtn._done=true; } },{passive:false});
  host.addEventListener("touchend",e=>{ const b=tBtn; tBtn=null; stopRep(); if(!b) return; b.classList.remove("down");
    if(b.closest(".sug")){ const t=e.changedTouches[0]; if(Math.abs(t.clientX-(b._x||t.clientX))>8) return; }
    e.preventDefault(); if(b._done){ b._done=false; return; } press(b); },{passive:false});
  host.addEventListener("touchcancel",()=>{ stopRep(); if(tBtn){ tBtn.classList.remove("down"); tBtn=null; } });
  host.addEventListener("mousedown",e=>{ if(e.target.closest("button")) e.preventDefault(); });
  host.addEventListener("click",e=>{ const b=e.target.closest("button"); if(b && !("ontouchstart" in window)) press(b); });
  drawKeys(); drawSug();
  return {refresh:drawSug};
}
/* phone typing mode: the practice window fills the area above the on-screen keyboard */
let vvMode="vv";   /* vv: follow visualViewport · full: own keyboard, whole screen · guess: system keyboard the page cannot measure */
function updVV(){ if(vvMode!=="vv") return; const vv=window.visualViewport, st=document.documentElement.style; st.setProperty("--vvh", Math.round(vv?vv.height:window.innerHeight)+"px"); st.setProperty("--vvt", Math.round(vv?vv.offsetTop:0)+"px"); }
function fullVV(){ vvMode="full"; const st=document.documentElement.style; st.setProperty("--vvh", window.innerHeight+"px"); st.setProperty("--vvt","0px"); }
let baseH=window.innerHeight;
window.addEventListener("resize",()=>{ if(!document.body.classList.contains("kb-on")) baseH=window.innerHeight; });
function guessVV(){ if(!document.body.classList.contains("kb-on") || vvMode!=="vv") return; const vv=window.visualViewport;
  if(vv && vv.height < window.innerHeight*0.85) return;   /* the browser did report the keyboard */
  if(window.innerHeight < baseH*0.9) return;              /* the whole layout shrank (Android-style) — nothing to guess */
  vvMode="guess"; const st=document.documentElement.style; st.setProperty("--vvh", Math.round(window.innerHeight*0.56)+"px"); st.setProperty("--vvt","0px"); try{ window.scrollTo(0,0); }catch(e){} requestAnimationFrame(()=>fitCode()); }
function exitKb(){ vvMode="vv"; if(!document.body.classList.contains("kb-on")) return; document.body.classList.remove("kb-on"); const p=$("pane-practice"); if(p) p.classList.remove("kbd","codebig"); requestAnimationFrame(()=>fitCode()); }
if(window.visualViewport){ ["resize","scroll"].forEach(ev=>window.visualViewport.addEventListener(ev,()=>{ if(!document.body.classList.contains("kb-on")) return; if(vvMode==="guess" && window.visualViewport.height < window.innerHeight*0.85) vvMode="vv"; updVV(); })); }
window.addEventListener("resize",()=>{ if(document.body.classList.contains("kb-on")) updVV(); });
function renderPractice(){ setTimeout(()=>refreshTopicNav(current),0);
  const t=topics[current], c=DATA.content[t.id], pane=$("pane-practice");
  stopTyping();
  if(!c || !c.steps.length){ pane.innerHTML=`<p class="empty">Практика для этой темы ещё не написана.</p>`; return; }
  const prog=progressOf(t.id), steps=c.steps, bank=bankFor(t.id), inBank = bankIdx>=0 && bankIdx<bank.length;
  const s = inBank ? bank[bankIdx] : steps[stepIdx];
  const grades=gradesOf(t.id);
  const ladder = steps.map((st,k)=>{ const cls=[prog[st.id]==="ok"?"ok":grades[st.id]==="part"?"part":prog[st.id]==="no"?"no":"", k===stepIdx?"on":""].join(" ");
    return `<button type="button" class="rung ${inBank?cls.replace("on",""):cls}" data-step="${k}" aria-label="${esc(st.title)}"><span class="dot">${k+1}</span><span class="lbl">${esc(short(st.title))}</span></button>`; }).join("")
    + (bank.length ? `<button type="button" class="rung bankrung ${inBank?"on":""}" id="bankRung" aria-label="Банк задач"><span class="dot">+${bank.length}</span><span class="lbl">БАНК</span></button>` : "");
  /* blind recall: an SRS review or the «Уже знаю» check of step 7 starts from an empty field (own draft key pm.rans.<id>);
     the previous answer (pm.ans.<id>.s7) can be shown only after the key */
  const blind = !inBank && s.id==="s7" && (t.due || checkMode===t.id);
  const ansKey = inBank ? "pm.bankAns."+s.id : blind ? "pm.rans."+t.id : "pm.ans."+t.id+"."+s.id;
  const saved = store.get(ansKey, ""), prevAns = blind ? store.get("pm.ans."+t.id+".s7", "") : "";
  const oral = inBank ? s.type==="Устно" : s.id==="s5";
  const rec = recallOf(t.id), outP = !!(outOf(t.id)||{}).pass;
  const s7note = !inBank && s.id==="s7" && !blind && rec && rec.pass && !outP && outQs(t.id).length
    ? `<div class="s7note">Ступень 7 по памяти засчитана · для «освоено» осталась Выгрузка <button type="button" class="textbtn" id="s7out">К ВЫГРУЗКЕ ▸</button></div>` : "";
  const bst = inBank ? bankStat(s.id) : null;
  pane.innerHTML = `<div class="ladder">${ladder}</div>
    <div class="p-code">${s.code ? terminal(s.code, inBank ? "Задача из банка "+(bankIdx+1)+" из "+bank.length : PHONE ? "Задача "+(stepIdx+1)+" из "+steps.length : "Код задачи", "", {plain: oral || proseCode(s.code)}) : ""}</div>
    <div class="split" id="split" role="separator" aria-orientation="vertical" tabindex="0" title="Потяни — изменить ширину · двойной клик — авто"></div>
    <div class="p-side">
      ${inBank ? `<div class="bank-h"><span class="bt">${esc(s.type.toUpperCase())}${s.mins?" · "+s.mins+" МИН":""}</span><span>${bst.ok?"РЕШЕНО ×"+bst.ok:bst.no?"НЕ ВЫШЛО ×"+bst.no:"НОВАЯ"}</span><span class="bnav"><button type="button" class="textbtn" id="bankPrev">◂</button><button type="button" class="textbtn" id="bankNext">ДРУГАЯ ▸</button></span></div>` : ""}
      ${s7note}${blind ? `<div class="s7note">${t.due?"ПОВТОР ВСЛЕПУЮ":"ПРОВЕРКА ПО ПАМЯТИ"} · поле пустое, ключ закрыт — прошлый ответ покажу после сверки</div>` : ""}
      <h2 class="step-title">${esc(inBank ? s.title : short(s.title))}</h2>
      <p class="prompt">${esc(s.prompt)}</p>
      <div class="answer">
        <label for="ans">${oral ? "ОТВЕТ СВОИМИ СЛОВАМИ" : "ТВОЙ ОТВЕТ"}</label>
        <div class="ed" id="ed"><pre class="ed-hl" id="edHl" aria-hidden="true" hidden></pre><textarea id="ans" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder="${oral ? "Объясни, как на собесе: что → почему → последствия" : "> пиши по памяти"}">${esc(saved)}</textarea></div>
        ${oral ? `<div class="ed-tip"><button type="button" class="textbtn" id="keySnd"></button></div>` : `<div class="ed-tip"><span class="ed-keys">Tab — отступ · скобки закрываются сами · Ctrl+Enter — ключ</span> <button type="button" class="textbtn" id="keySnd"></button></div>`}
        <div class="row-actions">
          <button type="button" class="textbtn" id="showKey" ${answerLeft(saved,oral)?"disabled":""}>ПОКАЗАТЬ КЛЮЧ</button>
          <button type="button" class="textbtn dunno" id="dunno">НЕ ЗНАЮ — ПОКАЖИ</button>
          <span class="gate" id="gate">${gateText(saved,oral)}</span>
        </div>
      </div>
      <div id="keyBox"></div>
    </div>
    ${(!oral && canSkb()) ? `<div class="skb" id="skb" aria-label="Клавиатура Synapso"></div>` : ""}
    <div class="symbar${oral?" prose":""}" id="symbar" aria-label="Символы для кода">${(oral ? [["done","Готово","w"],["flip","⇅","w"],["key","Ключ","w"]] : [["done","Готово","w"],["tab","⇥",""],["{","{",""],["}","}",""],["(","(",""],[")",")",""],["[","[",""],["]","]",""],['"','"',""],["\\(","\\(",""],["key","Ключ","w"],["kbd","SW","w"],[":",":",""],[".",".",""],["=","=",""],["->","->",""],["?","?",""],["!","!",""],["_","_",""],["<","<",""],[">",">",""],["flip","⇅","w"]]).map(b=>`<button type="button" data-s="${esc(b[0])}" class="${b[2]}">${esc(b[1])}</button>`).join("")}</div>`;
  requestAnimationFrame(fitCode);
  pane.querySelectorAll(".rung[data-step]").forEach(b=>b.addEventListener("click",()=>{ stepIdx=+b.dataset.step; bankIdx=-1; renderPractice(); startTyping("practice"); }));
  if($("bankRung")) $("bankRung").addEventListener("click",()=>{ if(bankIdx<0) bankIdx=pickBank(t.id); renderPractice(); startTyping("practice"); });
  if(inBank){
    $("bankNext").addEventListener("click",()=>{ bankIdx=pickBank(t.id, s.id); renderPractice(); startTyping("practice"); });
    $("bankPrev").addEventListener("click",()=>{ bankIdx=(bankIdx-1+bank.length)%bank.length; renderPractice(); startTyping("practice"); });
  }
  const ta=$("ans"), kb=$("showKey"), gate=$("gate");
  pane.classList.remove("typing");
  ta.addEventListener("focus",()=>{ if(!pane.classList.contains("typing")){ pane.classList.add("typing"); fitCode(true); } });
  pane.querySelector(".p-code").addEventListener("pointerdown",()=>{ if(pane.classList.contains("typing")){ pane.classList.remove("typing"); fitCode(true); } });
  (function(){ const sp=$("split"); if(!sp) return;
    const setFrac=f=>{ f=Math.max(0.2,Math.min(0.7,f)); store.set("pm.split",+f.toFixed(3)); fitCode(); };
    sp.addEventListener("pointerdown",e=>{ e.preventDefault(); sp.setPointerCapture(e.pointerId); pane.classList.add("dragging"); });
    sp.addEventListener("pointermove",e=>{ if(!pane.classList.contains("dragging")) return; const r=pane.getBoundingClientRect(); setFrac((e.clientX-r.left-9)/r.width); });
    const end=()=>pane.classList.remove("dragging"); sp.addEventListener("pointerup",end); sp.addEventListener("pointercancel",end);
    sp.addEventListener("dblclick",()=>{ try{ localStorage.removeItem("pm.split"); }catch(e){} fitCode(); });
    sp.addEventListener("keydown",e=>{ if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight") return; e.preventDefault(); const cur=(parseFloat(pane.style.getPropertyValue("--pc-w"))||pane.clientWidth*0.45)/pane.clientWidth; setFrac(cur+(e.key==="ArrowRight"?0.02:-0.02)); });
  })();
  (function(){ const NAMES={kb:"КЛАВИАТУРА",tw:"МАШИНКА",term:"ТЕРМИНАЛ",drop:"КАПЛИ",soft:"ТИХИЙ",off:"ВЫКЛ"}, ORDER=["drop","off"], b=$("keySnd"); if(!b) return;
    const lab=()=>{ b.textContent = "ЗВУК ПЕЧАТИ: " + (sfx.on ? NAMES[sfx.keyProf] : "ВЫКЛ — нажми, чтобы включить"); };
    b.addEventListener("click",()=>{ if(!sfx.on){ sfx.toggle(); if(typeof sfxLabel==="function") sfxLabel(); }
      else sfx.setKeyProf(ORDER[(ORDER.indexOf(sfx.keyProf)+1)%ORDER.length]);
      lab(); sfx.key("key","a"); setTimeout(()=>sfx.key("key","("),110); setTimeout(()=>sfx.key("enter"),230); ta.focus(); }); lab(); })();
  const ed=attachEditor(ta, $("edHl"), {prose: oral, onSubmit:()=>{ if(!kb.disabled) kb.click(); }});
  exitKb();
  const useSkb = !oral && canSkb() && store.get("pm.kbd","skb")!=="sys";
  if(useSkb){ ta.setAttribute("inputmode","none"); pane.classList.add("skbm"); } else pane.classList.remove("skbm");
  /* phone: «Ключ» before the answer is long enough — stay in typing mode, the key button shows what is missing */
  const gateFlash=()=>pane.querySelectorAll('[data-k="key"],[data-s="key"]').forEach(b=>{ if(b.dataset.lab==null) b.dataset.lab=b.textContent;
    const n=answerLeft(ta.value,oral); b.textContent="ещё "+n; b.classList.add("gflash"); clearTimeout(b._gt);
    b._gt=setTimeout(()=>{ b.textContent=b.dataset.lab; b.classList.remove("gflash"); },1600); });
  const doAct=v=>{
    if(v==="done"){ ta.blur(); exitKb(); return; }
    if(v==="key"){ if(PHONE && kb.disabled && !kb.dataset.open){ gateFlash(); return; } ta.blur(); exitKb(); if(!kb.disabled){ kb.click(); setTimeout(()=>{ const k=$("keyBox"); if(k) k.scrollIntoView({block:"start",behavior:"smooth"}); },350); } else { gate.classList.remove("blink"); void gate.offsetWidth; gate.classList.add("blink"); } return; }
    if(v==="sys"||v==="kbd"){ store.set("pm.kbd", v==="sys" ? "sys" : "skb"); renderPractice(); const t2=$("ans"); if(t2){ t2.focus(); t2.setSelectionRange(t2.value.length,t2.value.length); } return; }
  };
  const skb = useSkb && $("skb") ? buildSkb($("skb"), ed, doAct, s.code) : null;
  if(skb){ ta.addEventListener("input",()=>skb.refresh()); ta.addEventListener("click",()=>skb.refresh()); }
  const pr=pane.querySelector(".prompt"), markMore=()=>{ if(!pr) return; if(!pr.classList.contains("open")) pr.scrollTop=0; pr.classList.toggle("pmore", pr.classList.contains("open") || pr.scrollHeight>pr.clientHeight+2); };
  ta.addEventListener("focus",()=>{ if(!narrow()) return; document.body.classList.add("kb-on"); pane.classList.add("kbd");
    if(useSkb){ fullVV(); } else { updVV(); setTimeout(guessVV, 550); }
    try{ window.scrollTo(0,0); }catch(e){} requestAnimationFrame(()=>{ fitCode(); markMore(); }); });
  if(pr) pr.addEventListener("scroll",()=>{ if(pane.classList.contains("kbd") && !pr.classList.contains("open") && pr.scrollTop) pr.scrollTop=0; });
  if(pr){ const flipP=e=>{ if(!pane.classList.contains("kbd")) return; e.preventDefault(); pr.classList.toggle("open"); markMore(); };
    pr.addEventListener("touchend",flipP,{passive:false}); pr.addEventListener("mousedown",e=>{ if(pane.classList.contains("kbd")) e.preventDefault(); }); pr.addEventListener("click",flipP); }
  ta.addEventListener("blur",()=>setTimeout(()=>{ const a=document.activeElement; if(!a || a.id!=="ans") exitKb(); },180));
  (function(){ const bar=$("symbar"); if(!bar) return;
    const act=btn=>{ const v=btn.dataset.s;
      if(v==="done"||v==="kbd"){ doAct(v); return; }
      if(v==="key"){ doAct("key"); return; }
      if(v==="flip"){ pane.classList.toggle("codebig"); requestAnimationFrame(()=>{ fitCode(); markMore(); }); return; }
      if(v==="tab"){ ed.tab(false); return; } if(v==="untab"){ ed.tab(true); return; }
      ed.sym(v); };
    let tBtn=null;
    bar.addEventListener("touchstart",e=>{ const b=e.target.closest("button"); if(!b) return; e.preventDefault(); tBtn=b; b.classList.add("down"); },{passive:false});
    bar.addEventListener("touchend",e=>{ if(!tBtn) return; e.preventDefault(); const b=tBtn; tBtn=null; b.classList.remove("down"); act(b); },{passive:false});
    bar.addEventListener("touchcancel",()=>{ if(tBtn){ tBtn.classList.remove("down"); tBtn=null; } });
    bar.addEventListener("mousedown",e=>{ if(e.target.closest("button")) e.preventDefault(); });
    bar.addEventListener("click",e=>{ const b=e.target.closest("button"); if(b) act(b); });
  })();
  ta.addEventListener("input",()=>{ if(blind && kb.dataset.open) return; store.set(ansKey, ta.value); if(kb.dataset.open) return; kb.disabled=answerLeft(ta.value,oral)>0; gate.textContent=gateText(ta.value,oral); });
  if($("s7out")) $("s7out").addEventListener("click",()=>openOut());
  $("dunno").addEventListener("click",()=>{ if(kb.dataset.open) return; showKeyNow(true); });
  kb.addEventListener("click",()=>{ if(!kb.disabled) showKeyNow(false); });
  function showKeyNow(dunno){
    kb.dataset.open="1"; $("dunno").hidden=true; kb.hidden=true;
    if(blind) store.set(ansKey, "");   /* the key has been seen: the next review starts empty again */
    const pc=document.querySelector("#pane-practice .p-code"), wide=pc && pc.querySelector(".term") && $("winBody").classList.contains("fit") && !narrow();
    let keyTerm;
    /* long keys (> 25 lines) carry 3–5 required points: the learner grades against them, the full code stays below */
    const pts = s.points && s.points.length ? `<div class="kpoints"><div class="kp-h">СВЕРЬ ПО ПУНКТАМ · ВСЕ ОБЯЗАТЕЛЬНЫ</div><ol>${s.points.map(p=>`<li>${p}</li>`).join("")}</ol></div>` : "";
    if(wide){
      const task=pc.querySelector(".term"); task.dataset.v="task";
      task.querySelector(".term-h span:last-child").insertAdjacentHTML("beforeend", ` <button type="button" class="kswap" data-to="key">ключ →</button>`);
      pc.insertAdjacentHTML("beforeend", terminal(s.key, "Ключ", `сверь со своим ответом <button type="button" class="kswap" data-to="task">← задача</button>`, {plain:true, key:true}));
      keyTerm=pc.lastElementChild; keyTerm.dataset.v="key"; task.style.display="none";
      pc.addEventListener("click",e=>{ const bt=e.target.closest(".kswap"); if(!bt) return; pc.querySelectorAll(".term").forEach(x=>x.style.display = x.dataset.v===bt.dataset.to ? "" : "none"); requestAnimationFrame(fitCode); sfx.hover && sfx.hover(1,1); });
      $("keyBox").innerHTML = pts;
    } else { $("keyBox").innerHTML = pts + terminal(s.key, "Ключ", pts?"полный код":"сверь со своим ответом", {plain:true, key:true}); keyTerm=$("keyBox").querySelector(".term"); }
    $("keyBox").insertAdjacentHTML("beforeend", (prevAns.trim() ? `<div class="prevans"><button type="button" class="textbtn" id="prevBtn">ПОКАЗАТЬ ПРОШЛЫЙ ОТВЕТ</button><div id="prevBox"></div></div>` : "") + (dunno
      ? `<div class="assess"><span class="q">Записано: «пока нет». Разбери ключ${!inBank&&s.id==="s7"?" — ступень 7 вернётся на повторе":""}.</span><button type="button" class="cta" id="nextBtn">${inBank?"ДРУГАЯ ЗАДАЧА ▸":stepIdx<steps.length-1?"СЛЕДУЮЩАЯ СТУПЕНЬ ▸":"ГОТОВО"}</button></div>`
      : `<div class="assess"><span class="q">${pts?"Сверь по пунктам":"Сверь с ключом"}: насколько ты вспомнил это сам?</span>
        <button type="button" class="cta" id="okBtn">ВСПОМНИЛ</button>
        <button type="button" class="ghostbtn" id="partBtn">ЧАСТИЧНО</button>
        <button type="button" class="ghostbtn" id="noBtn">НЕТ</button></div>`));
    kb.disabled=true; gate.textContent="";
    fitCode(); typeSeq([{el:keyTerm.querySelector(".term-b"), cps:420}]);
    if($("prevBtn")) $("prevBtn").addEventListener("click",()=>{ $("prevBox").innerHTML=terminal(prevAns, "Прошлый ответ", "до этого повтора", {plain:oral || proseCode(prevAns)}); $("prevBtn").hidden=true; });
    if(dunno){ const res=mark("no", false, true); if(res==="check") return;
      $("nextBtn").addEventListener("click",()=>{ if(inBank){ store.set(ansKey, ""); bankIdx=pickBank(t.id, s.id); } else if(stepIdx<steps.length-1) stepIdx++; renderPractice(); startTyping("practice"); }); return; }
    $("okBtn").addEventListener("click",()=>mark("ok")); $("partBtn").addEventListener("click",()=>mark("part")); $("noBtn").addEventListener("click",()=>mark("no"));
  }
  /* v: "ok" вспомнил · "part" частично · "no" нет. pm.steps keeps its old ok/no format (part → no), the 3 levels go to pm.grade.<id>.
     stay: record only, keep the key on screen (the «не знаю — покажи» path) */
  function mark(v, silent, stay){
    if(pendingRun===dayKey()){ pendingRun=null; finishRunDay(); }
    if(inBank){
      fxLog(v==="ok"?"OK":"FAIL", "BANK://"+s.id.toUpperCase()+(v==="ok"?" · РЕШЕНО":" · В ЖУРНАЛ")); const st=bankStat(s.id); st[v==="ok"?"ok":"no"]++; st.last=Date.now(); store.set("pm.bank."+s.id, st);
      if(v==="ok"){ burst(current, 12); sfx.ok(); } else { sfx.no(); } if(v!=="ok") logErr(t.id, s.title+": "+s.prompt, v==="part" ? "Банк задач: частично — сверить с ключом." : "Банк задач: не вышло — разобрать по ключу.");
      if(v==="no") backFail("b", t.id, s.id, bankEq(s)); else if(v==="ok") backPass(backKey("b", t.id, s.id));
      if(stay) return;
      store.set(ansKey, ""); bankIdx=pickBank(t.id, s.id); renderPractice(); startTyping("practice"); return;
    }
    if(silent){ const p=progressOf(t.id); p[s.id]=v; store.set("pm.steps."+t.id, p); refreshProgress();
      setPracticeSup(t.id);
      const r=document.querySelector('.rung[data-step="'+stepIdx+'"]'); if(r){ r.classList.toggle("ok",v==="ok"); r.classList.toggle("no",v==="no"); }
      return; }
    const gr=gradesOf(t.id); gr[s.id]=v; store.set("pm.grade."+t.id, gr);
    if(v==="no") backFail("s", t.id, s.id, stepEq(s)); else if(v==="ok") backPass(backKey("s", t.id, s.id));   /* «нет» comes back in the run on day 1 and 3 */
    if(s.id==="s7"){ const r0=recallOf(t.id)||{}; store.set("pm.recall."+t.id, {at:Date.now(), v, pass: v==="ok" ? (r0.pass||Date.now()) : (r0.pass||0)}); }
    if(blind){ if(v==="ok" && ta.value.trim()) store.set("pm.ans."+t.id+".s7", ta.value); store.set(ansKey, ""); }
    if(t.due && s.id==="s7") srsGrade(t.id, v);
    v = v==="ok" ? "ok" : "no";   /* pm.steps stays ok/no */
    if(checkMode===t.id && s.id==="s7"){
      checkMode=null;
      if(v==="ok"){ KNOWN[t.id]=Date.now(); store.set("pm.known",KNOWN); delete SKIP[t.id]; store.set("pm.skip",SKIP); fxLog("OK","NODE://"+t.id.toUpperCase()+" · ЗНАНИЕ ПОДТВЕРЖДЕНО"); }
      const p0=progressOf(t.id); p0[s.id]=v; store.set("pm.steps."+t.id, p0);
      if(v==="ok"){ burst(current, 18); sfx.step(stepIdx, true); } else { sfx.no(); logErr(t.id, short(s.title)+": "+s.prompt, "Проверка «уже знаю» не прошла — пройти тему с теории."); }
      refreshProgress(); refreshTopicNav(current);
      showCheckResult(v==="ok"); return "check";
    }
    if(v==="no") logErr(t.id, short(s.title)+": "+s.prompt, gr[s.id]==="part" ? "Самооценка: частично — сверить с ключом." : "Самооценка: пока не справился.");
    const p=progressOf(t.id); p[s.id]=v; store.set("pm.steps."+t.id, p);
    if(v==="ok") burst(current, 14);
    if(v==="ok"){ const pp=progressOf(t.id); const okAfter=steps.filter(st=>pp[st.id]==="ok" || st.id===s.id).length; sfx.step(stepIdx, okAfter>=steps.length || (t.due && s.id==="s7")); } else sfx.no();
    fxLog(v==="ok"?"OK":"FAIL", "NODE://"+t.id.toUpperCase()+" · STEP "+(stepIdx+1)+(v==="ok"?" PASSED":" · В ЖУРНАЛ"));
    refreshProgress();
    setPracticeSup(t.id);
    if(stay){ const r=document.querySelector('.rung[data-step="'+stepIdx+'"]'); if(r){ r.classList.remove("ok"); r.classList.add("no"); } return; }
    if(stepIdx < steps.length-1) stepIdx++;
    renderPractice(); startTyping("practice");
  }
}



function renderCheat(){
  const t=topics[current], R=DATA.ref, pane=$("pane-cheat");
  const ch=R.cheat[t.id], one=R.one[t.id], fol=R.follow[t.id]||[], cmp=R.compare[t.id]||[], ln=R.links[t.id]||[];
  const errs=store.get("pm.err."+t.id,[]);
  $("tab-cheat").hidden = !(ch||one||fol.length||cmp.length||ln.length||errs.length);
  const qa=(q,a)=>`<button type="button" class="qa" aria-expanded="false"><span class="q">${esc(q)}</span><span class="a" hidden>${esc(a)}</span></button>`;
  const errHTML = errs.length ? `<h5 class="ch-h err-h">ТВОИ ОШИБКИ · ${errs.length}</h5><ul class="errs">${errs.map((e,k)=>`<li><div><span class="eq">${esc(e.q)}</span>${e.note?`<span class="en">${esc(e.note)}</span>`:""}${(b=>b?`<span class="eb${b.done?" off":""}">${backLabel(b)}</span>`:`<span class="eb off">В РАН НЕ ВЕРНЁТСЯ · ОЦЕНКА НЕ «НЕТ»</span>`)(backFor(t.id, e.q))}</div><span class="ed">${fmtDate(e.at)}</span><button type="button" class="ex" data-k="${k}" title="Разобрался — убрать">✓</button></li>`).join("")}</ul>` : "";
  const left = errHTML + (ch?`<h5 class="ch-h">ШПАРГАЛКА</h5><ol class="ch-list">${ch.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>`:"")
    + cmp.map(c=>`<h5 class="ch-h">СРАВНЕНИЕ · ${esc(c.t)}</h5><table class="ch-cmp"><thead><tr><th></th><th>${esc(c.a)}</th><th>${esc(c.b)}</th></tr></thead><tbody>${c.rows.map(r=>`<tr><th>${esc(r[0])}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</tbody></table>`).join("");
  const right = ((one||fol.length)?`<p class="ch-tip">Сначала ответь вслух, потом кликни — проверь себя.</p>`:"")
    + (one?`<h5 class="ch-h">ОДНОЙ СТРОКОЙ</h5>${qa(one.q,one.a)}`:"")
    + (fol.length?`<h5 class="ch-h">СОБЕСЕДУЮЩИЙ СПРОСИТ ДАЛЬШЕ</h5>${fol.map(f=>qa(f[0],f[1])).join("")}`:"")
    + (ln.length?`<h5 class="ch-h">МАТЕРИАЛЫ</h5><ul class="ch-links">${ln.map(l=>`<li><a href="${esc(l[1])}" target="_blank" rel="noopener">${esc(l[0])} <span>↗</span></a></li>`).join("")}</ul>`:"");
  pane.innerHTML = (left||right) ? `<div class="ch"><section class="ch-col">${left}</section><section class="ch-col">${right}</section></div>` : `<p class="empty">Шпаргалки для этой темы пока нет.</p>`;
  pane.querySelectorAll(".qa").forEach(b=>b.addEventListener("click",()=>{ const a=b.querySelector(".a"), open=a.hidden; a.hidden=!open; b.setAttribute("aria-expanded",open); }));
  pane.querySelectorAll(".errs .ex").forEach(b=>b.addEventListener("click",()=>{ const list=store.get("pm.err."+t.id,[]); list.splice(+b.dataset.k,1); store.set("pm.err."+t.id,list); renderCheat(); }));
}
function tasksFor(id){ return DATA.tasks.filter(x=>x.topics.includes(id)); }
function bankFor(id){ return DATA.bank.filter(x=>x.topics.includes(id)); }
function bankStat(id){ return store.get("pm.bank."+id, {ok:0,no:0,last:0}); }
function pickBank(id, exceptId){ const list=bankFor(id); if(!list.length) return -1;
  const score=x=>{ const st=bankStat(x.id); return (st.ok*10) - (st.no*3) + (st.last? (st.last/1e13):0); };
  let best=-1, bs=1e18; list.forEach((x,k)=>{ if(x.id===exceptId && list.length>1) return; const v=score(x); if(v<bs){bs=v;best=k;} }); return best; }
function renderTasks(){
  const t=topics[current], pane=$("pane-tasks"); let list=tasksFor(t.id), note="";
  if(!list.length){
    const ids=new Set(topics.filter(x=>x.b===t.b).map(x=>x.id));
    list=DATA.tasks.filter(x=>x.topics.some(id=>ids.has(id)));
    note = list.length ? `<p class="empty">Эта тема пока не входит в задания напрямую. Задания по ветке ${BRANCHES[t.b].code} · ${BRANCHES[t.b].name}:</p>` : `<p class="empty">Для этой ветки заданий пока нет.</p>`;
  }

  pane.innerHTML = note + list.map((x,k)=>`<article class="task">
      <button type="button" class="task-h" aria-expanded="${k===0}" data-k="${k}"><h4>${esc(x.title)}</h4><span>${esc((x.source?x.source+" · ":"")+x.kind).toUpperCase()}</span></button>
      <div class="task-b" ${k===0?"":"hidden"}>
        ${x.source && DATA.cases[x.source] ? `<p class="case"><span class="lab">ФОРМАТ СОБЕСА</span>${esc(DATA.cases[x.source].format)}<br><span class="lab">ФОКУС</span>${esc(DATA.cases[x.source].focus)}</p>` : ""}
        <p>${esc(x.brief)}</p>
        <ul>${x.requirements.map(r=>`<li>${esc(r)}</li>`).join("")}</ul>
        ${x.edge?`<p><span class="lab">КРАЙНИЕ СЛУЧАИ</span>${esc(x.edge)}</p>`:""}
        ${x.stretch?`<p><span class="lab">ЕСЛИ ОСТАНЕТСЯ ВРЕМЯ</span>${esc(x.stretch)}</p>`:""}
        <div class="chips">${x.topics.map(id=>{ const j=idIndex[id]; return j==null?"":`<button type="button" class="${j===current?"me":""}" data-topic="${j}">${esc(topics[j].title)}</button>`; }).join("")}</div>
      </div></article>`).join("");
  pane.querySelectorAll(".task-h").forEach(b=>b.addEventListener("click",()=>{ const body=b.nextElementSibling; const open=body.hidden; body.hidden=!open; b.setAttribute("aria-expanded",open); }));
  pane.querySelectorAll("[data-topic]").forEach(b=>b.addEventListener("click",()=>openTopic(+b.dataset.topic)));

}
/* ---------- command palette ---------- */
const pal=$("palette"), palIn=$("palInput"), palList=$("palList"); let palSel=0, palItems=[];
function openPal(){ pal.hidden=false; palIn.value=""; renderPal(); palIn.focus(); }
(function(){ const nav=document.querySelector(".nav"), mb=$("navMore"); if(!nav||!mb) return;
  const set=o=>{ nav.classList.toggle("open",o); mb.setAttribute("aria-expanded",o); mb.textContent=o?"×":"≡"; };
  mb.addEventListener("click",()=>set(!nav.classList.contains("open")));
  nav.addEventListener("click",e=>{ if(e.target!==mb && e.target.closest(".navlist button, .branches button, .branches a, .links button")) set(false); });
})();
$("srchBtn").addEventListener("click",()=>openPal());
if(NOGL){ const nb=document.getElementById("noGlBtn"); if(nb) nb.addEventListener("click",()=>openPal()); }
function closePal(){ pal.hidden=true; }
function renderPal(){
  const q=palIn.value.trim().toLowerCase();
  const tp = topics.map((t,i)=>({t,i})).filter(({t})=>!q || (t.title+" "+t.full+" "+t.sub+" "+BRANCHES[t.b].name+" "+t.id).toLowerCase().includes(q)).slice(0, q?6:9);
  const gl = !q ? [] : DATA.ref.glossary.filter(g=>g[0].toLowerCase().includes(q)).concat(DATA.ref.glossary.filter(g=>!g[0].toLowerCase().includes(q) && g[1].toLowerCase().includes(q))).slice(0,5)
    .map(g=>({g, i: idIndex[g[2]] ?? -1}));
  palItems = gl.concat(tp);
  palSel=Math.min(palSel, Math.max(0,palItems.length-1));
  palList.innerHTML = palItems.length ? palItems.map(({t,i,g},k)=> g ? `<li><button type="button" data-i="${i}" data-tab="cheat" class="gl ${k===palSel?"on":""}"><span class="pc">ABC</span><span class="pt">${esc(g[0])}<small>${esc(g[1])}</small></span><span class="ps">${i>=0?"→ "+esc(topics[i].title):""}</span></button></li>` : `<li><button type="button" data-i="${i}" class="${k===palSel?"on":""}"><span class="pc">${BRANCHES[t.b].code}</span><span class="pt">${esc(t.title)}</span><span class="ps ${t.cur||t.due?"cy":""}">${statusLabel(t)}</span></button></li>`).join("") : `<li class="pal-empty">ничего не найдено</li>`;
  palList.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ if(+b.dataset.i<0) return; closePal(); openTopic(+b.dataset.i, b.dataset.tab); }));
}
palIn.addEventListener("input",()=>{ palSel=0; renderPal(); });
palIn.addEventListener("keydown",e=>{
  if(e.key==="ArrowDown"){ e.preventDefault(); palSel=Math.min(palItems.length-1,palSel+1); renderPal(); }
  else if(e.key==="ArrowUp"){ e.preventDefault(); palSel=Math.max(0,palSel-1); renderPal(); }
  else if(e.key==="Enter"){ e.preventDefault(); const it=palItems[palSel]; if(it && it.i>=0){ closePal(); openTopic(it.i, it.g?"cheat":undefined); } }
  else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); closePal(); }
});
pal.addEventListener("click",e=>{ if(e.target===pal) closePal(); });
document.addEventListener("keydown",e=>{
  if((e.ctrlKey||e.metaKey) && (e.key==="k"||e.key==="K"||e.key==="л"||e.key==="Л")){ e.preventDefault(); pal.hidden?openPal():closePal(); }
  else if(e.key==="/" && pal.hidden && !(e.target.closest && e.target.closest("textarea,input"))){ e.preventDefault(); openPal(); }
});

/* ---------- RUN · 5 minutes ---------- */
let runCards=[], runIdx=0, runRes=[];
function pickQ(id){ const R=DATA.ref, f=R.follow[id]||[], one=R.one[id]; const pool=[]; if(one) pool.push([one.q,one.a]); f.forEach(x=>pool.push(x));
  const c=DATA.content[id]; if(!pool.length && c){ const s7=c.steps.find(s=>s.id==="s5"); if(s7) pool.push([s7.code||s7.prompt, s7.key]); }
  return pool.length ? pool[(Math.random()*pool.length)|0] : null; }
function buildRun(){
  const cards=[], used=new Set();
  backDueList().slice(0,3).forEach(([key,e])=>{ const i=idIndex[e.t], it={k:e.k, t:e.t, ref:e.ref, q:e.q, a:e.a}; if(i==null || !itemView(it)) return; cards.push({kind:"back", i, it, bkey:key, ok:e.ok||0}); });
  dueList().slice(0,2).forEach(i=>{ const q=pickQ(topics[i].id); if(q){ cards.push({kind:"review", i, q:q[0], a:q[1]}); used.add(i); } });
  const pool=topics.map((t,i)=>i).filter(i=>!used.has(i) && (topics[i].status==="done"||topics[i].status==="prog") && pickQ(topics[i].id));
  while(cards.length<2 && pool.length){ const i=pool.splice((Math.random()*pool.length)|0,1)[0]; const q=pickQ(topics[i].id); cards.push({kind:"recall", i, q:q[0], a:q[1]}); used.add(i); }
  if(cards.length<2){ const br=topics.map((t,i)=>i).filter(i=>topics[i].b===topics[curIdx].b && !used.has(i) && DATA.ref.one[topics[i].id]);
    while(cards.length<2 && br.length){ const i=br.shift(); const o=DATA.ref.one[topics[i].id]; cards.push({kind:"warm", i, q:o.q, a:o.a}); used.add(i); } }
  const c=DATA.content[topics[curIdx].id];
  if(c){ const p=progressOf(topics[curIdx].id); const k=c.steps.findIndex(s=>p[s.id]!=="ok");
    if(k>=0) cards.push({kind:"step", i:curIdx, k, s:c.steps[k]});
    else { const done=topics.map((t,i)=>i).filter(i=>topics[i].status==="done" && bankFor(topics[i].id).length); if(done.length){ const i=done[(Math.random()*done.length)|0]; const b=pickBank(topics[i].id); cards.push({kind:"step", i, k:-1, bank:b, s:bankFor(topics[i].id)[b]}); } } }
  return cards;
}
/* one recall card from a stored item (error return in the run, mixed training): question → answer → ПОМНЮ / НЕ ВСПОМНИЛ */
function itemView(it){
  const c=DATA.content[it.t]||{};
  if(it.k==="s"){ const k=(c.steps||[]).findIndex(x=>x.id===it.ref), s=k>=0 && c.steps[k]; if(!s) return null;
    return {label:"СТУПЕНЬ "+(k+1), h:esc(short(s.title)), p:s.prompt, code:s.code, oral:s.id==="s5", key:s.key, points:s.points, eq:stepEq(s)}; }
  if(it.k==="b"){ const s=DATA.bank.find(x=>x.id===it.ref); if(!s) return null;
    return {label:"ЗАДАЧА БАНКА · "+String(s.type||"").toUpperCase(), h:esc(s.title), p:s.prompt, code:s.code, oral:s.type==="Устно", key:s.key, points:s.points, eq:bankEq(s)}; }
  if(it.k==="o"){ const L=c.lesson||{}, q=outQs(it.t)[it.ref], a=L.answers && L.answers[it.ref]; if(!q) return null;
    return {label:"ПРОВЕРЬ СЕБЯ", h:q, ans:a?`<div class="out-a">${a}</div>`:"", eq:outEq(q)}; }
  if(it.k==="q") return it.q ? {label:"ВОПРОС ИЗ РАНА", h:esc(it.q), ans:`<div class="run-a">${esc(it.a||"")}</div>`, eq:it.q} : null;
  return null;
}
function itemAnswer(v){
  if(v.ans!=null) return v.ans || `<div class="run-a">Эталонного ответа нет — сверься со шпаргалкой темы.</div>`;
  const pts = v.points && v.points.length ? `<div class="kpoints"><div class="kp-h">СВЕРЬ ПО ПУНКТАМ · ВСЕ ОБЯЗАТЕЛЬНЫ</div><ol>${v.points.map(p=>`<li>${p}</li>`).join("")}</ol></div>` : "";
  return pts + (v.key ? terminal(v.key, "Ключ", "сверь со своим ответом", {plain:true, key:true}) : "");
}
/* mixed training: 5–10 cards from topics in progress or done (steps, bank, «Проверь себя», open errors), topics interleaved round-robin,
   topics due in SRS go first and add a card each; the topic name stays hidden until the answer. No streak, no SRS move. */
const MIX_MIN=5, MIX_MAX=10;
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
function mixPool(){
  const by=new Map(), add=(id,it)=>{ if(!by.has(id)) by.set(id,[]); by.get(id).push(it); };
  topics.forEach(t=>{ const id=t.id, c=DATA.content[id]; if(!c || (t.status!=="done" && t.status!=="prog")) return;
    const p=progressOf(id), done=t.status==="done", L=c.lesson||{};
    (c.steps||[]).forEach(s=>{ if(done || p[s.id]) add(id, {k:"s", t:id, ref:s.id}); });
    bankFor(id).forEach(b=>{ if(done || bankStat(b.id).last) add(id, {k:"b", t:id, ref:b.id}); });
    if(done || outOf(id)) outQs(id).forEach((q,k)=>{ if(L.answers && L.answers[k]) add(id, {k:"o", t:id, ref:k}); }); });
  const errs=new Map();
  Object.entries(backAll()).forEach(([key,e])=>{ if(e.done || idIndex[e.t]==null || !DATA.content[e.t]) return; if(!errs.has(e.t)) errs.set(e.t,[]); errs.get(e.t).push({k:e.k, t:e.t, ref:e.ref, q:e.q, a:e.a, bkey:key}); });
  return {by, errs};
}
function buildMix(){
  const {by, errs}=mixPool(), ids=[...new Set([...by.keys(), ...errs.keys()])], q=new Map();
  ids.forEach(id=>{ const e=shuffle(errs.get(id)||[]), seen=new Set(e.map(x=>x.k+":"+x.ref)); q.set(id, e.concat(shuffle((by.get(id)||[]).filter(x=>!seen.has(x.k+":"+x.ref))))); });
  const due=ids.filter(id=>topics[idIndex[id]].due).sort((a,b)=>((srsOf(a)||{}).due||0)-((srsOf(b)||{}).due||0));
  const order=due.concat(shuffle(ids.filter(id=>!due.includes(id)))), n=Math.min(MIX_MAX, MIX_MIN+due.length), cards=[], usedB=new Set();
  while(cards.length<n){ let added=false;
    for(const id of order){ if(cards.length>=n) break; const list=q.get(id);
      while(list.length){ const it=list.shift(); if(it.k==="b"){ if(usedB.has(it.ref)) continue; usedB.add(it.ref); } if(!itemView(it)) continue;
        cards.push({kind:"mix", i:idIndex[id], it, bkey:it.bkey}); added=true; break; } }
    if(!added) break; }
  return new Set(cards.map(c=>c.i)).size>=2 ? cards : [];
}
function renderItemCard(c){
  const body=$("runBody"), t=topics[c.i], v=itemView(c.it), mix=c.kind==="mix";
  const topicLine=`${BRANCHES[t.b].code} · ${esc(t.title)}`;
  const kind = mix ? v.label+(c.bkey?" · ТВОЯ ОШИБКА":"") : "ОШИБКА ВОЗВРАЩАЕТСЯ · "+(c.ok?"ДЕНЬ "+BACK_DAYS[1]:"ДЕНЬ "+BACK_DAYS[0])+" · "+v.label;
  body.innerHTML=`<div class="run-kind">${kind}</div><div class="run-topic" id="runTopic">${mix?"ТЕМА СКРЫТА ДО ОТВЕТА":topicLine}</div>
    <h3 class="run-q">${v.h}</h3>${v.p?`<div class="run-a" style="border-color:var(--line-2)">${esc(v.p)}</div>`:""}
    ${v.code?terminal(v.code, "Задача", "", {plain:v.oral||proseCode(v.code)}):""}
    <p class="run-tip" id="runTip">Ответь вслух или про себя. Потом открой ответ.</p>
    <div class="run-acts" id="runActs"><button type="button" class="cta" id="runShow">ПОКАЗАТЬ ОТВЕТ</button></div>`;
  $("runShow").addEventListener("click",()=>{
    $("runTip").outerHTML=`<div class="run-ans">${itemAnswer(v)}</div>`; $("runTopic").innerHTML=topicLine;
    $("runActs").innerHTML=`<button type="button" class="cta" id="runYes">ПОМНЮ</button><button type="button" class="ghostbtn" id="runNo">НЕ ВСПОМНИЛ</button>`;
    $("runYes").addEventListener("click",()=>{ sfx.ok(); backPass(c.bkey || backKey(c.it.k, c.it.t, c.it.ref)); runRes.push(true); flash[c.i]=1.6; burst(c.i,10); refreshProgress(); runIdx++; renderRun(); });
    $("runNo").addEventListener("click",()=>{ sfx.no(); backFail(c.it.k, c.it.t, c.it.ref, v.eq, c.it.q, c.it.a);
      if(mix) logErr(t.id, v.eq, "Тренировка: не вспомнил — вернётся в ран завтра."); runRes.push(false); refreshProgress(); runIdx++; renderRun(); });
  });
}
const RUN_KIND={review:"ПОВТОР · ТЕМА ПРОСИТ ВСПОМНИТЬ", recall:"ВСПОМНИ ИЗ ПРОЙДЕННОГО", warm:"РАЗМИНКА · УГАДАЙ ДО ТЕОРИИ", step:"СЛЕДУЮЩАЯ СТУПЕНЬ"};
let pendingRun=null;
let runMode="run";
function setRunMode(m){ runMode=m; $("runTitle").innerHTML = m==="mix" ? "<i></i>MIX.EXE · ТРЕНИРОВКА" : "<i></i>RUN.EXE · 5 МИН"; $("run").setAttribute("aria-label", m==="mix" ? "Смешанная тренировка" : "Ран 5 минут"); }
function openRun(){ setRunMode("run"); runCards=buildRun(); runIdx=0; runRes=[]; $("run").hidden=false; hideTip(); renderRun(); }
function openMix(){ setRunMode("mix"); runCards=buildMix(); runIdx=0; runRes=[]; $("run").hidden=false; hideTip(); renderRun(); }
function closeRun(){ $("run").hidden=true; stopTyping(); }
function finishRunDay(){ fxLog("RUN","СЕРИЯ ОБНОВЛЕНА"); const days=runDays(), k=dayKey(); if(!days.includes(k)){ days.push(k); store.set("pm.runs", days.slice(-120)); } refreshRun(); }
function renderRun(){
  const body=$("runBody"), n=runCards.length; $("runBar").style.width=(n?Math.min(runIdx,n)/n*100:0)+"%";
  if(runMode==="mix" && !n){ $("runStep").textContent="";
    body.innerHTML=`<div class="run-kind">ТРЕНИРОВКЕ НУЖНО ХОТЯ БЫ ДВЕ ТЕМЫ</div><p class="run-tip">Смешанная тренировка берёт вопросы из тем, где ты уже отвечал: ступени, банк, «Проверь себя», твои ошибки. Начни вторую тему — и вопросы начнут перемешиваться.</p>
      <div class="run-acts"><button type="button" class="ghostbtn" id="runDone">НА КАРТУ</button></div>`;
    $("runDone").addEventListener("click",closeRun); return; }
  if(runMode==="mix" && runIdx>=n){ $("runStep").textContent="ГОТОВО"; const ok=runRes.filter(x=>x).length, tn=new Set(runCards.map(c=>c.i)).size;
    body.innerHTML=`<div class="run-kind">ТРЕНИРОВКА ЗАВЕРШЕНА</div><div class="run-big">ВСПОМНИЛ ${ok} / ${runRes.length}</div>
      <div class="run-stats"><span>ТЕМ ВПЕРЕМЕШКУ <b>${tn}</b></span>${runRes.length-ok?`<span>НЕ ВСПОМНИЛ <b>${runRes.length-ok}</b> · ВЕРНУТСЯ В РАН ЗАВТРА</span>`:""}</div>
      <div class="run-acts"><button type="button" class="cta" id="runMore">ЕЩЁ ТРЕНИРОВКА</button><button type="button" class="ghostbtn" id="runDone">НА КАРТУ</button></div>`;
    $("runMore").addEventListener("click",openMix); $("runDone").addEventListener("click",closeRun); return; }
  if(runIdx>=n){ const counted=runRes.length>0; if(counted) finishRunDay(); $("runStep").textContent="ГОТОВО";
    const ok=runRes.filter(x=>x).length, nx=topics.filter(t=>t.status==="done").map(t=>srsOf(t.id)).filter(Boolean).sort((a,b)=>a.due-b.due)[0];
    body.innerHTML=`<div class="run-kind">${counted?"РАН ЗАВЕРШЁН":"РАН БЕЗ ОТВЕТОВ · ДЕНЬ НЕ ЗАСЧИТАН"}</div><div class="run-big">СЕРИЯ ${streak()} ${streak()===1?"ДЕНЬ":streak()<5?"ДНЯ":"ДНЕЙ"}</div>
      <div class="run-stats"><span>ВСПОМНИЛ <b>${ok}</b> / ${runRes.length}</span>${nx?`<span>СЛЕДУЮЩИЙ ПОВТОР <b>${whenLabel(nx.due)}</b></span>`:""}</div>
      <div class="run-acts"><button type="button" class="cta" id="runMore">ЕЩЁ ОДИН РАН</button><button type="button" class="ghostbtn" id="runDone">НА КАРТУ</button></div>`;
    $("runMore").addEventListener("click",openRun); $("runDone").addEventListener("click",closeRun); return; }
  const c=runCards[runIdx], t=topics[c.i]; $("runStep").textContent=(runIdx+1)+" / "+n;
  if(c.it){ renderItemCard(c); return; }
  if(c.kind==="step" && c.k<0) RUN_KIND.step="ЗАДАЧА ИЗ БАНКА · ТЕМА УЖЕ ОСВОЕНА"; else RUN_KIND.step="СЛЕДУЮЩАЯ СТУПЕНЬ";
  if(c.kind==="step"){
    body.innerHTML=`<div class="run-kind">${RUN_KIND.step}</div><div class="run-topic">${BRANCHES[t.b].code} · ${esc(t.title)}</div>
      <h3 class="run-q">${esc(c.k<0?c.s.title:short(c.s.title))}</h3><div class="run-a" style="border-color:var(--line-2)">${esc(c.s.prompt)}</div>
      ${c.s.code?terminal(c.s.code,c.k<0?"Задача из банка":"Задача "+(c.k+1)+" из 7",c.k<0?c.s.type:"",{plain:c.s.id==="s5"||c.s.type==="Устно"}):""}
      <div class="run-acts"><button type="button" class="cta" id="runGo">РЕШИТЬ В ПРАКТИКЕ ▸</button><button type="button" class="ghostbtn" id="runSkip">ЗАВЕРШИТЬ РАН</button></div>`;
    $("runGo").addEventListener("click",()=>{ pendingRun=dayKey(); closeRun(); openTopic(c.i,"practice"); setTimeout(()=>{ if(current===c.i){ if(c.k<0){ bankIdx=c.bank; } else { stepIdx=c.k; bankIdx=-1; } renderPractice(); startTyping("practice"); } },900); });
    $("runSkip").addEventListener("click",()=>{ runIdx++; renderRun(); });
    return; }
  body.innerHTML=`<div class="run-kind">${RUN_KIND[c.kind]}</div><div class="run-topic">${BRANCHES[t.b].code} · ${esc(t.title)}</div>
    <h3 class="run-q">${esc(c.q)}</h3>
    <p class="run-tip" id="runTip">Ответь вслух или про себя. Потом открой ответ.</p>
    <div class="run-acts" id="runActs"><button type="button" class="cta" id="runShow">ПОКАЗАТЬ ОТВЕТ</button></div>`;
  typeSeq([{el:body.querySelector(".run-q"),cps:90}]);
  $("runShow").addEventListener("click",()=>{ stopTyping();
    $("runTip").outerHTML=`<div class="run-a">${esc(c.a)}</div>`;
    $("runActs").innerHTML=`<button type="button" class="cta" id="runYes">ПОМНЮ</button><button type="button" class="ghostbtn" id="runNo">НЕ ВСПОМНИЛ</button>`;
    $("runYes").addEventListener("click",()=>{ sfx.ok(); if(c.kind==="review" && honestDone(t.id)) srsPass(t.id); else if(c.kind==="review" && rootOf(t.id).v==="no") store.set("pm.roots."+t.id, {at:Date.now(), v:"ok"}); backPass(backKey("q", t.id, strHash(c.q))); runRes.push(true); flash[c.i]=1.6; burst(c.i,10); refreshProgress(); runIdx++; renderRun(); });
    $("runNo").addEventListener("click",()=>{ sfx.no(); if(t.status==="done" || (c.kind==="review" && store.get("pm.srs."+t.id,null))) srsFail(t.id); if(c.kind!=="warm"){ logErr(t.id, c.q, "Ран: не вспомнил. Ответ: "+c.a); backFail("q", t.id, strHash(c.q), c.q, c.q, c.a); } runRes.push(false); refreshProgress(); runIdx++; renderRun(); });
  });
}
$("runBtn").addEventListener("click",openRun);
$("mixBtn").addEventListener("click",openMix);
$("runClose").addEventListener("click",closeRun);
$("run").addEventListener("click",e=>{ if(e.target.id==="run") closeRun(); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && !$("run").hidden){ e.stopImmediatePropagation(); closeRun(); } }, true);
refreshRun(); refreshBackupNote();

/* ---------- living background behind topic windows: fast data lanes with encrypted code ---------- */
(function topicBackground(){
  if(PHONE) return; /* phone: no animated canvas behind the topic */
  const cv=$("topicBg"), cx=cv.getContext("2d"), host=$("topic");
  const GLY="0123456789ABCDEF{}[]<>/=*+;:$#%&@";
  const FALLBACK=["let value: String? = nil","guard let id else { return }","func load() async throws -> [Item]","DispatchQueue.main.async { [weak self] in","enum State { case idle, loading, failed(Error) }","struct User: Codable, Identifiable","for item in items where item.isActive {","@MainActor final class ViewModel: ObservableObject"];
  const FONT_PX=11, LINE=17, R=170;
  let w=0,h=0,dpr=Math.min(2,window.devicePixelRatio||1), lanes=[], pool=[], poolFor=-2, charW=7.3, last=performance.now(), scrT=0;
  let overBg=false, bx=-1, by=-1, logs=[], logNext=2.5, wave=null, mastered=false, calm=0, inWin=false;
  function codePool(){
    const out=[]; const c = current>=0 ? DATA.content[topics[current].id] : null;
    if(c){ (c.lesson ? c.lesson.base.concat(c.lesson.deeper) : []).forEach(sec=>sec.body.forEach(n=>{ if(n.t==="code") out.push(...n.code.split("\n")); }));
      (c.steps||[]).forEach(st=>{ if(st.code) out.push(...st.code.split("\n")); if(st.key) out.push(...st.key.split("\n").filter(l=>/[{}()=;]|func |let |var /.test(l))); }); }
    const clean = out.map(l=>l.replace(/\t/g,"    ").trim()).filter(l=>l.length>=8 && l.length<=72 && !/[а-яё]{4,}/i.test(l.replace(/\/\/.*$/,"").replace(/"[^"]*"/g,"")));
    return clean.length>=6 ? clean : FALLBACK;
  }
  function scr(t){ let o=""; for(const ch of t) o += ch===" " ? " " : GLY[(Math.random()*GLY.length)|0]; return o; }
  function bits(n){ let o=""; for(let i=0;i<n;i++) o += Math.random()<0.08 ? " " : (Math.random()<0.5?"0":"1"); return o; }
  function makeSeg(x){
    if(Math.random()<0.42){ const t=pool[(Math.random()*pool.length)|0]; return {x, text:t, enc:scr(t), rev:new Float32Array(t.length), bin:false}; }
    const t=bits(14+(Math.random()*46|0)); return {x, text:t, enc:t, rev:null, bin:true};
  }
  function fillLane(L){ let end = L.segs.length ? L.segs[L.segs.length-1].x + L.segs[L.segs.length-1].text.length*charW : -Math.random()*200;
    while(end < w+240){ const sg=makeSeg(end + 24 + Math.random()*90); L.segs.push(sg); end = sg.x + sg.text.length*charW; } }
  function init(){
    const r=host.getBoundingClientRect(); w=Math.max(1,r.width); h=Math.max(1,r.height);
    cv.width=w*dpr; cv.height=h*dpr; cx.setTransform(dpr,0,0,dpr,0,0);
    cx.font=FONT_PX+"px "+getComputedStyle(document.documentElement).getPropertyValue("--f-code"); charW=cx.measureText("M").width||7.3;
    pool=codePool(); poolFor=current;
    lanes=[]; for(let y=LINE*0.8; y<h; y+=LINE){ const L={y, v:(28+Math.random()*95)*(Math.random()<0.5?1:-1), a:0.06+Math.random()*0.08, segs:[]}; fillLane(L); lanes.push(L); }
  }
  let rsT=0; new ResizeObserver(()=>{ clearTimeout(rsT); rsT=setTimeout(()=>{ const r=host.getBoundingClientRect(); if(Math.abs(r.width-w)>2 || Math.abs(r.height-h)>2) init(); },60); }).observe(host);
  host.addEventListener("pointermove",e=>{ overBg = e.target===host; inWin = !overBg && !!(e.target.closest && e.target.closest(".win, .t-head, #topic > *")); const r=host.getBoundingClientRect(); bx=e.clientX-r.left; by=e.clientY-r.top; },{passive:true});
  host.addEventListener("pointerleave",()=>{ overBg=false; inWin=false; });
  host.addEventListener("pointerdown",e=>{ if(e.target!==host) return; const r=host.getBoundingClientRect(); wave={x:e.clientX-r.left, y:e.clientY-r.top, t:0}; sfx.ping(); fxLog("SCAN","ПРИНУДИТЕЛЬНАЯ РАСШИФРОВКА"); });
  function draw(now){
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    if(mode!=="topic"){ requestAnimationFrame(draw); return; }
    if(!w || poolFor!==current) init();
    cx.clearRect(0,0,w,h);
    cx.font=FONT_PX+"px "+getComputedStyle(document.documentElement).getPropertyValue("--f-code"); cx.textBaseline="middle";
    calm += ((inWin?1:0) - calm) * Math.min(1, dt*3); cv.style.opacity = (1 - calm*0.72).toFixed(3);
    const spd = 1 - calm*0.8;
    const cIn = overBg && !reduce, cxp=bx, cyp=by;
    scrT-=dt; const reroll = scrT<=0; if(reroll) scrT=0.09;
    mastered = current>=0 && topics[current].status==="done";
    if(wave){ wave.t+=dt; if(wave.t>1.6) wave=null; }
    const waveR = wave ? Math.min(1,wave.t/0.9)*Math.hypot(w,h) : 0;
    for(const L of lanes){
      if(!reduce) for(const sg of L.segs) sg.x -= L.v*dt*spd;
      if(L.v>0){ while(L.segs.length && L.segs[0].x + L.segs[0].text.length*charW < -40) L.segs.shift(); fillLane(L); }
      else { while(L.segs.length && L.segs[L.segs.length-1].x > w+260) L.segs.pop(); let first=L.segs.length?L.segs[0].x:w; while(first > -240){ const sg=makeSeg(0); sg.x = first - 24 - Math.random()*90 - sg.text.length*charW; L.segs.unshift(sg); first=sg.x; } }
      const y=L.y, laneNear = (cIn && Math.abs(y-cyp) < R) || !!wave;
      for(const sg of L.segs){
        const x0=sg.x, len=sg.text.length, x1=x0+len*charW; if(x1<0 || x0>w) continue;
        if(sg.bin){
          if(reroll && Math.random()<0.5){ const i=(Math.random()*len)|0; if(sg.text[i]!==" ") sg.text = sg.text.slice(0,i)+(sg.text[i]==="0"?"1":"0")+sg.text.slice(i+1); }
          if(laneNear && cIn && x1>cxp-R && x0<cxp+R){ for(let i=0;i<len;i++){ const x=x0+i*charW, d=Math.hypot(x-cxp,y-cyp), f=d<R?1-d/R:0; cx.fillStyle = f>0 ? `rgba(45,226,230,${L.a+f*0.5})` : `rgba(140,160,170,${L.a})`; cx.fillText(sg.text[i], x, y); } }
          else { cx.fillStyle=`rgba(140,160,170,${L.a*0.85})`; cx.fillText(sg.text, x0, y); }
          continue;
        }
        let active=false; for(let i=0;i<len;i++){ if(sg.rev[i]>0.01){ active=true; break; } }
        const near = laneNear && ((cIn && x1>cxp-R && x0<cxp+R) || wave);
        if(!near && !active){ if(reroll) sg.enc=scr(sg.text);
          if(mastered){ cx.fillStyle=`rgba(190,235,238,${L.a*2.2})`; cx.fillText(sg.text, x0, y); } else { cx.fillStyle=`rgba(150,168,178,${L.a})`; cx.fillText(sg.enc, x0, y); } continue; }
        if(reroll) sg.enc=scr(sg.text);
        for(let i=0;i<len;i++){ const ch=sg.text[i]; if(ch===" "){ sg.rev[i]=0; continue; }
          const x=x0+i*charW, d = cIn ? Math.hypot(x-cxp, y-cyp) : 1e9, inWave = wave && Math.hypot(x-wave.x, y-wave.y) < waveR, tgt = (d<R || inWave) ? 1 : 0;
          sg.rev[i] += (tgt-sg.rev[i]) * Math.min(1, dt*(tgt>sg.rev[i] ? 9 : 1.3));
          const rv=sg.rev[i];
          if(rv<0.03){ if(mastered){ cx.fillStyle=`rgba(190,235,238,${L.a*2.2})`; cx.fillText(ch, x, y); } else { cx.fillStyle=`rgba(150,168,178,${L.a})`; cx.fillText(sg.enc[i], x, y); } continue; }
          const show = rv>0.9 || Math.random()<rv*rv, close = d<R*0.45;
          cx.fillStyle = show ? (close ? `rgba(45,226,230,${0.6+rv*0.4})` : `rgba(226,232,235,${0.3+rv*0.5})`) : `rgba(45,226,230,${0.2+rv*0.3})`;
          cx.fillText(show ? ch : sg.enc[i], x, y); }
      }
    }
    { const th=host.querySelector(".t-head"), hr=host.getBoundingClientRect(); if(th){ const r=th.getBoundingClientRect(), x=r.left-hr.left-24, y=r.top-hr.top-14, ww=(()=>{ const sb=host.querySelector("#tSub"), ti=host.querySelector("#tTitle")||th; const right=Math.max(ti.getBoundingClientRect().right, sb&&sb.textContent ? sb.getBoundingClientRect().right : 0); return Math.min(r.width, right-r.left)+60; })(), hh=r.height+26;
      const hg=cx.createLinearGradient(x,0,x+ww,0); hg.addColorStop(0,"rgba(5,6,7,.82)"); hg.addColorStop(0.8,"rgba(5,6,7,.75)"); hg.addColorStop(1,"rgba(5,6,7,0)"); cx.fillStyle=hg; cx.fillRect(x,y,ww,hh); } }
    if(wave && waveR>0){ cx.strokeStyle=`rgba(45,226,230,${Math.max(0,0.35-wave.t*0.22)})`; cx.lineWidth=1; cx.beginPath(); cx.arc(wave.x,wave.y,waveR,0,Math.PI*2); cx.stroke(); }
    // event log lines
    logNext-=dt;
    if(logNext<=0 && logs.length<3){ const ev = fxQueue.length ? fxQueue.shift() : null;   /* only real events (fxLog), no ambient filler */
      if(ev){ const full="["+ev.tag+"] "+ev.text, tw=full.length*charW; logs.push({tag:"["+ev.tag+"]", full, x:Math.max(12, w-tw-24), y:120+Math.random()*(h-200), t:0, life:7.5}); }
      logNext = fxQueue.length ? 0.8 : 0.3; }
    logs=logs.filter(Lg=>{ Lg.t+=dt; if(Lg.t>Lg.life) return false; const n=Math.min(Lg.full.length, Math.floor(Lg.t*38)), fade=Math.min(1,(Lg.life-Lg.t)/1.4);
      const tw=Lg.full.length*charW; cx.fillStyle=`rgba(5,7,8,${0.85*fade})`; cx.fillRect(Lg.x-8, Lg.y-10, tw+22, 20);
      const shown=Lg.full.slice(0,n), tagLen=Math.min(n, Lg.tag.length);
      cx.fillStyle=`rgba(45,226,230,${0.9*fade})`; cx.fillText(shown.slice(0,tagLen), Lg.x, Lg.y);
      cx.fillStyle=`rgba(225,232,235,${0.75*fade})`; cx.fillText(shown.slice(tagLen), Lg.x+tagLen*charW, Lg.y);
      if(n<Lg.full.length || Math.sin(now/160)>0){ cx.fillStyle=`rgba(45,226,230,${0.7*fade})`; cx.fillRect(Lg.x+n*charW+2, Lg.y-6, charW*0.7, 12); }
      return true; });
    if(cIn){ const hg=cx.createRadialGradient(cxp,cyp,0,cxp,cyp,R); hg.addColorStop(0,"rgba(45,226,230,.07)"); hg.addColorStop(1,"rgba(45,226,230,0)"); cx.fillStyle=hg; cx.fillRect(cxp-R,cyp-R,R*2,R*2); }
    const g=cx.createRadialGradient(w*0.45,h*0.5,Math.min(w,h)*0.2,w*0.5,h*0.5,Math.max(w,h)*0.75); g.addColorStop(0,"rgba(5,6,7,0)"); g.addColorStop(1,"rgba(5,6,7,.5)"); cx.fillStyle=g; cx.fillRect(0,0,w,h);
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
  const _setMode=setMode; setMode=function(m){ const was=mode; _setMode(m); if(m==="topic" && was!=="topic"){ init(); logs=[]; logNext=1.2; } };
})();

/* ---------- global cursor ---------- */
(function globalCursor(){
  const cur=$("cur"), txt=$("curTxt"); if(PHONE || window.matchMedia("(pointer: coarse)").matches){ document.documentElement.style.setProperty("cursor","auto"); cur.remove(); return; }
  let x=-100,y=-100, px=-100, py=-100, cw=28, ch=28, inside=false, target=null, down=false;
  const SEL="button:not(:disabled), a[href], [role=tab], label[for], summary, .qa, .rung, .blabel, .pal-list button, input[type=range]";
  document.addEventListener("pointermove",e=>{ x=e.clientX; y=e.clientY; inside=true; target=e.target; },{passive:true});
  document.addEventListener("pointerleave",()=>{ inside=false; });
  document.documentElement.addEventListener("mouseleave",()=>{ inside=false; });
  document.addEventListener("pointerdown",e=>{ down=true; const r=document.createElement("div"); r.className="xcur-ring"; r.style.left=e.clientX+"px"; r.style.top=e.clientY+"px"; document.body.appendChild(r); setTimeout(()=>r.remove(),500); });
  document.addEventListener("pointerup",()=>{ down=false; });
  let last=performance.now();
  function loop(now){
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    let tx=x, ty=y, tw=28, th=28, mode="";
    let el = target && target.closest ? target.closest(SEL) : null; if(el && el.closest("#brain.intro, #brain.mini .overlay")) el=null;
    const field = target && target.closest ? target.closest("textarea, input[type=text], input:not([type])") : null;
    if(window.mapLock && !el){ tx=window.mapLock.x; ty=window.mapLock.y; tw=20; th=20; mode="lock"; txt.textContent=""; }
    else if(el && el.isConnected){ const r=el.getBoundingClientRect(); if(r.width<480 && r.height<140){ tx=r.left+r.width/2; ty=r.top+r.height/2; tw=r.width+12; th=r.height+10; } else { tw=36; th=36; } mode="btn"; txt.textContent=""; }
    else if(field){ mode="text"; tw=12; th=24; txt.textContent=""; }
    else { txt.textContent = ""; }
    const k=Math.min(1,dt*(mode==="btn"?18:mode==="lock"?22:30));
    px+=(tx-px)*k; py+=(ty-py)*k; cw+=(tw-cw)*Math.min(1,dt*16); ch+=(th-ch)*Math.min(1,dt*16);
    const sc = down ? 0.82 : 1;
    cur.style.width=cw.toFixed(1)+"px"; cur.style.height=ch.toFixed(1)+"px";
    cur.style.transform=`translate(${(px-cw/2).toFixed(1)}px,${(py-ch/2).toFixed(1)}px) scale(${sc})`;
    cur.className="xcur"+(inside?" on":"")+(mode?" "+mode:"")+(down?" down":"");
    window.curPos={x:px,y:py,inside};
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();

/* merge:begin — pure, no DOM/storage (tests/merge.js runs this block in Node).
   mergeProgress(local, incoming): two maps key -> JSON string of pm.* progress, returns {map, changed}.
   Never loses progress: per step/grade the better mark wins (ok > part > no), SRS keeps the later due date,
   «passed» timestamps are kept from either side, logs and day lists are unions, drafts prefer the local text. */
function mergeProgress(local, incoming){
  const RANK={ok:3, part:2, no:1};
  const P=s=>{ if(s==null) return undefined; try{ return JSON.parse(s); }catch(e){ return undefined; } };
  const isObj=v=>v && typeof v==="object" && !Array.isArray(v);
  const num=v=>typeof v==="number" && isFinite(v) ? v : 0;
  const minTs=(a,b)=>{ a=num(a); b=num(b); return a&&b ? Math.min(a,b) : a||b; };
  const better=(a,b)=>(RANK[b]||0)>(RANK[a]||0) ? b : a;
  const marks=(a,b)=>{ const r={...b, ...a}; Object.keys(b).forEach(k=>{ r[k]=better(a[k], b[k]); }); return r; };
  /* {at, v, pass}: the newer attempt describes the last state, a pass from either device is kept (earliest) */
  const attempt=(a,b)=>{ const n=num(b.at)>num(a.at) ? b : a; return {...n, pass:minTs(a.pass, b.pass)}; };
  const tsMap=(a,b,pick)=>{ const r={...a}; Object.keys(b).forEach(k=>{ r[k] = k in a ? pick(a[k], b[k]) : b[k]; }); return r; };
  function one(key, a, b){
    if(/^pm\.(steps|grade)\./.test(key)) return isObj(a)&&isObj(b) ? marks(a,b) : a;
    if(/^pm\.srs\./.test(key)) return isObj(a)&&isObj(b) ? (num(b.due)>num(a.due) ? b : a) : a;
    if(/^pm\.(recall|out)\./.test(key)) return isObj(a)&&isObj(b) ? attempt(a,b) : a;
    if(/^pm\.roots\./.test(key)) return isObj(a)&&isObj(b) ? (num(b.at)>num(a.at) ? b : a) : a;   /* «Корни»: the latest recall */
    if(/^pm\.rootsSkip\./.test(key)) return Math.max(num(a), num(b)) || a;
    if(key==="pm.mapHint") return Math.max(num(a), num(b)) || a;   /* map hint shown on N visits: the larger count */
    /* errors that come back (pm.back): union of entries; per entry the latest miss wins, same miss -> more progress */
    if(key==="pm.back") return isObj(a)&&isObj(b) ? tsMap(a,b,(x,y)=>{ if(!isObj(x)||!isObj(y)) return isObj(x)?x:y;
      if(num(y.at)!==num(x.at)) return num(y.at)>num(x.at) ? y : x;
      const g=e=>(e.done?100:0)+num(e.ok); return g(y)>g(x) ? y : x; }) : a;
    if(/^pm\.doneAt\./.test(key)) return minTs(a,b) || a;
    if(/^pm\.bank\./.test(key)) return isObj(a)&&isObj(b) ? {...a, ok:Math.max(num(a.ok),num(b.ok)), no:Math.max(num(a.no),num(b.no)), last:Math.max(num(a.last),num(b.last))} : a;
    if(/^pm\.err\./.test(key)){ if(!Array.isArray(a)||!Array.isArray(b)) return a; const seen=new Set(), r=[];
      a.concat(b).forEach(x=>{ const k=x && (num(x.at)+"|"+x.q); if(!x || seen.has(k)) return; seen.add(k); r.push(x); });
      return r.sort((x,y)=>num(y.at)-num(x.at)).slice(0,20); }
    if(key==="pm.known" || key==="pm.legacy") return isObj(a)&&isObj(b) ? tsMap(a,b,minTs) : a;
    if(key==="pm.skip") return isObj(a)&&isObj(b) ? tsMap(a,b,(x,y)=>Math.max(num(x),num(y))) : a;
    if(key==="pm.imported") return isObj(a)&&isObj(b) ? tsMap(a,b,(x,y)=>x==="done"||y==="done" ? "done" : x||y) : a;
    if(key==="pm.runs") return Array.isArray(a)&&Array.isArray(b) ? [...new Set(a.concat(b))].sort().slice(-120) : a;
    if(key==="pm.honest") return isObj(a)&&isObj(b) ? (num(b.at)&&num(b.at)<num(a.at) ? b : a) : a;
    if(/^pm\.outAns\./.test(key)){ if(!Array.isArray(a)||!Array.isArray(b)) return a; const r=a.slice(); b.forEach((x,i)=>{ if(!(r[i]&&String(r[i]).trim())) r[i]=x; }); return r; }
    if(typeof a==="string") return a.trim() ? a : b;   /* answer drafts: pm.ans.*, pm.rans.*, pm.bankAns.* */
    return a;
  }
  /* key order does not matter: {s1,s2} and {s2,s1} are the same progress */
  const canon=v=>JSON.stringify(v, (k,x)=>isObj(x) ? Object.keys(x).sort().reduce((o,kk)=>(o[kk]=x[kk], o), {}) : x);
  const map={...local};
  Object.keys(incoming||{}).forEach(key=>{
    const bs=incoming[key], b=P(bs); if(b===undefined) return;
    if(!(key in local)){ map[key]=bs; return; }
    const a=P(local[key]); if(a===undefined){ map[key]=bs; return; }
    const r=one(key, a, b);
    if(canon(r)!==canon(a)) map[key]=JSON.stringify(r);
  });
  /* «Уже знаю» confirmed after the topic was put aside: it is no longer skipped */
  const kn=P(map["pm.known"]), sk=P(map["pm.skip"]);
  if(isObj(kn) && isObj(sk)){ let d=0; Object.keys(sk).forEach(id=>{ if(num(kn[id])>=num(sk[id])){ delete sk[id]; d++; } }); if(d){ map["pm.skip"]=JSON.stringify(sk); } }
  const changed=Object.keys(map).filter(k=>map[k]!==local[k]).length;
  return {map, changed};
}
/* merge:end */

/* ---------- import from the old board ---------- */
function collectProgress(){ const data={}; try{ for(let k=0;k<localStorage.length;k++){ const key=localStorage.key(k); if(key && key.startsWith("pm.") && !DEVICE_KEYS.has(key)) data[key]=localStorage.getItem(key); } }catch(e){} return data; }
async function exportProgress(){
  const now=new Date(), name="synapso-"+now.toISOString().slice(0,10)+".json";
  const json=JSON.stringify({app:"put-k-middle", v:1, at:now.toISOString(), data:collectProgress()}, null, 1);
  let dl=null; try{ dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null; }catch(e){}
  try{
    if(dl) await dl.save({filename:name, data:json});
    else { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([json],{type:"application/json"})); a.download=name; document.body.appendChild(a); a.click(); a.remove(); }
    store.set("pm.lastExport", Date.now()); fxLog("SYNC","ПРОГРЕСС ВЫГРУЖЕН В ФАЙЛ"); refreshBackupNote(); $("importNote").textContent="ПРОГРЕСС СОХРАНЁН В ФАЙЛ";
  }catch(e){ $("importNote").textContent = e && e.code==="declined" ? "ЭКСПОРТ ОТМЕНЁН" : "НЕ ПОЛУЧИЛОСЬ СОХРАНИТЬ ФАЙЛ"; }
}
function refreshBackupNote(){
  const last=store.get("pm.lastExport",0), any=topics.some(t=>t.status!=="none"&&t.status!=="dark");
  const b=$("exportBtn"); b.classList.toggle("warn", any && Date.now()-last>7*DAY);
  if($("sDot")) $("sDot").classList.toggle("on", any && Date.now()-last>7*DAY);
  b.textContent = any && Date.now()-last>7*DAY ? "ЭКСПОРТ ПРОГРЕССА ↓ · ПОРА" : last ? "ЭКСПОРТ ПРОГРЕССА ↓ · "+fmtDate(last) : "ЭКСПОРТ ПРОГРЕССА ↓";
}
$("exportBtn").addEventListener("click",exportProgress);
function sfxLabel(){ $("sfxBtn").textContent = "ЗВУК: " + (sfx.on ? "ВКЛ" : "ВЫКЛ"); $("sfxBtn").classList.toggle("warn", sfx.on); $("vols").classList.toggle("on", sfx.on); if($("inSfx")){ $("inSfx").textContent = "ЗВУК · " + (sfx.on ? "ВКЛ" : "ВЫКЛ"); $("inSfx").classList.toggle("on", sfx.on); } }
$("volAmb").value=sfx.volAmb; $("volFx").value=sfx.volFx;
$("volAmb").addEventListener("input",e=>sfx.setVol("amb",+e.target.value));
$("volFx").addEventListener("input",e=>{ sfx.setVol("fx",+e.target.value); sfx.hover(2,1); });
$("sfxBtn").addEventListener("click",()=>{ sfx.toggle(); sfxLabel(); }); sfxLabel();
$("importBtn").addEventListener("click",()=>$("importFile").click());
/* ---------- safe import: validate -> confirm -> write before delete -> rollback on failure ---------- */
const DEVICE_KEYS=new Set(["pm.font","pm.codefont","pm.sfx","pm.volAmb","pm.volFx","pm.keysnd","pm.split","pm.lastExport","pm.kbd","pm.gist","pm.lastSync"]);
let lastSnapshot=null;
function progressKeys(){ const r=[]; try{ for(let k=0;k<localStorage.length;k++){ const key=localStorage.key(k); if(key && key.startsWith("pm.") && !DEVICE_KEYS.has(key)) r.push(key); } }catch(e){} return r; }
function takeSnapshot(){ const o={}; progressKeys().forEach(k=>{ try{ o[k]=localStorage.getItem(k); }catch(e){} }); return o; }
function reloadState(){ IMPORTED=store.get("pm.imported",{}); KNOWN=store.get("pm.known",{}); SKIP=store.get("pm.skip",{}); LEGACY=store.get("pm.legacy",{}); migrateHonest(); outSt=null; rootsSt=null; refreshProgress(); refreshRun(); refreshBackupNote(); }
function restoreSnapshot(snap){ progressKeys().forEach(k=>{ try{ localStorage.removeItem(k); }catch(e){} }); Object.entries(snap).forEach(([k,v])=>{ try{ localStorage.setItem(k,v); }catch(e){} }); reloadState(); }
function topicCount(map){ return Object.keys(map).filter(k=>k.indexOf("pm.steps.")===0 && map[k] && map[k]!=="{}").length; }
function checkImport(obj){
  if(!obj || obj.app!=="put-k-middle" || !obj.data || typeof obj.data!=="object" || Array.isArray(obj.data)) return {err:"ЭТО НЕ ФАЙЛ ПРОГРЕССА SYNAPSO"};
  if(obj.v!=null && (typeof obj.v!=="number" || obj.v>1)) return {err:"ФАЙЛ СДЕЛАН БОЛЕЕ НОВОЙ ВЕРСИЕЙ · ОБНОВИ САЙТ"};
  const map={}; let size=0;
  for(const [k,v] of Object.entries(obj.data)){
    if(k.indexOf("pm.")!==0 || DEVICE_KEYS.has(k)) continue;
    const str = typeof v==="string" ? v : JSON.stringify(v); size+=str.length;
    try{ JSON.parse(str); }catch(e){ return {err:"ФАЙЛ ПОВРЕЖДЁН · КЛЮЧ "+k.slice(0,40)}; }
    map[k]=str; }
  if(!Object.keys(map).length) return {err:"В ФАЙЛЕ НЕТ ПРОГРЕССА"};
  if(size>5000000) return {err:"ФАЙЛ СЛИШКОМ БОЛЬШОЙ"};
  return {map, topics:topicCount(map), at:String(obj.at||"").slice(0,10)};
}
/* merge (02.11): the file / gist and this device are combined, nothing is removed; ОТКАТИТЬ restores the snapshot */
function applyMerge(incoming, what){
  const note=$("importNote"), snap=takeSnapshot();
  const r=mergeProgress(snap, incoming);
  if(!r.changed){ note.textContent=what+" · НОВОГО НЕТ, ВСЁ УЖЕ ЕСТЬ НА ЭТОМ УСТРОЙСТВЕ"; return r; }
  lastSnapshot=snap;
  try{ localStorage.setItem("bk.last", JSON.stringify({at:Date.now(), data:snap})); }catch(e){}
  try{ Object.entries(r.map).forEach(([k,v])=>{ if(snap[k]!==v) localStorage.setItem(k,v); }); }
  catch(err){ restoreSnapshot(snap); note.textContent=what+" НЕ УДАЛСЯ · ВСЁ ВОЗВРАЩЕНО КАК БЫЛО"; r.failed=true; return r; }
  const before=new Set(topics.filter(t=>t.status==="done").map(t=>t.id));
  reloadState();
  topics.forEach((t,i)=>{ if(t.status==="done" && !before.has(t.id)) flash[i]=1.6; });
  note.innerHTML = what+' · ОБЪЕДИНЕНО, ОБНОВЛЕНО ЗАПИСЕЙ: '+r.changed+' <button type="button" class="fontbtn" id="impUndo">ОТКАТИТЬ</button>';
  $("impUndo").addEventListener("click",()=>{ if(lastSnapshot){ restoreSnapshot(lastSnapshot); lastSnapshot=null; note.textContent="ВОЗВРАЩЕНО КАК БЫЛО ДО ОБЪЕДИНЕНИЯ"; } });
  return r;
}
$("importFile").addEventListener("change",async e=>{
  const f=e.target.files[0]; if(!f) return; const note=$("importNote");
  try{
    const obj=JSON.parse(await f.text());
    if(obj && obj.app==="put-k-middle"){
      const r=checkImport(obj); if(r.err){ note.textContent=r.err; e.target.value=""; return; }
      const now=topicCount(takeSnapshot());
      note.innerHTML = '<div>ФАЙЛ ОТ '+(r.at||"?")+': ТЕМ С ОТВЕТАМИ '+r.topics+' · СЕЙЧАС: '+now+'. ПРОГРЕСС БУДЕТ ОБЪЕДИНЁН: ПО КАЖДОЙ СТУПЕНИ БЕРЁТСЯ ЛУЧШЕЕ, ПОВТОРЫ — ПО БОЛЕЕ ПОЗДНЕЙ ДАТЕ.</div><button type="button" class="fontbtn" id="impYes">ОБЪЕДИНИТЬ</button> <button type="button" class="fontbtn" id="impNo">ОТМЕНА</button>';
      $("impYes").addEventListener("click",()=>applyMerge(r.map, "ИМПОРТ")); $("impNo").addEventListener("click",()=>{ note.textContent="ИМПОРТ ОТМЕНЁН · НИЧЕГО НЕ ИЗМЕНЕНО"; });
      e.target.value=""; return;
    }
    const st = obj.topics || (obj.state&&obj.state.topics) || (obj.data&&obj.data.topics) || {};
    const map={}; let d=0, pg=0;
    Object.entries(st).forEach(([id,v])=>{ if(idIndex[id]==null||!v) return; if(v.s===2){ map[id]="done"; d++; } else if(v.s===1 || (v.ans&&Object.keys(v.ans).length)){ map[id]="prog"; pg++; } });
    if(!Object.keys(map).length){ note.textContent="ЭТО НЕ ФАЙЛ ПРОГРЕССА · НИЧЕГО НЕ ИЗМЕНЕНО"; e.target.value=""; return; }
    IMPORTED=map; store.set("pm.imported", map);
    LEGACY=store.get("pm.legacy",{}); Object.keys(map).forEach(id=>{ if(map[id]==="done" && !LEGACY[id]) LEGACY[id]=Date.now(); }); store.set("pm.legacy", LEGACY);   /* old board: grandfathered like other old progress */
    Object.keys(map).forEach(id=>{ if(map[id]==="done" && !store.get("pm.doneAt."+id,0)) store.set("pm.doneAt."+id, Date.now()); });
    refreshProgress(); note.textContent = "ИМПОРТ: "+d+" ОСВОЕНО · "+pg+" В ПРОЦЕССЕ";
    topics.forEach((t,i)=>{ if(map[t.id]) flash[i]=1.6; });
  }catch(err){ note.textContent="НЕ ПОЛУЧИЛОСЬ ПРОЧИТАТЬ ФАЙЛ · НИЧЕГО НЕ ИЗМЕНЕНО"; }
  e.target.value="";
});

/* ---------- sync through a private GitHub gist (02.11) ----------
   pm.gist = {token, id} lives only on this device (DEVICE_KEYS: never exported). A sync = GET the gist -> merge into
   this device -> PATCH the merged progress back. Runs on the button, on start, and when the page is hidden after changes.
   In the claude.ai lab the host may block requests to api.github.com: then the file export/import still works. */
const GIST_FILE="synapso-progress.json", GIST_API="https://api.github.com";
let gistBusy=false;
function gistCfg(){ const c=store.get("pm.gist",null); return c && c.token ? c : null; }
function progressFile(){ return JSON.stringify({app:"put-k-middle", v:1, at:new Date().toISOString(), data:collectProgress()}, null, 1); }
function gistLabel(){ const c=gistCfg(), last=store.get("pm.lastSync",0);
  $("gistBtn").textContent = c ? "СИНХРОНИЗИРОВАТЬ GIST ⇅"+(last?" · "+fmtDate(last):"") : "СИНХРОНИЗАЦИЯ ЧЕРЕЗ GIST ⇅";
  $("gistOff").hidden=!c; if(c) $("gistForm").hidden=true; }
async function gistReq(method, path, body){
  const c=gistCfg(); if(!c) throw {code:"off"};
  let res;
  try{ res=await fetch(GIST_API+path, {method, cache:"no-store", headers:{"Authorization":"Bearer "+c.token, "Accept":"application/vnd.github+json", ...(body?{"Content-Type":"application/json"}:{})}, body: body?JSON.stringify(body):undefined}); }
  catch(e){ throw {code:"net"}; }
  if(res.status===401 || res.status===403) throw {code:"auth"};
  if(res.status===404) throw {code:"404"};
  if(!res.ok) throw {code:"http", status:res.status};
  return res.json();
}
async function gistSync(manual){
  const c=gistCfg(), note=$("importNote"); if(!c || gistBusy) return;
  gistBusy=true; if(manual) note.textContent="GIST · СИНХРОНИЗАЦИЯ…";
  try{
    let id=c.id;
    if(!id){ const list=await gistReq("GET", "/gists?per_page=100"); const g=(list||[]).find(x=>x && x.files && x.files[GIST_FILE]); id=g ? g.id : ""; }
    if(!id){
      const g=await gistReq("POST", "/gists", {description:"Synapso progress", public:false, files:{[GIST_FILE]:{content:progressFile()}}});
      store.set("pm.gist", {...c, id:g.id}); store.set("pm.lastSync", Date.now()); progDirty=false;
      note.textContent="GIST СОЗДАН · ПРОГРЕСС ЭТОГО УСТРОЙСТВА ВЫГРУЖЕН"; return;
    }
    if(id!==c.id) store.set("pm.gist", {...c, id});
    const g=await gistReq("GET", "/gists/"+id), f=g.files && g.files[GIST_FILE];
    let text=f ? f.content : "";
    if(f && f.truncated && f.raw_url){ try{ text=await (await fetch(f.raw_url, {cache:"no-store"})).text(); }catch(e){ throw {code:"net"}; } }
    let obj=null, merged=0; try{ obj=text ? JSON.parse(text) : null; }catch(e){}
    if(obj){ const r=checkImport(obj);
      if(r.err && r.err!=="В ФАЙЛЕ НЕТ ПРОГРЕССА"){ note.textContent="GIST: "+r.err+" · НИЧЕГО НЕ ИЗМЕНЕНО"; return; }
      if(r.map){ const m=applyMerge(r.map, "GIST"); if(m.failed) return; merged=m.changed; } }
    await gistReq("PATCH", "/gists/"+id, {files:{[GIST_FILE]:{content:progressFile()}}});
    store.set("pm.lastSync", Date.now()); progDirty=false;
    if(merged) note.insertAdjacentText("afterbegin", "СИНХРОНИЗИРОВАНО · ");   /* keeps the ОТКАТИТЬ button of applyMerge */
    else note.textContent="GIST · СИНХРОНИЗИРОВАНО "+fmtDate(Date.now())+" · НОВОГО С ДРУГИХ УСТРОЙСТВ НЕТ";
  }catch(e){
    const code=e && e.code;
    if(code==="404"){ store.set("pm.gist", {...c, id:""}); note.textContent="GIST НЕ НАЙДЕН · ПРИ СЛЕДУЮЩЕЙ СИНХРОНИЗАЦИИ СОЗДАМ НОВЫЙ"; }
    else if(code==="auth") note.textContent="GIST: ТОКЕН НЕ ПОДОШЁЛ · НУЖЕН ТОКЕН С ПРАВОМ GISTS (READ/WRITE)";
    else if(code==="net") note.textContent="GIST: НЕТ СВЯЗИ С GITHUB · ЕСЛИ ЭТО ЛАБОРАТОРИЯ, СИНХРОНИЗИРУЙ НА ASHMEYN.GITHUB.IO/SYNAPSO";
    else note.textContent="GIST: ОШИБКА "+((e&&e.status)||"")+" · ПРОГРЕСС НЕ ТРОНУТ";
  }finally{ gistBusy=false; gistLabel(); }
}
$("gistBtn").addEventListener("click",()=>{ if(gistCfg()) gistSync(true); else { $("gistForm").hidden=!$("gistForm").hidden; if(!$("gistForm").hidden) $("gistToken").focus(); } });
$("gistSave").addEventListener("click",()=>{ const t=$("gistToken").value.trim(); if(!t){ $("gistToken").focus(); return; }
  store.set("pm.gist", {token:t, id:""}); $("gistToken").value=""; gistLabel(); gistSync(true); });
$("gistOff").addEventListener("click",()=>{ try{ localStorage.removeItem("pm.gist"); localStorage.removeItem("pm.lastSync"); }catch(e){} gistLabel(); $("importNote").textContent="GIST ОТКЛЮЧЁН · ТОКЕН УДАЛЁН С ЭТОГО УСТРОЙСТВА (САМ GIST ОСТАЛСЯ НА GITHUB)"; });
gistLabel();
if(gistCfg()) setTimeout(()=>gistSync(false), 1500);
document.addEventListener("visibilitychange",()=>{ if(!gistCfg()) return;
  if(document.visibilityState==="hidden" && progDirty) gistSync(false);
  else if(document.visibilityState==="visible" && Date.now()-store.get("pm.lastSync",0)>10*60*1000) gistSync(false); });

$("navMap").addEventListener("click",()=>setMode("map"));
$("navTopic").addEventListener("click",()=>openTopic(current>=0?current:selected,"theory"));
$("navTasks").addEventListener("click",()=>openTopic(current>=0?current:selected,"tasks"));

/* ---------- resize ---------- */
function resize(){ W=Math.max(1,brain.clientWidth); H=Math.max(1,brain.clientHeight); renderer.setSize(W,H,false);
  if(!PHONE && !composer && THREE.EffectComposer && THREE.UnrealBloomPass && THREE.RenderPass){ try{ composer=new THREE.EffectComposer(renderer); composer.addPass(new THREE.RenderPass(scene,camera)); bloomPass=new THREE.UnrealBloomPass(new THREE.Vector2(W,H), 0.95, 0.55, 0.16); composer.addPass(bloomPass); }catch(e){ composer=null; } }
  if(composer){ composer.setSize(W,H); bloomPass.strength = mode==="topic" ? 0.7 : mode==="intro" ? 1.2 : 0.95; } camera.aspect=W/H; camera.fov = (W<600 && mode==="map") ? 52 : 40; camera.updateProjectionMatrix(); uScale.value = Math.max(0.55, Math.min(1, W/700)); }
new ResizeObserver(resize).observe(brain);

/* ---------- loop ---------- */
let last=performance.now(), acc=0, time=0;
const RATE = reduce ? 3 : 16;
let introStart = reduce ? -1 : performance.now(), introDone = reduce;
function easeOut(x){ return 1-Math.pow(1-x,3); }
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; time+=dt;
  if(!introDone){
    const it=Math.min(1,(now-introStart)/2600), e=easeOut(it);
    uAsm.value=e; eMat.opacity=Math.max(0,(it-0.55)/0.45); radius=7.6-(7.6-tRadius)*e; tTheta += 0.35*dt*(1-e);
    if(it>=1){ introDone=true; uAsm.value=1; eMat.opacity=1; }
  }
  if(now>idleUntil && !dragging) tTheta += autoSpin*dt;
  const k=Math.min(1,dt*(diveBoost?6:3)); theta+=(tTheta-theta)*k; phi+=(tPhi-phi)*k; if(introDone) radius+=(tRadius-radius)*k;
  uFog.value.set(radius-0.35, radius+1.45); scene.fog.near=radius-0.2; scene.fog.far=radius+1.9;
  placeCamera();
  const breath = reduce ? 1 : 1 + Math.sin(time*0.7)*0.008; root.scale.setScalar(breath);
  acc += dt*RATE*(introDone?1:0)*(mode==="intro"?3:1);
  { const tc = mode==="intro" ? INTRO_TINT : NO_TINT; eMat.color.lerp(tc, Math.min(1,dt*2.5)); }
  while(acc>=1){ acc-=1; const r=rnd(); let o; if(mode==="intro"){ spawn((rnd()*N)|0,-1,0); continue; }
    if(r<0.22) o = rnd()<0.5 ? selected : (rnd()*T)|0;
    else if(r<0.36) o = hotList[(rnd()*hotList.length)|0];
    else o = T + ((rnd()*F)|0);
    spawn(o,-1,0); }
  for(let q=0;q<MAXP;q++){
    const p=pulses[q]; if(!p.on){ pAlpha[q]=0; continue; }
    p.t += dt/p.dur;
    if(p.t>=1){ p.on=false; flash[p.b]=Math.min(1.6,flash[p.b]+0.9);
      if(sfx.on && mode!=="topic" && p.depth<3){ const pp=project(pos[p.b*3],pos[p.b*3+1],pos[p.b*3+2]); sfx.crackle((pp[0]/W)*2-1); }
      if(p.depth<5 && rnd()<0.62) spawn(p.b,p.a,p.depth+1,p.cyan&&p.depth<2);
      if(p.depth<2 && rnd()<0.18) spawn(p.b,p.a,p.depth+1);
      pAlpha[q]=0; continue; }
    const a=p.a*3, b=p.b*3, t=p.t;
    pPos[q*3]=pos[a]+(pos[b]-pos[a])*t; pPos[q*3+1]=pos[a+1]+(pos[b+1]-pos[a+1])*t; pPos[q*3+2]=pos[a+2]+(pos[b+2]-pos[a+2])*t;
    const c = mode==="intro" ? (q%3===0 ? VIOLET : q%3===1 ? CYAN : [0.55,0.62,1.0]) : (p.cyan?CYAN:WHITE); pCol[q*3]=c[0]; pCol[q*3+1]=c[1]; pCol[q*3+2]=c[2];
    pSize[q]=(p.cyan?6:4.6)*(mode==="intro"?1.35:1); pAlpha[q]=Math.sin(Math.PI*t)*(p.cyan?1:0.75)*alphaMul[p.a];
  }
  pGeo.attributes.position.needsUpdate=true; pGeo.attributes.color.needsUpdate=true; pGeo.attributes.size.needsUpdate=true; pGeo.attributes.alpha.needsUpdate=true;
  const decay=Math.pow(0.12,dt);
  const fxOn = (mode==="map" || mode==="intro") && !reduce && introDone;
  dust.rotation.y += dt*0.012; dust.rotation.x = Math.sin(time*0.05)*0.08;
  { const tx = mIn ? (mX/W-0.5)*-0.35 : 0, ty = mIn ? (mY/H-0.5)*0.25 : 0; dust.position.x += (tx-dust.position.x)*Math.min(1,dt*2); dust.position.y += (ty-dust.position.y)*Math.min(1,dt*2); }
  waveT += dt; waveNext -= dt;
  if(waveNext<=0 && fxOn){ waveNext = 6 + rnd()*3; waveT=0; waveDir=randDir(); sfx.wave(); }
  const front = -1.35 + 2.7*(waveT/2.6), waveOn = waveT<2.6 && fxOn;
  let nearI=-1, nearD=1e9; const doGlow = fxOn && mIn && !dragging;
  if(doGlow){ for(let i=0;i<N;i++){ const x=pos[i*3],y=pos[i*3+1],z=pos[i*3+2]; if(facing(x,y,z)<-0.2){ glowArr[i]=0; continue; } const [sx,sy]=project(x*breath,y*breath,z*breath); const d=Math.hypot(sx-mX,sy-mY); glowArr[i]=d<140?1-d/140:0; if(d<nearD){nearD=d;nearI=i;} } }
  cursorSpawn -= dt; if(doGlow && nearI>=0 && nearD<90 && cursorSpawn<=0){ cursorSpawn=0.32; spawn(nearI,-1,0, nearI<T); }
  for(let i=0;i<N;i++){ flash[i]*=decay; const f=flash[i]; nSize[i]=baseSize[i]*(1+f*0.55)+(i===selected && mode!=="intro"?4:0); nAlpha[i]=Math.min(1.4,(baseAlpha[i]+f*0.7)*alphaMul[i]);
    if(doGlow && glowArr[i]>0){ const g=glowArr[i]*glowArr[i]; nSize[i]+=g*(i<T?4:2.4); nAlpha[i]=Math.min(1.5,nAlpha[i]+g*0.55); }
    if(waveOn){ const dd=pos[i*3]*waveDir[0]+pos[i*3+1]*waveDir[1]+pos[i*3+2]*waveDir[2]-front; if(dd>-0.12&&dd<0.12){ const w=1-Math.abs(dd)/0.12; const strong = i<T && (topics[i].status==="done"||topics[i].status==="prog"); nAlpha[i]=Math.min(1.6,nAlpha[i]+w*(strong?0.9:0.32)); nSize[i]+=w*(strong?3:1.2); } } if(i<T && topics[i].due && Math.sin(time*9+i*1.7)>0.55 && Math.random()<0.6) nAlpha[i]*=0.2; }
  nGeo.attributes.size.needsUpdate=true; nGeo.attributes.alpha.needsUpdate=true;
  hSize.array[0]=40+Math.sin(time*2.2)*8; hAlpha.array[0]= mode==="intro" ? 0 : 0.16+Math.sin(time*2.2)*0.05; hSize.needsUpdate=true; hAlpha.needsUpdate=true;
  if(composer) composer.render(); else renderer.render(scene,camera);
  if(mode==="map"){
    hemiLabels.forEach(hl=>{ const [sx,sy]=project(hl.p[0],hl.p[1],hl.p[2]); const f=facing(hl.p[0],hl.p[1],hl.p[2]); const hw=hl.el.offsetWidth/2+16; hl.el.style.left=Math.min(W-hw,Math.max(hw,sx))+"px"; hl.el.style.top=Math.min(H-60,Math.max(100,sy))+"px"; hl.el.style.opacity=Math.max(0.15,Math.min(0.75,0.45+f*0.4)); });
    labels.forEach((l,q)=>{ const p=labelPos[q]; const [sx,sy]=project(p[0]*breath,p[1]*breath,p[2]*breath); const f=facing(p[0],p[1],p[2]);
      const hw=l.offsetWidth/2+12; l.style.left=Math.min(W-hw,Math.max(hw,sx))+"px"; l.style.top=Math.min(H-70,Math.max(100,sy))+"px";
      l.style.opacity = highlight===q ? 1 : (labBranch>=0 ? 0.08 : Math.max(0.12,Math.min(0.9,0.5+f*0.5))); });
    const sp=[pos[selected*3]*breath,pos[selected*3+1]*breath,pos[selected*3+2]*breath]; const [mx,my]=project(...sp);
    marker.style.left=mx+"px"; marker.style.top=my+"px"; marker.style.opacity = facing(...sp)<-0.35?0.15:1;
    drawRoute(breath);
    { if(hoverNode>=0 && mIn){ const hp=project(pos[hoverNode*3]*breath,pos[hoverNode*3+1]*breath,pos[hoverNode*3+2]*breath); const cr=canvas.getBoundingClientRect(); window.mapLock={x:cr.left+hp[0], y:cr.top+hp[1], id:topics[hoverNode].id}; } else window.mapLock=null; }
    if(cardOn){ const c=$("card"), cw=c.offsetWidth, ch=c.offsetHeight, back=facing(...sp)<-0.35;
      let right = mx+64+cw < W-24; let tx = right ? mx+64 : mx-64-cw; tx=Math.max(16,Math.min(W-cw-16,tx));
      let ty = Math.max(84, Math.min(H-ch-24, my-ch*0.32));
      if(cardSnap){ cardX=tx; cardY=ty; cardSnap=false; } else { cardX+=(tx-cardX)*0.16; cardY+=(ty-cardY)*0.16; }
      c.style.transform=`translate(${cardX.toFixed(1)}px,${cardY.toFixed(1)}px)`; c.style.opacity = back?0.6:1;
      const ex = cardX+cw/2 > mx ? cardX : cardX+cw, ey = Math.max(cardY+18, Math.min(cardY+ch-18, my)), kx = ex + (ex>mx?-18:18);
      $("leadLine").setAttribute("points",`${mx.toFixed(1)},${my.toFixed(1)} ${kx.toFixed(1)},${ey.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`);
      $("leadDot").setAttribute("cx",ex.toFixed(1)); $("leadDot").setAttribute("cy",ey.toFixed(1));
      $("lead").style.opacity = back?0.3:1; }
    layoutTopicLabels(breath);
    nbShown.forEach((j,q)=>{ const el=nbLabels[q]; const p=[pos[j*3]*breath,pos[j*3+1]*breath,pos[j*3+2]*breath]; const [x,y]=project(...p); el.style.left=x+"px"; el.style.top=y+"px"; el.style.opacity = facing(...p)<-0.35?0.25:0.95; });
  }
  requestAnimationFrame(frame);
}
/* boot */
(function bootLog(){
  const el=$("boot"); if(!el) return; el.remove(); return;
  if(reduce){ el.remove(); return; }
  const doneN=topics.filter(t=>t.status==="done").length;
  const lines=["> NODE://DAN","> ПОДКЛЮЧЕНИЕ НЕЙРОНОВ ......... "+N,"> СИНАПСЫ ...................... "+edges.length,"> ВЕТКИ ......................... 8","> ОСВОЕНО ..................... "+doneN+" / "+T,"> ГОТОВО"];
  const pre=$("bootLog"); let li=0;
  const iv=setInterval(()=>{ if(li<lines.length){ pre.textContent += (li?"\n":"")+lines[li]; li++; } else { clearInterval(iv); setTimeout(()=>el.classList.add("off"),300); setTimeout(()=>el.remove(),1200); } }, 380);
  const skip=()=>{ clearInterval(iv); introStart=-1e9; el.classList.add("off"); setTimeout(()=>el.remove(),700); window.removeEventListener("keydown",skip); };
  el.addEventListener("click",skip); window.addEventListener("keydown",skip,{once:true});
})();

/* ---------- intro: side data lanes that slowly fill in over time ---------- */
(function introBackground(){
  if(PHONE) return; /* phone: intro is skipped */
  const cv=$("introBg"), cx=cv.getContext("2d"), host=$("intro");
  const GLY="0123456789ABCDEF{}[]<>/=*+;:$#%&@";
  const FONT_PX=12, LINE=19, R=150;
  let w=0,h=0,dpr=Math.min(2,window.devicePixelRatio||1), lanes=[], pool=[], charW=7.2, last=performance.now(), t0=performance.now(), scrT=0, mx=-999, my=-999;
  (function(){ const out=[]; Object.values(DATA.content).forEach(c=>{ (c.lesson ? c.lesson.base.concat(c.lesson.deeper) : []).forEach(sec=>sec.body.forEach(n=>{ if(n.t==="code") out.push(...n.code.split("\n")); })); });
    pool = out.map(l=>l.trim()).filter(l=>l.length>=10 && l.length<=60 && !/[а-яё]{3,}/i.test(l.replace(/\/\/.*$/,"").replace(/"[^"]*"/g,"")));
    if(pool.length<10) pool=["let value: String? = nil","guard let id else { return }","func load() async throws -> [Item]","@State private var isOn = false"]; })();
  const scr=t=>{ let o=""; for(const ch of t) o += ch===" " ? " " : GLY[(Math.random()*GLY.length)|0]; return o; };
  const bits=n=>{ let o=""; for(let i=0;i<n;i++) o += Math.random()<0.1 ? " " : (Math.random()<0.5?"0":"1"); return o; };
  function seg(x){ if(Math.random()<0.38){ const t=pool[(Math.random()*pool.length)|0]; return {x,text:t,enc:scr(t),rev:new Float32Array(t.length),bin:false}; } const t=bits(10+(Math.random()*40|0)); return {x,text:t,bin:true}; }
  function fill(L){ let end=L.segs.length ? L.segs[L.segs.length-1].x+L.segs[L.segs.length-1].text.length*charW : -Math.random()*300; while(end<w+200){ const sg=seg(end+30+Math.random()*120); L.segs.push(sg); end=sg.x+sg.text.length*charW; } }
  function init(){
    const r=host.getBoundingClientRect(); w=Math.max(1,r.width); h=Math.max(1,r.height);
    cv.width=w*dpr; cv.height=h*dpr; cx.setTransform(dpr,0,0,dpr,0,0);
    cx.font=FONT_PX+"px "+getComputedStyle(document.documentElement).getPropertyValue("--f-code"); charW=cx.measureText("0000000000").width/10||7.2;
    lanes=[]; for(let y=LINE*1.2; y<h-LINE*0.5; y+=LINE){
      // lanes near the top/bottom edges and far from centre appear first; the rest fill in over ~40s
      const edge=Math.min(y,h-y)/(h/2);
      lanes.push({y, v:(14+Math.random()*40)*(Math.random()<0.5?1:-1), a:0.05+Math.random()*0.07, born:3+edge*22+Math.random()*16, segs:[]});
    }
    lanes.forEach(fill);
  }
  window.addEventListener("pointermove",e=>{ if(mode!=="intro") return; const r=host.getBoundingClientRect(); mx=e.clientX-r.left; my=e.clientY-r.top; },{passive:true});
  let rsT=0; window.addEventListener("resize",()=>{ clearTimeout(rsT); rsT=setTimeout(init,120); });
  function draw(now){
    requestAnimationFrame(draw);
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    if(mode!=="intro"){ return; }
    if(!w) init();
    const age=(now-t0)/1000;
    cx.clearRect(0,0,w,h); cx.textBaseline="middle";
    cx.font=FONT_PX+"px "+getComputedStyle(document.documentElement).getPropertyValue("--f-code");
    scrT-=dt; const reroll=scrT<=0; if(reroll) scrT=0.12;
    for(const L of lanes){
      const fade=Math.max(0,Math.min(1,(age-L.born)/6)); if(fade<=0) continue;
      if(!reduce) for(const sg of L.segs) sg.x-=L.v*dt;
      if(L.v>0){ while(L.segs.length && L.segs[0].x+L.segs[0].text.length*charW<-40) L.segs.shift(); fill(L); }
      else { while(L.segs.length && L.segs[L.segs.length-1].x>w+220) L.segs.pop(); let first=L.segs.length?L.segs[0].x:w; while(first>-200){ const sg=seg(0); sg.x=first-30-Math.random()*120-sg.text.length*charW; L.segs.unshift(sg); first=sg.x; } }
      const a=L.a*fade, near=Math.abs(L.y-my)<R;
      for(const sg of L.segs){
        const x0=sg.x, len=sg.text.length, x1=x0+len*charW; if(x1<0||x0>w) continue;
        if(sg.bin){
          if(reroll && Math.random()<0.4){ const i=(Math.random()*len)|0; if(sg.text[i]!==" ") sg.text=sg.text.slice(0,i)+(sg.text[i]==="0"?"1":"0")+sg.text.slice(i+1); }
          cx.fillStyle=`rgba(150,130,220,${a*0.8})`; cx.fillText(sg.text,x0,L.y); continue;
        }
        if(reroll) sg.enc=scr(sg.text);
        const hot = near && x1>mx-R && x0<mx+R;
        let active=false; if(!hot) for(let i=0;i<len;i++){ if(sg.rev[i]>0.02){ active=true; break; } }
        if(!hot && !active){ cx.fillStyle=`rgba(170,150,240,${a})`; cx.fillText(sg.enc,x0,L.y); continue; }
        for(let i=0;i<len;i++){ const ch=sg.text[i]; if(ch===" ") continue; const x=x0+i*charW, d=Math.hypot(x-mx,L.y-my), f=hot && d<R ? 1-d/R : 0;
          sg.rev[i] = Math.max(f, sg.rev[i]-dt*0.9);
          const rv=sg.rev[i];
          if(rv>0.35){ cx.fillStyle=`rgba(${Math.round(170-rv*120)},${Math.round(150+rv*70)},${Math.round(240-rv*10)},${a+rv*0.55})`; cx.fillText(ch,x,L.y); }
          else { cx.fillStyle=`rgba(170,150,240,${a+rv*0.3})`; cx.fillText(sg.enc[i],x,L.y); } }
      }
    }
  }
  requestAnimationFrame(draw);
})();
(function introScreen(){
  if(PHONE){ setMode("map"); return; } /* phone: start directly in the topic list */
  appEl.classList.add("intro-on"); brain.classList.add("intro"); applyNodeStyles(); applyEdgeColors();
  const TAGS=["Маленький шаг тоже меняет то, что ты умеешь.","Сегодня одна ступень — завтра одна тема.","Код из головы, а не из примеров.","Пять минут — тоже тренировка.","Забытое возвращается быстрее, чем выученное с нуля."];
  $("inTag").textContent = TAGS[(Math.random()*TAGS.length)|0];
  const doneN=topics.filter(t=>t.status==="done").length, startedN=topics.filter(t=>t.status==="prog").length, dueN=topics.filter(t=>t.due).length;
  $("inStartTxt").textContent = (doneN||startedN) ? "Продолжить обучение" : "Начать обучение";
  const stat="> НЕЙРОНОВ "+N+" · СИНАПСОВ "+edges.length+" · ОСВОЕНО "+doneN+"/"+T+(dueN?" · ПОВТОРОВ ЖДУТ: "+dueN:"");
  let k=0; const iv=setInterval(()=>{ k+=2; $("inStat").textContent=stat.slice(0,k); if(k>=stat.length) clearInterval(iv); }, 28);
  const lab=document.querySelector(".in-lab"); lab.addEventListener("mouseenter",()=>scramble(lab));
  function syncSfx(){ $("inSfx").textContent = "ЗВУК · " + (sfx.on ? "ВКЛ" : "ВЫКЛ"); $("inSfx").classList.toggle("on", sfx.on); }
  $("inSfx").addEventListener("click",()=>{ sfx.toggle(); syncSfx(); if(typeof sfxLabel==="function") sfxLabel(); }); syncSfx();
  function start(){ if(mode!=="intro") return; sfx.open(); setMode("map"); }
  $("inStart").addEventListener("click", start);
  window.addEventListener("keydown", e=>{ if(mode==="intro" && (e.key==="Enter" || e.key===" ") && !(e.target.closest && e.target.closest("input,textarea"))){ e.preventDefault(); start(); } });
})();
layout(); resize();
select(curIdx,false); focusOn(curIdx); theta=tTheta; phi=tPhi;
requestAnimationFrame(()=>{ brain.classList.remove("noanim"); });
if(!PHONE) requestAnimationFrame(frame); /* phone: the 3D brain is never rendered */
})();
