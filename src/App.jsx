import { useState, useEffect, useRef } from "react";

// ── Design tokens ──────────────────────────────────────────────
const C = {
  bg:"#05050a", surface:"#0d0d14", border:"#1c1c2e",
  text:"#f0f0f8", muted:"#6b6b8a", faint:"#1a1a2e",
  electric:"#6c63ff", electricLt:"#9d97ff",
  lime:"#b8ff57", pink:"#ff4d8d", white:"#ffffff",
  amber:"#ffb830", cyan:"#00d4ff", gold:"#ffd700",
};

const TONES    = ["Bold & Edgy","Professional","Playful & Fun","Inspirational","Minimalist","Luxurious"];
const FORMATS  = ["Social Media Post","Tagline / Slogan","Email Subject Lines","Video Ad Script","Billboard Copy","Full Campaign Concept"];
const PLATFORMS = [
  { id:"instagram", label:"Instagram", icon:"📸", limit:"2,200 chars" },
  { id:"google",    label:"Google Ads", icon:"🔍", limit:"90 char desc" },
  { id:"linkedin",  label:"LinkedIn",   icon:"💼", limit:"600 chars" },
  { id:"tiktok",    label:"TikTok",     icon:"🎵", limit:"150 chars" },
];

// Subscription tiers — in a real app this would come from your auth/billing system
const PLANS = {
  starter: { name:"Starter", color:C.muted,    badge:"FREE",     canEdit:false, canExport:false, saveLimit:10  },
  pro:     { name:"Pro",     color:C.electric, badge:"PRO",      canEdit:false, canExport:true,  saveLimit:999 },
  agency:  { name:"Agency",  color:C.gold,     badge:"AGENCY",   canEdit:true,  canExport:true,  saveLimit:999 },
};

// ── In-memory saved store ──────────────────────────────────────
let _savedStore = [];
const savedListeners = new Set();
const savedDB = {
  getAll: ()=>_savedStore,
  save: (idea)=>{ const e={...idea,savedId:Date.now()+Math.random(),savedAt:new Date().toISOString()}; _savedStore=[e,..._savedStore]; savedListeners.forEach(fn=>fn([..._savedStore])); return e; },
  update: (savedId, updates)=>{ _savedStore=_savedStore.map(i=>i.savedId===savedId?{...i,...updates}:i); savedListeners.forEach(fn=>fn([..._savedStore])); },
  remove: (savedId)=>{ _savedStore=_savedStore.filter(i=>i.savedId!==savedId); savedListeners.forEach(fn=>fn([..._savedStore])); },
  subscribe: (fn)=>{ savedListeners.add(fn); return ()=>savedListeners.delete(fn); },
};

function useSaved() {
  const [saved,setSaved]=useState(savedDB.getAll());
  useEffect(()=>savedDB.subscribe(setSaved),[]);
  return saved;
}

// ── Helpers ────────────────────────────────────────────────────
const Tag=({children,color=C.electric})=>(
  <span style={{ display:"inline-flex",alignItems:"center",gap:6,background:color+"18",border:`1px solid ${color}40`,borderRadius:100,padding:"5px 14px",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color }}>{children}</span>
);

const PlanBadge=({plan})=>(
  <span style={{ display:"inline-flex",alignItems:"center",gap:5,background:PLANS[plan].color+"22",border:`1px solid ${PLANS[plan].color}50`,borderRadius:100,padding:"3px 10px",fontSize:11,fontWeight:800,letterSpacing:"0.1em",color:PLANS[plan].color }}>
    {plan==="agency"&&"✦ "}{PLANS[plan].badge}
  </span>
);

const inputSx=(focused)=>({
  width:"100%",background:C.bg,border:`1px solid ${focused?C.electric:C.border}`,
  borderRadius:8,color:C.text,padding:"11px 14px",fontSize:14,
  fontFamily:"inherit",outline:"none",boxSizing:"border-box",transition:"border-color .2s",
});

const labelSx={ display:"block",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:C.muted,marginBottom:7 };

const Stat=({value,label})=>(
  <div style={{ textAlign:"center" }}>
    <div style={{ fontSize:"clamp(28px,4vw,42px)",fontWeight:800,color:C.white,letterSpacing:"-0.03em",lineHeight:1 }}>{value}</div>
    <div style={{ fontSize:13,color:C.muted,marginTop:6,fontWeight:500 }}>{label}</div>
  </div>
);

