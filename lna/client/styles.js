// Styles for /lna, inlined into each page under a per-request CSP nonce.
// Same type, colours and button language as the public site.
export default `
@font-face{font-family:"Hexalis Sans";src:url("/assets/fonts/texgyreheros-regular.woff2") format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Hexalis Sans";src:url("/assets/fonts/texgyreheros-bold.woff2") format("woff2");font-weight:700;font-display:swap}
:root{--ink:#1f2433;--dim:#46525e;--mute:#6a7682;--line:#dce6e8;--line-hard:#c3d3d6;--bg:#fff;--bg-2:#f3f9fa;--bg-3:#e6f4f6;
--blue:#4fe4f2;--blue-ink:#00727c;--logo:#03abb4;--ok:#1d7a4a;--ok-bg:#e7f5ec;--warn:#8a5a00;--warn-bg:#fdf3dc;--err:#b42318;--err-bg:#fdecea;
--sans:"Hexalis Sans","Helvetica Neue",Helvetica,Arial,sans-serif;--hex:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:var(--sans);font-size:16px;line-height:1.55;color:var(--ink);background:var(--bg-2);-webkit-font-smoothing:antialiased}
h1,h2,h3,p{margin:0}
h1{font-size:clamp(1.7rem,3vw,2.3rem);line-height:1.08;letter-spacing:-.03em}
h2{font-size:1.25rem;letter-spacing:-.02em}
h3{font-size:1.02rem;letter-spacing:-.01em}
a{color:var(--ink)}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.mark{width:30px;height:33px;flex:none}
.eyebrow{display:inline-flex;align-items:center;gap:9px;font-size:.88rem;font-weight:700;color:var(--blue-ink)}
.eyebrow::before{content:"";width:9px;height:10px;background:var(--blue);clip-path:var(--hex)}
.fine{font-size:.86rem;color:var(--mute)}
.dim{color:var(--dim)}
.mt{margin-top:16px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:46px;padding:0 20px;border:2px solid var(--blue);background:var(--blue);color:var(--ink);font-weight:700;cursor:pointer;text-decoration:none;transition:background .2s,color .2s,border-color .2s}
.btn:hover{background:var(--ink);border-color:var(--ink);color:#fff}
.btn--ghost{background:#fff;border-color:var(--ink)}
.btn--ghost:hover{background:var(--ink);color:#fff}
.btn--quiet{background:transparent;border-color:var(--line-hard);color:var(--ink);font-weight:400}
.btn--quiet:hover{border-color:var(--ink);background:#fff;color:var(--ink)}
.btn--danger{background:#fff;border-color:var(--err);color:var(--err)}
.btn--danger:hover{background:var(--err);color:#fff;border-color:var(--err)}
.btn--sm{min-height:36px;padding:0 13px;font-size:.9rem}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.btn--block{width:100%}

/* forms */
.field{display:grid;gap:6px;margin-bottom:16px}
.field label,.label{font-size:.9rem;font-weight:700}
.input,select.input,textarea.input{width:100%;padding:11px 13px;background:#fff;border:2px solid var(--line-hard);border-radius:0}
.input:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 4px rgba(79,228,242,.45)}
textarea.input{min-height:84px;resize:vertical}
.check{display:flex;align-items:center;gap:9px;font-size:.95rem;margin-bottom:16px}
.check input{width:18px;height:18px;accent-color:var(--blue-ink)}

/* notices and status chips */
.notice{padding:11px 14px;margin-bottom:18px;font-size:.94rem;border-left:4px solid}
.notice--ok{background:var(--ok-bg);border-color:var(--ok)}
.notice--err{background:var(--err-bg);border-color:var(--err)}
.notice--info{background:var(--bg-3);border-color:var(--blue-ink)}
.chip{display:inline-block;padding:2px 10px;border-radius:999px;font-size:.8rem;font-weight:700;white-space:nowrap}
.chip--approved{background:var(--ok-bg);color:var(--ok)}
.chip--pending{background:var(--warn-bg);color:var(--warn)}
.chip--rejected,.chip--cancelled{background:var(--err-bg);color:var(--err)}
.chip--neutral{background:var(--bg-3);color:var(--blue-ink)}

/* sign-in pages */
.gate{min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);background:#fff}
.gate__side{background:var(--ink);color:#fff;padding:clamp(28px,5vw,64px);display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.gate__side::after{content:"";position:absolute;right:-12%;bottom:-18%;width:58%;aspect-ratio:.866;clip-path:var(--hex);background:rgba(79,228,242,.12)}
.gate__brand{display:flex;align-items:center;gap:12px;font-weight:700;letter-spacing:.14em;font-size:1.15rem;color:#fff;text-decoration:none}
.gate__side h1{color:#fff;font-size:clamp(2rem,4vw,3.2rem);max-width:12ch;margin-top:14px}
.gate__side .eyebrow{color:var(--blue)}
.gate__side p{color:#c9d2d9;max-width:38ch;margin-top:16px}
.gate__main{display:flex;align-items:center;justify-content:center;padding:clamp(24px,5vw,64px)}
.gate__card{width:100%;max-width:400px}
.gate__card h2{font-size:1.6rem;margin-bottom:6px}
.gate__card .lead{color:var(--dim);margin-bottom:24px}
.or{display:flex;align-items:center;gap:12px;color:var(--mute);font-size:.85rem;margin:20px 0}
.or::before,.or::after{content:"";flex:1;height:1px;background:var(--line)}
.gbtn{display:flex;align-items:center;justify-content:center;gap:12px;width:100%;min-height:46px;border:2px solid var(--line-hard);background:#fff;font-weight:700;text-decoration:none;color:var(--ink)}
.gbtn:hover{border-color:var(--ink)}
.gbtn svg{width:18px;height:18px}
.rules{margin:0 0 18px;padding-left:18px;color:var(--dim);font-size:.9rem}
@media (max-width:820px){.gate{grid-template-columns:1fr}.gate__side{min-height:auto;padding-bottom:34px}.gate__side p{display:none}.gate__side h1{font-size:1.9rem}}

/* app shell */
.top{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid var(--line)}
.top__in{max-width:1180px;margin:0 auto;padding:0 20px;height:64px;display:flex;align-items:center;gap:16px}
.top__brand{display:flex;align-items:center;gap:10px;font-weight:700;letter-spacing:.12em;text-decoration:none;color:var(--ink)}
.top__app{color:var(--mute);font-size:.92rem;padding-left:14px;border-left:1px solid var(--line)}
.top__me{margin-left:auto;display:flex;align-items:center;gap:12px;font-size:.92rem}
.top__me form{margin:0}
.tabs{max-width:1180px;margin:0 auto;padding:0 20px;display:flex;gap:4px;overflow-x:auto;scrollbar-width:none}
.tabs::-webkit-scrollbar{display:none}
.tab{position:relative;padding:12px 12px 14px;background:none;border:0;cursor:pointer;white-space:nowrap;color:var(--dim)}
.tab[aria-selected="true"]{color:var(--ink);font-weight:700}
.tab[aria-selected="true"]::after{content:"";position:absolute;left:12px;right:12px;bottom:0;height:3px;background:var(--blue)}
.badge{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;margin-left:6px;border-radius:999px;background:var(--ink);color:#fff;font-size:.75rem;font-weight:700}
main{max-width:1180px;margin:0 auto;padding:28px 20px 64px}
.head{display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:20px}
.grid{display:grid;gap:18px}
.g2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g3{grid-template-columns:repeat(3,minmax(0,1fr))}
.card{background:#fff;border:1px solid var(--line);padding:22px}
.card h2{margin-bottom:14px}
.stack>*+*{margin-top:12px}

/* today */
.punch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}
.punch button{display:grid;gap:4px;text-align:left;padding:18px;border:2px solid var(--line-hard);background:#fff;cursor:pointer;transition:border-color .2s,background .2s}
.punch button:hover{border-color:var(--ink);background:var(--bg-2)}
.punch b{font-size:1.1rem}
.punch span{font-size:.86rem;color:var(--mute)}
.stat{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.big{font-size:2rem;font-weight:700;letter-spacing:-.03em}

/* calendar */
.cal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
.cal__dow{font-size:.78rem;color:var(--mute);text-align:center;padding-bottom:4px}
.day{min-height:62px;border:1px solid var(--line);background:#fff;padding:5px 6px;font-size:.78rem;display:flex;flex-direction:column;gap:2px}
.day__n{font-weight:700;font-size:.85rem}
.day--blank{border:0;background:transparent}
.day--off{background:var(--bg-2);color:var(--mute)}
.day--office{background:var(--bg-3);border-color:var(--blue)}
.day--wfh{background:#fff;border:2px solid var(--blue-ink)}
.day--pending{background:var(--warn-bg);border-color:#e9c46a}
.day--leave{background:#f1edf8;border-color:#c8bce6}
.day--absent{background:var(--err-bg);border-color:#f1b5ae}
.day--today{outline:2px solid var(--ink);outline-offset:-2px}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:12px;font-size:.82rem;color:var(--dim)}
.legend i{display:inline-block;width:12px;height:12px;margin-right:6px;vertical-align:-1px;border:1px solid var(--line-hard)}

/* tables */
.tbl{width:100%;border-collapse:collapse;font-size:.93rem}
.tbl th{text-align:left;font-size:.82rem;color:var(--mute);font-weight:700;padding:8px 10px;border-bottom:2px solid var(--ink)}
.tbl td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}
.tbl .actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.scroll{overflow-x:auto}
.empty{color:var(--mute);padding:18px 0}

/* balances */
.bal{border-top:4px solid var(--blue);background:#fff;padding:16px 18px;border-left:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.bal__n{font-size:1.9rem;font-weight:700;letter-spacing:-.03em}
.bal p{font-size:.85rem;color:var(--mute)}

/* approvals */
.req{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:start}
.req__acts{display:grid;gap:8px;min-width:220px}

/* dialog */
dialog{border:0;padding:0;max-width:460px;width:calc(100% - 32px)}
dialog::backdrop{background:rgba(31,36,51,.5)}
.dlg{padding:24px}
.dlg h2{margin-bottom:8px}
.secret{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;margin:16px 0;background:var(--bg-2);border:2px dashed var(--line-hard);font-size:1.25rem;font-weight:700;letter-spacing:.06em;word-break:break-all}

[hidden]{display:none!important}
fieldset{border:0;padding:0;margin:0 0 14px;min-width:0}
legend{padding:0}
/* dashboard tiles */
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-bottom:18px}
.tile{background:#fff;border:1px solid var(--line);border-top:4px solid var(--line-hard);padding:12px 14px}
.tile b{display:block;font-size:1.7rem;letter-spacing:-.03em;line-height:1.1}
.tile span{font-size:.82rem;color:var(--mute)}
.tile--good{border-top-color:var(--blue)}
.tile--warn{border-top-color:#e9c46a}
.tile--bad{border-top-color:#f1b5ae}
.flag{display:inline-block;margin:2px 4px 0 0;padding:1px 7px;font-size:.74rem;font-weight:700;background:var(--warn-bg);color:var(--warn)}
.flag--bad{background:var(--err-bg);color:var(--err)}
.flag--info{background:var(--bg-3);color:var(--blue-ink)}
.day .flag{margin:0;padding:0 4px;font-size:.68rem;align-self:flex-start}
.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end}
.filters .field{margin:0;min-width:150px}
.weekdays{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:4px}

/* notification bell */
.bell{position:relative;display:inline-grid;place-items:center;width:42px;height:42px;border:2px solid var(--line-hard);background:#fff;cursor:pointer}
.bell:hover{border-color:var(--ink)}
.bell svg{width:20px;height:20px}
.bell .badge{position:absolute;top:-8px;right:-8px;margin:0}
.notes{list-style:none;margin:12px 0 0;padding:0;max-height:60vh;overflow:auto}
.notes li{border-bottom:1px solid var(--line)}
.notes button{display:block;width:100%;text-align:left;padding:10px 4px;background:none;border:0;cursor:pointer;font-size:.93rem}
.notes button:hover{background:var(--bg-2)}
.notes .new{font-weight:700}
.notes .new::before{content:"";display:inline-block;width:8px;height:8px;margin-right:8px;background:var(--blue-ink);border-radius:50%;vertical-align:1px}
.notes time{display:block;font-size:.78rem;color:var(--mute);font-weight:400}
dialog.wide{max-width:640px}
.kv{display:grid;grid-template-columns:max-content 1fr;gap:4px 14px;font-size:.92rem}
.kv dt{color:var(--mute)}
.kv dd{margin:0}

@media (max-width:860px){.g2,.g3{grid-template-columns:1fr}.req{grid-template-columns:1fr}.req__acts{min-width:0}.top__app{display:none}}
@media (max-width:560px){.punch{grid-template-columns:1fr}.top__me .who{display:none}.day{min-height:46px;padding:3px}.day__t{display:none}.card{padding:16px}}
`;