function Counter({target,suffix=""}) {
  const [val,setVal]=useState(0); const ref=useRef(null);
  useEffect(()=>{ const obs=new IntersectionObserver(([e])=>{ if(!e.isIntersecting)return; obs.disconnect(); let s=0; const step=target/60; const t=setInterval(()=>{ s=Math.min(s+step,target); setVal(Math.floor(s)); if(s>=target)clearInterval(t); },16); },{threshold:0.3}); if(ref.current)obs.observe(ref.current); return()=>obs.disconnect(); },[target]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

function ScoreRing({score,size=60}) {
  const r=(size/2)-5,circ=2*Math.PI*r,filled=(score/100)*circ;
  const color=score>=80?C.lime:score>=60?C.amber:C.pink;
  return (
    <div style={{ position:"relative",width:size,height:size,flexShrink:0 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}>
        <span style={{ fontSize:size*0.22,fontWeight:800,color,lineHeight:1 }}>{score}</span>
      </div>
    </div>
  );
}

function ScoreBar({label,value,color}) {
  return (
    <div style={{ marginBottom:9 }}>
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
        <span style={{ fontSize:12,color:C.muted }}>{label}</span>
        <span style={{ fontSize:12,fontWeight:700,color }}>{value}/100</span>
      </div>
      <div style={{ height:3,background:C.border,borderRadius:4,overflow:"hidden" }}>
        <div style={{ height:"100%",width:`${value}%`,background:color,borderRadius:4 }}/>
      </div>
    </div>
  );
}

// ── Inline Editable Field ──────────────────────────────────────
function EditableField({ value, onChange, multiline=false, placeholder="", style={}, canEdit, onLockedClick }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(value);
  const ref = useRef(null);

  useEffect(()=>{ if(editing && ref.current) ref.current.focus(); },[editing]);

  const commit=()=>{ setEditing(false); onChange(draft); };
  const cancel=()=>{ setEditing(false); setDraft(value); };

  if (!canEdit) {
    return (
      <div onClick={onLockedClick} style={{ position:"relative", cursor:"pointer", borderRadius:6, padding:"8px 10px", margin:"-8px -10px", transition:"background .15s" }}
        onMouseEnter={e=>e.currentTarget.style.background=C.border+"55"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
        <span style={style}>{value}</span>
        <span style={{ position:"absolute",top:4,right:4,fontSize:12,opacity:0.5 }}>🔒</span>
      </div>
    );
  }

  if (editing) {
    const commonProps = {
      ref, value:draft, onChange:e=>setDraft(e.target.value),
      style:{ ...style, width:"100%", background:C.bg, border:`1px solid ${C.gold}`, borderRadius:8,
        color:C.text, padding:"10px 12px", fontSize:"inherit", fontFamily:"inherit",
        fontStyle:"inherit", fontWeight:"inherit", outline:"none", resize:"vertical",
        boxSizing:"border-box", lineHeight:"inherit" },
      onKeyDown:e=>{ if(!multiline&&e.key==="Enter"){ e.preventDefault(); commit(); } if(e.key==="Escape") cancel(); },
    };
    return (
      <div>
        {multiline ? <textarea {...commonProps} rows={4}/> : <input {...commonProps}/>}
        <div style={{ display:"flex",gap:8,marginTop:8 }}>
          <button onClick={commit} style={{ background:C.gold,border:"none",borderRadius:6,color:"#000",padding:"5px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>✓ Save</button>
          <button onClick={cancel} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"5px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={()=>setEditing(true)} style={{ position:"relative", cursor:"text", borderRadius:6, padding:"8px 10px", margin:"-8px -10px", transition:"background .15s", border:`1px solid transparent` }}
      onMouseEnter={e=>{ e.currentTarget.style.background=C.gold+"11"; e.currentTarget.style.borderColor=C.gold+"40"; }}
      onMouseLeave={e=>{ e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; }}>
      <span style={style}>{value}</span>
      <span style={{ position:"absolute",top:4,right:6,fontSize:11,color:C.gold,opacity:0.7,fontWeight:600 }}>✎</span>
    </div>
  );
}

// ── Upsell Modal ───────────────────────────────────────────────
function UpsellModal({ onClose, onUpgrade }) {
  return (
    <div style={{ position:"fixed",inset:0,zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:24 }}>
      <div onClick={onClose} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(6px)" }}/>
      <div style={{ position:"relative",background:C.surface,border:`1px solid ${C.gold}50`,borderRadius:20,padding:"40px 36px",maxWidth:440,width:"100%",textAlign:"center" }}>
        <div style={{ width:64,height:64,borderRadius:16,background:`linear-gradient(135deg,${C.gold},${C.amber})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 20px" }}>✦</div>
        <div style={{ marginBottom:10 }}><PlanBadge plan="agency"/></div>
        <h2 style={{ margin:"12px 0 10px",fontSize:24,fontWeight:800,color:C.white,letterSpacing:"-0.02em" }}>Edit Mode is Agency-only</h2>
        <p style={{ margin:"0 0 28px",fontSize:15,color:C.muted,lineHeight:1.7 }}>
          Agency subscribers can edit every word of their generated concepts — hook, body copy, CTA, and concept name — all inline, instantly.
        </p>
        <div style={{ background:C.faint,borderRadius:12,padding:16,marginBottom:28,textAlign:"left" }}>
          {["✎ Edit concept name, hook, body & CTA inline","🔄 Re-score after your edits","⬇ Export your custom copy to PDF","🔖 Save edited versions to your library","👥 5 team seats included"].map(f=>(
            <div key={f} style={{ fontSize:14,color:"#c0c0d8",padding:"5px 0",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:8 }}>
              <span style={{ color:C.gold }}>{f.split(" ")[0]}</span>
              <span>{f.split(" ").slice(1).join(" ")}</span>
            </div>
          ))}
        </div>
        <button onClick={onUpgrade} style={{ width:"100%",padding:15,background:`linear-gradient(135deg,${C.gold},${C.amber})`,border:"none",borderRadius:10,color:"#000",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",marginBottom:12 }}>
          Upgrade to Agency — $99/mo
        </button>
        <button onClick={onClose} style={{ background:"transparent",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit" }}>Maybe later</button>
      </div>
    </div>
  );
}

// ── PDF Export ─────────────────────────────────────────────────
function exportToPDF(ideas, brandInfo) {
  const sc=s=>s>=80?"#b8ff57":s>=60?"#ffb830":"#ff4d8d";
  const sl=s=>s>=80?"Excellent":s>=60?"Good":"Needs work";
  const html=`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>AdSpark — ${brandInfo.company}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Inter',sans-serif;background:#05050a;color:#f0f0f8;padding:48px;max-width:860px;margin:0 auto}
  .header{border-bottom:2px solid #6c63ff;padding-bottom:32px;margin-bottom:40px}
  .logo{display:flex;align-items:center;gap:10px;margin-bottom:20px}
  .logo-icon{width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6c63ff,#ff4d8d);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;line-height:1}
  h1{font-size:32px;font-weight:900;letter-spacing:-0.03em;color:#fff;margin-bottom:8px}
  .meta{display:flex;flex-wrap:wrap;gap:20px;margin-top:14px}
  .meta-item{font-size:13px;color:#6b6b8a}.meta-item strong{color:#f0f0f8}
  .concept{background:#0d0d14;border:1px solid #1c1c2e;border-radius:16px;padding:32px;margin-bottom:28px;page-break-inside:avoid}
  .concept-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px}
  .concept-num{font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:6px}
  .concept-name{font-size:20px;font-weight:800;color:#fff}
  .score-box{text-align:center;min-width:60px}
  .score-num{font-size:28px;font-weight:900;line-height:1}
  .lbl{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#333;margin:0 0 6px}
  .hook{font-size:16px;font-weight:600;color:#ddd;font-style:italic;line-height:1.5;margin-bottom:16px;padding:14px;background:#1a1a2e;border-radius:8px;border-left:3px solid #6c63ff}
  .body-copy{font-size:14px;color:#6b6b8a;line-height:1.8;margin-bottom:16px}
  .cta-box{background:#1a1a2e;border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:10px;margin-bottom:20px}
  .cta-label{font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#333}
  .scores-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#111118;border-radius:10px;padding:16px}
  .score-item{font-size:12px}.score-item-lbl{color:#6b6b8a;margin-bottom:4px}.score-item-val{font-weight:700}
  .score-bar{height:3px;background:#1c1c2e;border-radius:3px;margin-top:4px}.score-bar-fill{height:100%;border-radius:3px}
  .footer{margin-top:48px;padding-top:24px;border-top:1px solid #1c1c2e;display:flex;justify-content:space-between}
  .footer-text{font-size:12px;color:#333}
  .edited-badge{display:inline-block;background:#ffd70022;border:1px solid #ffd70040;border-radius:100px;padding:2px 8px;font-size:10px;font-weight:700;color:#ffd700;letter-spacing:0.1em;margin-left:8px}
</style></head><body>
<div class="header">
  <div class="logo"><div class="logo-icon">⚡</div><span style="font-size:22px;font-weight:900;color:#fff">AdSpark</span><span style="font-size:11px;background:#b8ff5722;border:1px solid #b8ff5740;color:#b8ff57;border-radius:100px;padding:2px 8px;letter-spacing:0.1em;margin-left:6px">v4</span></div>
  <h1>${brandInfo.company} — Campaign Concepts</h1>
  <div class="meta">
    ${brandInfo.industry?`<div class="meta-item"><strong>Industry:</strong> ${brandInfo.industry}</div>`:""}
    <div class="meta-item"><strong>Tone:</strong> ${brandInfo.tone}</div>
    <div class="meta-item"><strong>Format:</strong> ${brandInfo.format}</div>
    <div class="meta-item"><strong>Generated:</strong> ${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</div>
  </div>
</div>
${ideas.map((idea,i)=>{
  const accents=["#6c63ff","#b8ff57","#ff4d8d"]; const accent=accents[i%3];
  const overall=idea.score||Math.round(((idea.scores?.clarity||80)+(idea.scores?.emotion||80)+(idea.scores?.cta_strength||80)+(idea.scores?.brand_fit||80))/4);
  const s=idea.scores||{clarity:80,emotion:80,cta_strength:80,brand_fit:80};
  return `<div class="concept" style="border-top:3px solid ${accent}">
  <div class="concept-header">
    <div><div class="concept-num" style="color:${accent}">Concept ${i+1}${idea._edited?'<span class="edited-badge">EDITED</span>':''}</div><div class="concept-name">${idea.concept}</div></div>
    <div class="score-box"><div class="score-num" style="color:${sc(overall)}">${overall}</div><div style="font-size:11px;color:${sc(overall)}">${sl(overall)}</div></div>
  </div>
  <div class="lbl">Hook</div><div class="hook">"${idea.hook}"</div>
  <div class="lbl">Body Copy</div><div class="body-copy">${idea.body}</div>
  <div class="lbl">Call to Action</div>
  <div class="cta-box"><span class="cta-label">CTA</span><span style="font-size:14px;font-weight:700;color:${accent}">${idea.cta}</span></div>
  <div class="scores-grid">${[["Clarity",s.clarity,"#00d4ff"],["Emotional Pull",s.emotion,"#ff4d8d"],["CTA Strength",s.cta_strength,"#ffb830"],["Brand Fit",s.brand_fit,"#b8ff57"]].map(([l,v,c])=>`<div class="score-item"><div class="score-item-lbl">${l}</div><div class="score-item-val" style="color:${c}">${v}/100</div><div class="score-bar"><div class="score-bar-fill" style="width:${v}%;background:${c}"></div></div></div>`).join("")}</div>
</div>`;
}).join("")}
<div class="footer"><span class="footer-text">Generated by AdSpark AI • adspark.io</span><span class="footer-text">${ideas.length} concepts • ${new Date().toLocaleDateString()}</span></div>
</body></html>`;
  const blob=new Blob([html],{type:"text/html"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url;
  a.download=`adspark-${brandInfo.company.toLowerCase().replace(/\s+/g,"-")}-concepts.html`;
  a.click(); URL.revokeObjectURL(url);
}

// ── Idea Card v4 ───────────────────────────────────────────────
function IdeaCard({ idea: initialIdea, index, brandVoice, brandInfo, onSave, plan, onShowUpsell }) {
  const [idea, setIdea]                   = useState(initialIdea);
  const [copied, setCopied]               = useState(false);
  const [saved,  setSaved]                = useState(false);
  const [tab, setTab]                     = useState("copy");
  const [activePlatform, setActivePlatform] = useState("instagram");
  const [platformCopy, setPlatformCopy]   = useState({});
  const [loadingPlat, setLoadingPlat]     = useState(false);
  const [whyData, setWhyData]             = useState(null);
  const [loadingWhy, setLoadingWhy]       = useState(false);
  const [rescoring, setRescoring]         = useState(false);

  const canEdit = PLANS[plan]?.canEdit;
  const canExport = PLANS[plan]?.canExport;
  const accents=[C.electric,C.lime,C.pink];
  const accent=accents[index%3];
  const scores=idea.scores||{clarity:78,emotion:85,cta_strength:80,brand_fit:88};
  const overall=idea.score||Math.round((scores.clarity+scores.emotion+scores.cta_strength+scores.brand_fit)/4);

  const updateField=(field,val)=>{
    setIdea(prev=>({...prev,[field]:val,_edited:true}));
    // clear platform cache since copy changed
    if(["hook","body","cta"].includes(field)) setPlatformCopy({});
  };

  const rescore=async()=>{
    setRescoring(true);
    const prompt=`Score this ad concept honestly across 4 dimensions.
Hook: ${idea.hook}
Body: ${idea.body}
CTA: ${idea.cta}
Return ONLY JSON: {"score":<0-100>,"scores":{"clarity":<0-100>,"emotion":<0-100>,"cta_strength":<0-100>,"brand_fit":<0-100>}}. No markdown.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:200,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("");
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      setIdea(prev=>({...prev,...parsed}));
    }catch{}
    finally{setRescoring(false);}
  };

  const handleCopy=()=>{ navigator.clipboard.writeText(`${idea.concept}\n\n${idea.hook}\n\n${idea.body}\n\nCTA: ${idea.cta}`); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const handleSave=()=>{ savedDB.save({...idea,brandInfo}); setSaved(true); setTimeout(()=>setSaved(false),2000); if(onSave) onSave(); };

  const formatPlatform=async(pid)=>{
    setActivePlatform(pid);
    if(platformCopy[pid]) return;
    setLoadingPlat(true);
    const plat=PLATFORMS.find(p=>p.id===pid);
    const prompt=`Reformat for ${plat.label} (${plat.limit} max). Adapt length, hashtags, tone.
Hook: ${idea.hook}\nBody: ${idea.body}\nCTA: ${idea.cta}
Return ONLY JSON: {"formatted":"<copy>","tips":"<one tip>"}. No markdown.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:400,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("");
      setPlatformCopy(p=>({...p,[pid]:JSON.parse(text.replace(/```json|```/g,"").trim())}));
    }catch{ setPlatformCopy(p=>({...p,[pid]:{formatted:"Could not format.",tips:""}})); }
    finally{setLoadingPlat(false);}
  };

  const fetchWhy=async()=>{
    if(whyData) return; setLoadingWhy(true);
    const prompt=`Analyze this ad concept psychologically.\nHook: ${idea.hook}\nBody: ${idea.body}\nCTA: ${idea.cta}
Return ONLY JSON: {"trigger":"<3-5 words>","explanation":"<2-3 sentences>","bias":"<2-4 words>","cta_reason":"<1 sentence>","weakness":"<1 sentence>"}. No markdown.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:400,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("");
      setWhyData(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch{ setWhyData({trigger:"Failed",explanation:"Please try again.",bias:"—",cta_reason:"—",weakness:"—"}); }
    finally{setLoadingWhy(false);}
  };

  const handleTab=(t)=>{ setTab(t); if(t==="why"&&!whyData&&!loadingWhy) fetchWhy(); if(t==="platforms") formatPlatform(activePlatform); };

  const Spinner=({color=C.electric})=>(
    <span style={{ width:15,height:15,border:`2px solid ${C.border}`,borderTop:`2px solid ${color}`,borderRadius:"50%",display:"inline-block",animation:"spin .8s linear infinite" }}/>
  );

  return (
    <div style={{ background:C.surface,border:`1px solid ${canEdit&&idea._edited?C.gold:C.border}`,borderTop:`2px solid ${canEdit&&idea._edited?C.gold:accent}`,borderRadius:14,overflow:"hidden",transition:"border-color .3s" }}>

      {/* Agency edit banner */}
      {canEdit && (
        <div style={{ background:C.gold+"11",borderBottom:`1px solid ${C.gold}22`,padding:"8px 24px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
          <span style={{ fontSize:12,color:C.gold,fontWeight:600,display:"flex",alignItems:"center",gap:6 }}>✦ Agency Edit Mode — click any field to edit</span>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            {idea._edited&&(
              <button onClick={rescore} disabled={rescoring} style={{ background:C.gold+"22",border:`1px solid ${C.gold}50`,borderRadius:6,color:C.gold,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5 }}>
                {rescoring?<><Spinner color={C.gold}/> Rescoring...</>:"🔄 Re-score edits"}
              </button>
            )}
            {idea._edited&&<span style={{ fontSize:11,background:C.gold+"22",border:`1px solid ${C.gold}40`,borderRadius:100,padding:"2px 8px",color:C.gold,fontWeight:700 }}>EDITED</span>}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:"20px 24px 0" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14 }}>
          <div style={{ display:"flex",alignItems:"center",gap:14,flex:1,minWidth:0 }}>
            <ScoreRing score={overall}/>
            <div style={{ flex:1,minWidth:0 }}>
              <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.15em",textTransform:"uppercase",color:accent,display:"block",marginBottom:4 }}>Concept {index+1}</span>
              <EditableField
                value={idea.concept}
                onChange={v=>updateField("concept",v)}
                canEdit={canEdit}
                onLockedClick={onShowUpsell}
                style={{ fontSize:17,fontWeight:700,color:C.white,display:"block" }}
              />
              <span style={{ fontSize:12,color:C.muted,marginTop:2,display:"block" }}>Score: <span style={{ color:overall>=80?C.lime:overall>=60?C.amber:C.pink,fontWeight:700 }}>{overall>=80?"Excellent":overall>=60?"Good":"Needs work"}</span></span>
            </div>
          </div>
          <div style={{ display:"flex",gap:8,flexShrink:0,marginLeft:12 }}>
            <button onClick={handleSave} style={{ background:saved?"#0d1f0d":C.faint,border:`1px solid ${saved?"#2a5a2a":C.border}`,borderRadius:6,color:saved?C.lime:C.muted,padding:"6px 11px",fontSize:12,cursor:"pointer",transition:"all .2s",fontFamily:"inherit" }}>{saved?"✓ Saved":"🔖 Save"}</button>
            <button onClick={handleCopy} style={{ background:copied?"#0d1f0d":C.faint,border:`1px solid ${copied?"#2a5a2a":C.border}`,borderRadius:6,color:copied?C.lime:C.muted,padding:"6px 11px",fontSize:12,cursor:"pointer",transition:"all .2s",fontFamily:"inherit" }}>{copied?"✓ Copied":"Copy"}</button>
            {canExport&&<button onClick={()=>exportToPDF([idea],brandInfo)} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"6px 11px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>⬇ PDF</button>}
          </div>
        </div>

        {/* Score bars */}
        <div style={{ background:C.faint,borderRadius:10,padding:"14px 16px",marginBottom:14 }}>
          <ScoreBar label="Clarity"        value={scores.clarity}      color={C.cyan}/>
          <ScoreBar label="Emotional Pull" value={scores.emotion}      color={C.pink}/>
          <ScoreBar label="CTA Strength"   value={scores.cta_strength} color={C.amber}/>
          <div style={{ marginBottom:0 }}><ScoreBar label="Brand Fit" value={scores.brand_fit} color={C.lime}/></div>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex",gap:0,borderBottom:`1px solid ${C.border}` }}>
          {[["copy","📝 Copy"],["platforms","📱 Platforms"],["why","🧠 Why It Works"]].map(([id,label])=>(
            <button key={id} onClick={()=>handleTab(id)} style={{ padding:"10px 16px",background:"transparent",border:"none",borderBottom:`2px solid ${tab===id?accent:"transparent"}`,color:tab===id?accent:C.muted,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",transition:"all .15s",marginBottom:-1 }}>{label}</button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ padding:"20px 24px 24px" }}>

        {/* COPY TAB */}
        {tab==="copy"&&(
          <div>
            <p style={{ margin:"0 0 6px",fontSize:10,fontWeight:700,color:"#333",letterSpacing:"0.08em",textTransform:"uppercase" }}>Hook {!canEdit&&<span style={{ color:"#333" }}>🔒 Agency only</span>}</p>
            <div style={{ marginBottom:14 }}>
              <EditableField value={idea.hook} onChange={v=>updateField("hook",v)} multiline canEdit={canEdit} onLockedClick={onShowUpsell}
                style={{ fontSize:15,fontWeight:600,color:"#ccc",fontStyle:"italic",lineHeight:1.5,display:"block" }}/>
            </div>
            <p style={{ margin:"0 0 6px",fontSize:10,fontWeight:700,color:"#333",letterSpacing:"0.08em",textTransform:"uppercase" }}>Body Copy</p>
            <div style={{ marginBottom:14 }}>
              <EditableField value={idea.body} onChange={v=>updateField("body",v)} multiline canEdit={canEdit} onLockedClick={onShowUpsell}
                style={{ fontSize:13,color:C.muted,lineHeight:1.7,display:"block" }}/>
            </div>
            <p style={{ margin:"0 0 6px",fontSize:10,fontWeight:700,color:"#333",letterSpacing:"0.08em",textTransform:"uppercase" }}>Call to Action</p>
            <div style={{ background:C.faint,borderRadius:8,padding:"10px 14px",display:"flex",gap:10,alignItems:"center" }}>
              <span style={{ fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"#333",flexShrink:0 }}>CTA</span>
              <EditableField value={idea.cta} onChange={v=>updateField("cta",v)} canEdit={canEdit} onLockedClick={onShowUpsell}
                style={{ fontSize:13,fontWeight:700,color:accent,display:"block",flex:1 }}/>
            </div>
            {!canEdit&&(
              <button onClick={onShowUpsell} style={{ marginTop:14,width:"100%",background:C.gold+"11",border:`1px solid ${C.gold}30`,borderRadius:8,color:C.gold,padding:"10px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
                ✦ Upgrade to Agency to edit any field
              </button>
            )}
          </div>
        )}

        {/* PLATFORMS TAB */}
        {tab==="platforms"&&(
          <div>
            <div style={{ display:"flex",gap:8,flexWrap:"wrap",marginBottom:18 }}>
              {PLATFORMS.map(p=>(
                <button key={p.id} onClick={()=>formatPlatform(p.id)} style={{ display:"flex",alignItems:"center",gap:7,padding:"8px 14px",borderRadius:8,cursor:"pointer",background:activePlatform===p.id?C.electric+"22":"transparent",border:`1px solid ${activePlatform===p.id?C.electric:C.border}`,color:activePlatform===p.id?C.electricLt:C.muted,fontSize:13,fontWeight:600,fontFamily:"inherit",transition:"all .15s" }}>
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
            {loadingPlat?(
              <div style={{ display:"flex",alignItems:"center",gap:10,color:C.muted,fontSize:14 }}><Spinner/> Formatting...</div>
            ):platformCopy[activePlatform]?(
              <div>
                <div style={{ background:C.bg,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:12 }}>
                  <p style={{ margin:0,fontSize:14,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap" }}>{platformCopy[activePlatform].formatted}</p>
                </div>
                {platformCopy[activePlatform].tips&&(
                  <div style={{ display:"flex",gap:8,alignItems:"flex-start",background:C.electric+"11",border:`1px solid ${C.electric}30`,borderRadius:8,padding:"10px 14px",marginBottom:12 }}>
                    <span>💡</span><p style={{ margin:0,fontSize:13,color:C.electricLt,lineHeight:1.6 }}>{platformCopy[activePlatform].tips}</p>
                  </div>
                )}
                <button onClick={()=>navigator.clipboard.writeText(platformCopy[activePlatform].formatted)} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"7px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit" }}>Copy formatted text</button>
              </div>
            ):<p style={{ color:C.muted,fontSize:14 }}>Select a platform above.</p>}
          </div>
        )}

        {/* WHY TAB */}
        {tab==="why"&&(
          <div>
            {loadingWhy?(<div style={{ display:"flex",alignItems:"center",gap:10,color:C.muted,fontSize:14 }}><Spinner color={C.pink}/> Analyzing psychology...</div>
            ):whyData?(
              <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
                  <div style={{ background:C.pink+"15",border:`1px solid ${C.pink}30`,borderRadius:8,padding:"10px 16px",flex:1,minWidth:130 }}>
                    <p style={{ margin:"0 0 4px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:C.pink }}>Psych Trigger</p>
                    <p style={{ margin:0,fontSize:14,fontWeight:700,color:C.white }}>{whyData.trigger}</p>
                  </div>
                  <div style={{ background:C.amber+"15",border:`1px solid ${C.amber}30`,borderRadius:8,padding:"10px 16px",flex:1,minWidth:130 }}>
                    <p style={{ margin:"0 0 4px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:C.amber }}>Cognitive Bias</p>
                    <p style={{ margin:0,fontSize:14,fontWeight:700,color:C.white }}>{whyData.bias}</p>
                  </div>
                </div>
                <div style={{ background:C.faint,borderRadius:10,padding:14 }}>
                  <p style={{ margin:"0 0 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted }}>Why the hook grabs attention</p>
                  <p style={{ margin:0,fontSize:14,color:"#c0c0d8",lineHeight:1.7 }}>{whyData.explanation}</p>
                </div>
                <div style={{ background:C.faint,borderRadius:10,padding:14 }}>
                  <p style={{ margin:"0 0 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted }}>Why the CTA converts</p>
                  <p style={{ margin:0,fontSize:14,color:"#c0c0d8",lineHeight:1.7 }}>{whyData.cta_reason}</p>
                </div>
                <div style={{ background:"#1a0d0d",border:`1px solid #3a1a1a`,borderRadius:10,padding:14 }}>
                  <p style={{ margin:"0 0 6px",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:"#ff7070" }}>⚠ Watch out for</p>
                  <p style={{ margin:0,fontSize:14,color:"#cc8888",lineHeight:1.7 }}>{whyData.weakness}</p>
                </div>
              </div>
            ):null}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Saved Library ──────────────────────────────────────────────
function SavedLibrary({ onClose, plan }) {
  const saved=useSaved();
  const [filter,setFilter]=useState("");
  const filtered=saved.filter(i=>!filter||i.concept?.toLowerCase().includes(filter.toLowerCase())||i.brandInfo?.company?.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div style={{ position:"fixed",inset:0,zIndex:200,display:"flex" }}>
      <div onClick={onClose} style={{ position:"absolute",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(4px)" }}/>
      <div style={{ position:"relative",marginLeft:"auto",width:"min(520px,100vw)",height:"100vh",background:C.surface,borderLeft:`1px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        <div style={{ padding:"24px 24px 16px",borderBottom:`1px solid ${C.border}` }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14 }}>
            <div>
              <h2 style={{ margin:0,fontSize:20,fontWeight:800,color:C.white }}>Saved Ideas</h2>
              <p style={{ margin:"4px 0 0",fontSize:13,color:C.muted }}>{saved.length} concept{saved.length!==1?"s":""} saved</p>
            </div>
            <div style={{ display:"flex",gap:8 }}>
              {saved.length>0&&PLANS[plan]?.canExport&&(
                <button onClick={()=>exportToPDF(saved,{company:"Saved Library",industry:"",tone:"Various",format:"Various"})} style={{ background:`linear-gradient(135deg,${C.electric},${C.pink})`,border:"none",borderRadius:8,color:"#fff",padding:"8px 14px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>⬇ Export All</button>
              )}
              <button onClick={onClose} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"8px 12px",fontSize:18,cursor:"pointer",lineHeight:1,fontFamily:"inherit" }}>✕</button>
            </div>
          </div>
          {saved.length>0&&<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Filter by concept or brand..." style={{ width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"9px 12px",fontSize:13,fontFamily:"inherit",outline:"none",boxSizing:"border-box" }}/>}
        </div>
        <div style={{ flex:1,overflowY:"auto",padding:16 }}>
          {saved.length===0?(
            <div style={{ textAlign:"center",padding:"60px 24px" }}>
              <div style={{ fontSize:48,marginBottom:16 }}>🔖</div>
              <p style={{ color:C.muted,fontSize:15,lineHeight:1.7 }}>No ideas saved yet.<br/>Hit <strong style={{ color:C.text }}>Save</strong> on any concept.</p>
            </div>
          ):filtered.length===0?(
            <p style={{ textAlign:"center",color:C.muted,padding:40 }}>No results for "{filter}"</p>
          ):filtered.map(idea=>{
            const overall=idea.score||Math.round(((idea.scores?.clarity||80)+(idea.scores?.emotion||80)+(idea.scores?.cta_strength||80)+(idea.scores?.brand_fit||80))/4);
            const sc=overall>=80?C.lime:overall>=60?C.amber:C.pink;
            return (
              <div key={idea.savedId} style={{ background:C.bg,border:`1px solid ${idea._edited?C.gold+"50":C.border}`,borderRadius:12,padding:16,marginBottom:12 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    {idea.brandInfo?.company&&<span style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",color:C.muted,display:"block",marginBottom:3 }}>{idea.brandInfo.company}</span>}
                    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
                      <h4 style={{ margin:0,fontSize:15,fontWeight:700,color:C.white }}>{idea.concept}</h4>
                      {idea._edited&&<span style={{ fontSize:10,background:C.gold+"22",border:`1px solid ${C.gold}40`,borderRadius:100,padding:"1px 7px",color:C.gold,fontWeight:700,flexShrink:0 }}>EDITED</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginLeft:10,flexShrink:0 }}>
                    <span style={{ fontSize:18,fontWeight:800,color:sc }}>{overall}</span>
                    <button onClick={()=>savedDB.remove(idea.savedId)} style={{ background:"transparent",border:"none",color:"#444",fontSize:16,cursor:"pointer",padding:"2px 4px",lineHeight:1 }}>✕</button>
                  </div>
                </div>
                <p style={{ margin:"0 0 10px",fontSize:13,color:"#aaa",fontStyle:"italic",lineHeight:1.5 }}>"{idea.hook}"</p>
                <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
                  <button onClick={()=>navigator.clipboard.writeText(`${idea.concept}\n\n${idea.hook}\n\n${idea.body}\n\nCTA: ${idea.cta}`)} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>Copy</button>
                  {PLANS[plan]?.canExport&&<button onClick={()=>exportToPDF([idea],idea.brandInfo||{company:"AdSpark",industry:"",tone:"",format:""})} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:6,color:C.muted,padding:"5px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit" }}>⬇ PDF</button>}
                  <span style={{ fontSize:11,color:"#2a2a3e",marginLeft:"auto" }}>{new Date(idea.savedAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════
export default function AdSpark() {
  const [section,setSection]       = useState("home");
  const [form,setForm]             = useState({ company:"",industry:"",product:"",audience:"",tone:"Bold & Edgy",format:"Full Campaign Concept" });
  const [brandVoice,setBrandVoice] = useState("");
  const [showVoice,setShowVoice]   = useState(false);
  const [ideas,setIdeas]           = useState([]);
  const [loading,setLoading]       = useState(false);
  const [error,setError]           = useState("");
  const [focused,setFocused]       = useState("");
  const [showLibrary,setShowLibrary] = useState(false);
  const [showUpsell,setShowUpsell] = useState(false);
  const [exportingAll,setExportingAll] = useState(false);
  const [toast,setToast]           = useState("");
  // Simulate plan — in production this comes from your auth/billing system
  const [plan,setPlan]             = useState("pro"); // "starter" | "pro" | "agency"
  const saved = useSaved();

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const showToastMsg=(msg)=>{ setToast(msg); setTimeout(()=>setToast(""),2500); };

  const generate=async()=>{
    if(!form.company||!form.product||!form.audience){ setError("Fill in company, product, and audience to continue."); return; }
    setError(""); setLoading(true); setIdeas([]);
    const prompt=`You are a world-class creative director. Generate 3 distinct scored ad concepts.
Company: ${form.company}\nIndustry: ${form.industry||"Not specified"}\nProduct/Service: ${form.product}\nTarget Audience: ${form.audience}\nTone: ${form.tone}\nFormat: ${form.format}
${brandVoice?`Brand voice examples: ${brandVoice}`:""}
Return ONLY a JSON array of 3 objects each with: "concept" (3-6 word name), "hook" (one headline), "body" (2-4 sentence ad copy), "cta" (short CTA), "score" (0-100, honest), "scores": {clarity,emotion,cta_strength,brand_fit} each 0-100.
Make each dramatically different. No markdown. Raw JSON only.`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1200,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const text=data.content.map(i=>i.text||"").join("");
      setIdeas(JSON.parse(text.replace(/```json|```/g,"").trim()));
    }catch{ setError("Generation failed — please try again."); }
    finally{ setLoading(false); }
  };

  // ── Plan switcher (demo only) ─────────────────────────────────
  const PlanSwitcher=()=>(
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"10px 16px",marginBottom:24,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap" }}>
      <span style={{ fontSize:12,color:C.muted,fontWeight:600 }}>Demo plan:</span>
      {Object.entries(PLANS).map(([key,p])=>(
        <button key={key} onClick={()=>setPlan(key)} style={{ padding:"5px 14px",borderRadius:100,border:`1px solid ${plan===key?p.color:C.border}`,background:plan===key?p.color+"22":"transparent",color:plan===key?p.color:C.muted,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .15s" }}>
          {key==="agency"&&"✦ "}{p.name}
        </button>
      ))}
      <span style={{ fontSize:11,color:"#333",marginLeft:"auto" }}>Switch plans to see edit access change</span>
    </div>
  );

  // ── NAV ──────────────────────────────────────────────────────
  const Nav=()=>(
    <nav style={{ position:"sticky",top:0,zIndex:100,background:"rgba(5,5,10,0.9)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${C.border}`,padding:"0 24px" }}>
      <div style={{ maxWidth:1100,margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between",height:60 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10,cursor:"pointer" }} onClick={()=>setSection("home")}>
          <div style={{ width:30,height:30,borderRadius:8,background:`linear-gradient(135deg,${C.electric},${C.pink})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:900,color:"#fff" }}>⚡</div>
          <span style={{ fontSize:17,fontWeight:800,color:C.white,letterSpacing:"-0.02em" }}>AdSpark</span>
          <span style={{ fontSize:10,fontWeight:700,background:C.lime+"22",border:`1px solid ${C.lime}40`,color:C.lime,borderRadius:100,padding:"2px 8px",letterSpacing:"0.1em" }}>v4</span>
        </div>
        <div style={{ display:"flex",gap:28,alignItems:"center" }}>
          {["Product","Pricing","About"].map(l=>(
            <a key={l} href="#" onClick={e=>e.preventDefault()} style={{ fontSize:14,color:C.muted,textDecoration:"none",fontWeight:500 }}
              onMouseEnter={e=>e.target.style.color=C.text} onMouseLeave={e=>e.target.style.color=C.muted}>{l}</a>
          ))}
        </div>
        <div style={{ display:"flex",gap:10,alignItems:"center" }}>
          <PlanBadge plan={plan}/>
          <button onClick={()=>{ setSection("app"); setShowLibrary(true); }} style={{ position:"relative",background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6 }}>
            🔖 Library {saved.length>0&&<span style={{ background:C.electric,borderRadius:100,padding:"1px 6px",fontSize:10,fontWeight:800,color:"#fff" }}>{saved.length}</span>}
          </button>
          <button onClick={()=>setSection("app")} style={{ background:`linear-gradient(135deg,${C.electric},${C.pink})`,border:"none",borderRadius:8,color:"#fff",padding:"9px 20px",fontSize:13,fontWeight:700,cursor:"pointer" }}>Try for free →</button>
        </div>
      </div>
    </nav>
  );

  const Hero=()=>(
    <section style={{ padding:"100px 24px 80px",textAlign:"center",position:"relative",overflow:"hidden" }}>
      <div style={{ position:"absolute",top:"10%",left:"50%",transform:"translateX(-50%)",width:700,height:350,borderRadius:"50%",background:`radial-gradient(ellipse,${C.electric}22 0%,transparent 70%)`,pointerEvents:"none" }}/>
      <div style={{ position:"relative",maxWidth:800,margin:"0 auto" }}>
        <div style={{ marginBottom:20 }}><Tag color={C.gold}>✦ v4 — Agency full edit mode now live</Tag></div>
        <h1 style={{ margin:"0 0 24px",lineHeight:1.08,letterSpacing:"-0.04em",fontSize:"clamp(40px,7vw,80px)",fontWeight:900,color:C.white }}>
          Your AI creative<br/>
          <span style={{ background:`linear-gradient(90deg,${C.electric},${C.pink})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent" }}>director, on demand.</span>
        </h1>
        <p style={{ margin:"0 auto 40px",maxWidth:560,fontSize:"clamp(16px,2.5vw,20px)",color:C.muted,lineHeight:1.7 }}>
          Generate. Score. Edit. Format. Understand. Save. Export. Everything you need to run smarter ads — all in one place.
        </p>
        <div style={{ display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap" }}>
          <button onClick={()=>setSection("app")} style={{ background:`linear-gradient(135deg,${C.electric},${C.pink})`,border:"none",borderRadius:10,color:"#fff",padding:"15px 32px",fontSize:16,fontWeight:700,cursor:"pointer",boxShadow:`0 0 40px ${C.electric}50` }}>Generate your first ad free</button>
          <button onClick={()=>setSection("app")} style={{ background:`linear-gradient(135deg,${C.gold},${C.amber})`,border:"none",borderRadius:10,color:"#000",padding:"15px 28px",fontSize:16,fontWeight:700,cursor:"pointer" }}>✦ See Agency edit mode</button>
        </div>
        <div style={{ marginTop:48,display:"flex",gap:18,justifyContent:"center",flexWrap:"wrap" }}>
          {["AI scoring","Platform formatter","Psychology explainer","Save library","PDF export",{text:"✦ Full edit mode",color:C.gold}].map((t,i)=>(
            <span key={i} style={{ fontSize:13,color:typeof t==="object"?t.color:C.muted,display:"flex",alignItems:"center",gap:6 }}>
              <span style={{ color:typeof t==="object"?t.color:C.lime }}>✓</span>{typeof t==="string"?t:t.text}
            </span>
          ))}
        </div>
      </div>
    </section>
  );

  const Stats=()=>(
    <section style={{ padding:"60px 24px",borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:900,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:40 }}>
        <Stat value={<Counter target={14200} suffix="+"/>} label="Concepts generated"/>
        <Stat value={<Counter target={3100} suffix="+"/>}  label="Brands using AdSpark"/>
        <Stat value={<><Counter target={94}/>%</>}          label="User satisfaction"/>
        <Stat value={<><Counter target={8}/>s</>}           label="Avg generation time"/>
      </div>
    </section>
  );

  const Features=()=>(
    <section style={{ padding:"90px 24px" }}>
      <div style={{ maxWidth:1060,margin:"0 auto" }}>
        <div style={{ textAlign:"center",marginBottom:56 }}>
          <Tag color={C.pink}>Everything you need</Tag>
          <h2 style={{ margin:"20px 0 14px",fontSize:"clamp(28px,4vw,44px)",fontWeight:800,letterSpacing:"-0.03em",color:C.white }}>Six features. Zero bloat.</h2>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:20 }}>
          {[
            {icon:"📊",color:C.cyan,   title:"Performance Scoring",  body:"Every concept scored across clarity, emotion, CTA strength, and brand fit.",tier:null},
            {icon:"📱",color:C.lime,   title:"Platform Formatter",   body:"Auto-reformat for Instagram, Google Ads, LinkedIn, and TikTok instantly.",tier:null},
            {icon:"🧠",color:C.pink,   title:"Psychology Explainer", body:"Understand the trigger, bias, and reason each CTA converts.",tier:null},
            {icon:"🔖",color:C.amber,  title:"Saved Library",        body:"Bookmark your best concepts. Search and filter anytime.",tier:null},
            {icon:"⬇", color:C.electric,title:"PDF Export",          body:"Export any concept or full library as a branded PDF.",tier:"Pro+"},
            {icon:"✎", color:C.gold,   title:"Full Edit Mode",       body:"Edit every word of your concepts inline, then re-score your changes.",tier:"Agency"},
          ].map(({icon,color,title,body,tier})=>(
            <div key={title} style={{ background:C.surface,border:`1px solid ${tier==="Agency"?C.gold+"40":C.border}`,borderRadius:14,padding:28,position:"relative" }}>
              {tier&&<div style={{ position:"absolute",top:14,right:14,background:tier==="Agency"?C.gold+"22":C.electric+"22",border:`1px solid ${tier==="Agency"?C.gold+"50":C.electric+"50"}`,borderRadius:100,padding:"2px 8px",fontSize:10,fontWeight:700,color:tier==="Agency"?C.gold:C.electric,letterSpacing:"0.1em" }}>{tier}</div>}
              <div style={{ width:44,height:44,borderRadius:10,background:color+"20",border:`1px solid ${color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:16 }}>{icon}</div>
              <h3 style={{ margin:"0 0 10px",fontSize:17,fontWeight:700,color:C.white }}>{title}</h3>
              <p style={{ margin:0,fontSize:14,color:C.muted,lineHeight:1.7 }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );

  const Pricing=()=>(
    <section style={{ padding:"80px 24px",background:C.surface,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}` }}>
      <div style={{ maxWidth:960,margin:"0 auto" }}>
        <div style={{ textAlign:"center",marginBottom:52 }}>
          <Tag color={C.lime}>Pricing</Tag>
          <h2 style={{ margin:"20px 0 12px",fontSize:"clamp(28px,4vw,44px)",fontWeight:800,letterSpacing:"-0.03em",color:C.white }}>Simple, honest pricing</h2>
          <p style={{ color:C.muted,fontSize:17 }}>Full edit mode is exclusive to Agency.</p>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:20 }}>
          {[
            {name:"Starter",price:"Free",per:"forever",key:"starter",cta:"Get started",
              features:["10 concepts/month","Performance scoring","3 ad formats","Copy to clipboard","10 saved ideas"]},
            {name:"Pro",price:"$29",per:"/month",key:"pro",cta:"Start free trial",
              features:["Unlimited concepts","All platform formatters","Psychology explainer","Unlimited library","Unlimited PDF exports","Brand voice learning"]},
            {name:"Agency",price:"$99",per:"/month",key:"agency",cta:"Start Agency trial",
              features:["Everything in Pro","✦ Full inline edit mode","🔄 Re-score after edits","5 team seats","White-label PDFs","API access"]},
          ].map(({name,price,per,key,cta,features})=>{
            const isAgency=key==="agency";
            return (
              <div key={name} style={{ background:isAgency?`linear-gradient(160deg,${C.gold}18,${C.amber}0a)`:C.bg,border:`1px solid ${isAgency?C.gold+"60":C.border}`,borderRadius:16,padding:32,position:"relative" }}>
                {isAgency&&<div style={{ position:"absolute",top:16,right:16,background:`linear-gradient(135deg,${C.gold},${C.amber})`,borderRadius:100,padding:"3px 10px",fontSize:10,fontWeight:700,color:"#000",letterSpacing:"0.1em" }}>✦ AGENCY</div>}
                <div style={{ fontSize:13,fontWeight:700,color:C.muted,marginBottom:12 }}>{name}</div>
                <div style={{ display:"flex",alignItems:"baseline",gap:4,marginBottom:24 }}>
                  <span style={{ fontSize:40,fontWeight:900,color:C.white,letterSpacing:"-0.04em" }}>{price}</span>
                  <span style={{ fontSize:13,color:C.muted }}>{per}</span>
                </div>
                <ul style={{ listStyle:"none",margin:"0 0 28px",padding:0,display:"flex",flexDirection:"column",gap:10 }}>
                  {features.map(f=>(
                    <li key={f} style={{ fontSize:14,color:"#b0b0c8",display:"flex",gap:8,alignItems:"flex-start" }}>
                      <span style={{ color:isAgency?C.gold:C.lime,flexShrink:0 }}>✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button onClick={()=>{ setPlan(key); setSection("app"); }} style={{ width:"100%",padding:12,background:isAgency?`linear-gradient(135deg,${C.gold},${C.amber})`:"transparent",border:`1px solid ${isAgency?"transparent":C.border}`,borderRadius:8,color:isAgency?"#000":C.muted,fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>{cta}</button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );

  const Footer=()=>(
    <footer style={{ borderTop:`1px solid ${C.border}`,padding:"36px 24px" }}>
      <div style={{ maxWidth:1100,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:20 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          <div style={{ width:26,height:26,borderRadius:7,background:`linear-gradient(135deg,${C.electric},${C.pink})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:"#fff",fontWeight:900 }}>⚡</div>
          <span style={{ fontSize:15,fontWeight:800,color:C.white }}>AdSpark</span>
        </div>
        <p style={{ margin:0,fontSize:13,color:C.muted }}>© 2026 AdSpark Inc. All rights reserved.</p>
        <div style={{ display:"flex",gap:24 }}>
          {["Privacy","Terms","Contact"].map(l=>(
            <a key={l} href="#" onClick={e=>e.preventDefault()} style={{ fontSize:13,color:C.muted,textDecoration:"none" }}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  );

  // ── APP SECTION ───────────────────────────────────────────────
  const AppSection=()=>(
    <div style={{ minHeight:"100vh",background:C.bg,padding:"52px 24px" }}>
      <div style={{ maxWidth:800,margin:"0 auto" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28 }}>
          <button onClick={()=>setSection("home")} style={{ background:"transparent",border:"none",color:C.muted,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",gap:6,fontFamily:"inherit",padding:0 }}>← Back</button>
          <button onClick={()=>setShowLibrary(true)} style={{ position:"relative",background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6 }}>
            🔖 My Library {saved.length>0&&<span style={{ background:C.electric,borderRadius:100,padding:"1px 6px",fontSize:10,fontWeight:800,color:"#fff" }}>{saved.length}</span>}
          </button>
        </div>

        {/* Plan switcher demo */}
        <PlanSwitcher/>

        <div style={{ marginBottom:28 }}>
          <Tag color={C.electric}>Live demo</Tag>
          <h2 style={{ margin:"14px 0 6px",fontSize:"clamp(24px,3.5vw,34px)",fontWeight:800,letterSpacing:"-0.03em",color:C.white }}>Generate your ad concepts</h2>
          <p style={{ margin:0,color:C.muted,fontSize:15 }}>3 scored concepts in seconds. {PLANS[plan]?.canEdit?"✦ Agency edit mode is ON — click any field to edit.":"Upgrade to Agency to edit concepts inline."}</p>
        </div>

        {/* Form */}
        <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:28,marginBottom:24 }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:18 }}>
            <div><label style={labelSx}>Company Name *</label><input value={form.company} onChange={e=>set("company",e.target.value)} onFocus={()=>setFocused("company")} onBlur={()=>setFocused("")} placeholder="e.g. Acme Inc." style={inputSx(focused==="company")}/></div>
            <div><label style={labelSx}>Industry</label><input value={form.industry} onChange={e=>set("industry",e.target.value)} onFocus={()=>setFocused("industry")} onBlur={()=>setFocused("")} placeholder="e.g. Fitness, SaaS" style={inputSx(focused==="industry")}/></div>
          </div>
          <div style={{ marginBottom:18 }}><label style={labelSx}>Product / Service *</label><textarea value={form.product} onChange={e=>set("product",e.target.value)} onFocus={()=>setFocused("product")} onBlur={()=>setFocused("")} placeholder="Describe what you sell and what makes it unique..." rows={3} style={{ ...inputSx(focused==="product"),resize:"vertical" }}/></div>
          <div style={{ marginBottom:18 }}><label style={labelSx}>Target Audience *</label><input value={form.audience} onChange={e=>set("audience",e.target.value)} onFocus={()=>setFocused("audience")} onBlur={()=>setFocused("")} placeholder="e.g. Busy parents 30–45 who want healthy meal options" style={inputSx(focused==="audience")}/></div>
          <div style={{ marginBottom:18 }}>
            <button onClick={()=>setShowVoice(v=>!v)} style={{ background:"transparent",border:"none",color:C.electricLt,fontSize:13,cursor:"pointer",fontFamily:"inherit",padding:0,display:"flex",alignItems:"center",gap:6,marginBottom:showVoice?10:0 }}>
              {showVoice?"▾":"▸"} Brand voice examples <span style={{ color:C.muted }}>(optional)</span>
            </button>
            {showVoice&&<textarea value={brandVoice} onChange={e=>setBrandVoice(e.target.value)} placeholder="Paste 2-3 examples of copy that matches your brand voice..." rows={3} style={{ ...inputSx(focused==="voice"),resize:"vertical" }} onFocus={()=>setFocused("voice")} onBlur={()=>setFocused("")}/>}
          </div>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:24 }}>
            <div><label style={labelSx}>Tone</label><select value={form.tone} onChange={e=>set("tone",e.target.value)} style={{ ...inputSx(false),cursor:"pointer" }}>{TONES.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label style={labelSx}>Ad Format</label><select value={form.format} onChange={e=>set("format",e.target.value)} style={{ ...inputSx(false),cursor:"pointer" }}>{FORMATS.map(f=><option key={f}>{f}</option>)}</select></div>
          </div>
          {error&&<div style={{ background:"#1a0a0a",border:"1px solid #4a1a1a",borderRadius:8,padding:"12px 16px",marginBottom:18,color:"#ff7070",fontSize:14 }}>{error}</div>}
          <button onClick={generate} disabled={loading} style={{ width:"100%",padding:15,background:loading?C.faint:`linear-gradient(135deg,${C.electric},${C.pink})`,border:"none",borderRadius:10,color:loading?C.muted:"#fff",fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer",fontFamily:"inherit",boxShadow:loading?"none":`0 0 28px ${C.electric}40` }}>
            {loading?<span style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:10 }}><span style={{ width:15,height:15,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.electric}`,borderRadius:"50%",display:"inline-block",animation:"spin .8s linear infinite" }}/>Generating & scoring...</span>:"Generate 3 scored concepts →"}
          </button>
        </div>

        {ideas.length>0&&(
          <div>
            <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,flexWrap:"wrap",gap:10 }}>
              <div style={{ display:"flex",alignItems:"center",gap:12 }}>
                <h3 style={{ margin:0,fontSize:20,fontWeight:700,color:C.white }}>Your concepts</h3>
                <Tag color={C.lime}>{ideas.length} scored</Tag>
                {PLANS[plan]?.canEdit&&<Tag color={C.gold}>✦ Edit mode on</Tag>}
              </div>
              {PLANS[plan]?.canExport&&(
                <button onClick={()=>{ setExportingAll(true); exportToPDF(ideas,form); setTimeout(()=>setExportingAll(false),1500); }} disabled={exportingAll} style={{ background:C.faint,border:`1px solid ${C.border}`,borderRadius:8,color:C.muted,padding:"8px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                  {exportingAll?"Exporting...":"⬇ Export all to PDF"}
                </button>
              )}
            </div>
            <p style={{ color:C.muted,fontSize:13,marginBottom:18 }}>
              {PLANS[plan]?.canEdit
                ? "✦ Click any field to edit it. Hit 🔄 Re-score to update your performance score after edits."
                : "Click tabs for platforms or psychology. Upgrade to Agency to edit concepts inline."}
            </p>
            <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
              {ideas.map((idea,i)=>(
                <IdeaCard key={i} idea={idea} index={i} brandVoice={brandVoice} brandInfo={form} plan={plan} onSave={()=>showToastMsg("✓ Saved to library")} onShowUpsell={()=>setShowUpsell(true)}/>
              ))}
            </div>
            <p style={{ textAlign:"center",color:"#2a2a3e",fontSize:13,marginTop:24 }}>Not feeling these? Adjust your inputs and regenerate.</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ background:C.bg,color:C.text,fontFamily:"'Inter',system-ui,sans-serif",minHeight:"100vh" }}>
      <Nav/>
      {section==="home"?<><Hero/><Stats/><Features/><Pricing/><Footer/></>:<AppSection/>}
      {showLibrary&&<SavedLibrary onClose={()=>setShowLibrary(false)} plan={plan}/>}
      {showUpsell&&<UpsellModal onClose={()=>setShowUpsell(false)} onUpgrade={()=>{ setPlan("agency"); setShowUpsell(false); showToastMsg("✦ Upgraded to Agency! Edit mode is now ON."); }}/>}
      {toast&&<div style={{ position:"fixed",bottom:28,left:"50%",transform:"translateX(-50%)",background:toast.includes("✦")?C.gold:C.lime,color:"#000",borderRadius:100,padding:"10px 24px",fontSize:14,fontWeight:700,zIndex:300,boxShadow:"0 4px 24px rgba(0,0,0,0.4)",whiteSpace:"nowrap" }}>{toast}</div>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}select option{background:${C.bg}}input::placeholder,textarea::placeholder{color:#2a2a3e}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:${C.border};border-radius:3px}`}</style>
    </div>
  );
}
