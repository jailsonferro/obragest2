import { useState, useRef, useEffect, useCallback } from "react";
import { PlusCircle, Trash2, Upload, BarChart2, ChevronDown, ChevronUp, X, Save, Plus, AlertTriangle, Menu } from "lucide-react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const ETAPAS = ["Fundação","Estrutura","Alvenaria","Cobertura","Elétrica","Hidráulica","Revestimento","Acabamento","Pintura","Impermeabilização","Jardinagem","Serralheria","Esquadrias","Gesso/Drywall","Climatização","Limpeza de Obra","Outros"];
const COLORS = {"Fundação":"#f59e0b","Estrutura":"#ef4444","Alvenaria":"#8b5cf6","Cobertura":"#06b6d4","Elétrica":"#f97316","Hidráulica":"#3b82f6","Revestimento":"#10b981","Acabamento":"#ec4899","Pintura":"#a3e635","Impermeabilização":"#0891b2","Jardinagem":"#65a30d","Serralheria":"#78716c","Esquadrias":"#d97706","Gesso/Drywall":"#c084fc","Climatização":"#22d3ee","Limpeza de Obra":"#4ade80","Outros":"#94a3b8"};

const CATEGORIAS_FINANCEIRO = ["Materiais","Mão de Obra","Equipamentos","Serviços Terceiros","Taxas/Licenças","Outros"];
const TIPO_TRANSACAO = ["Entrada","Saída"];
const STATUS_MATERIAL = ["Em Estoque","Baixo Estoque","Esgotado","Pedido Realizado","Aguardando Entrega"];

const fmt = v => (v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const slugify = s => s.trim().replace(/\s+/g,"-").replace(/[^a-zA-Z0-9-]/g,"").toLowerCase();
const today = () => new Date().toISOString().split("T")[0];
const emptyRow = (etapa="Fundação") => ({ id: crypto.randomUUID(), etapa, descricao:"", unidade:"m²", quantidade:"", precoUnit:"" });
const emptyTransacao = () => ({ id: crypto.randomUUID(), data: today(), tipo:"Saída", categoria:"Materiais", descricao:"", valor:"", etapa:"Outros", observacao:"" });
const emptyMaterial = () => ({ id: crypto.randomUUID(), nome:"", categoria:"", unidade:"un", quantidadeEstoque:"", quantidadeMinima:"", precoUnitario:"", fornecedor:"", status:"Em Estoque", ultimaAtualizacao: today(), observacao:"" });

const PROMPT = `Analise este documento. Pode ser foto de obra, orçamento, nota fiscal, planilha ou qualquer documento de construção.
Extraia TODOS os itens/serviços e responda SOMENTE em JSON válido, sem markdown, sem texto extra:
{"descricao":"...","etapa":"...","elementos":["..."],"itens_sugeridos":[{"etapa":"...","descricao":"...","unidade":"...","quantidade":10,"precoUnit":150.00,"precoDesconto":135.00,"total":1350.00}],"observacoes":"..."}
REGRAS:
- Para o campo "etapa" de CADA item, use OBRIGATORIAMENTE: Fundação, Estrutura, Alvenaria, Cobertura, Elétrica, Hidráulica, Revestimento, Acabamento, Pintura, Impermeabilização, Jardinagem, Serralheria, Esquadrias, Gesso/Drywall, Climatização, Limpeza de Obra, Outros
- precoDesconto = preço com desconto (se não houver, igual ao precoUnit)
- total = quantidade × precoDesconto
- Valores numéricos sem R$ ou texto
- Extraia TODOS os itens sem omitir nenhum`;

// ─── STORAGE HELPERS ─────────────────────────────────────────────────────────
const db = {
  get: async (k) => { try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; } },
  set: async (k, v) => { try { await window.storage.set(k, JSON.stringify(v)); return true; } catch { return false; } },
  del: async (k) => { try { await window.storage.delete(k); return true; } catch { return false; } },
};

// ─── COMPONENTS ──────────────────────────────────────────────────────────────
const Badge = ({color, children}) => (
  <span style={{background:`${color}22`,border:`1px solid ${color}44`,color,padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>{children}</span>
);

const Card = ({children, style={}}) => (
  <div style={{background:"#111827",border:"1px solid #1f2937",borderRadius:16,padding:20,...style}}>{children}</div>
);

const KPI = ({label, value, sub, color="#34d399", icon}) => (
  <Card style={{flex:1,minWidth:160}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
      <p style={{color:"#6b7280",fontSize:11,fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>{label}</p>
      {icon && <span style={{fontSize:18}}>{icon}</span>}
    </div>
    <p style={{fontSize:22,fontWeight:800,color,marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>{value}</p>
    {sub && <p style={{fontSize:11,color:"#4b5563"}}>{sub}</p>}
  </Card>
);

const Input = ({style={}, ...props}) => (
  <input {...props} style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,color:"#e5e7eb",padding:"8px 12px",fontSize:13,outline:"none",transition:"border 0.2s",...style}}
    onFocus={e=>e.target.style.border="1px solid #10b981"}
    onBlur={e=>e.target.style.border="1px solid #1f2937"}/>
);

const Select = ({children, style={}, ...props}) => (
  <select {...props} style={{background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,color:"#e5e7eb",padding:"8px 12px",fontSize:13,...style}}>
    {children}
  </select>
);

const Btn = ({children, variant="primary", style={}, ...props}) => {
  const variants = {
    primary:{background:"linear-gradient(135deg,#059669,#10b981)",color:"#fff",border:"none"},
    secondary:{background:"#1f2937",color:"#e5e7eb",border:"1px solid #374151"},
    danger:{background:"transparent",color:"#ef4444",border:"none"},
    ghost:{background:"transparent",color:"#6b7280",border:"none"},
  };
  return <button {...props} style={{...variants[variant],borderRadius:9,padding:"9px 18px",fontWeight:700,fontSize:13,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:6,transition:"opacity 0.15s",...style}}
    onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>{children}</button>;
};

// ─── STATUS MATERIAL COLOR ───────────────────────────────────────────────────
const statusColor = s => ({
  "Em Estoque":"#10b981","Baixo Estoque":"#f59e0b","Esgotado":"#ef4444",
  "Pedido Realizado":"#3b82f6","Aguardando Entrega":"#8b5cf6"
}[s]||"#6b7280");

// ─── TABS ─────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"dashboard",label:"Dashboard",icon:"📊"},
  {id:"orcamento",label:"Orçamento",icon:"📋"},
  {id:"financeiro",label:"Financeiro",icon:"💰"},
  {id:"estoque",label:"Materiais",icon:"📦"},
  {id:"analisador",label:"IA Analisador",icon:"🤖"},
  {id:"resumo",label:"Resumo",icon:"📈"},
];

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [obras, setObras] = useState([]);
  const [obraAtual, setObraAtual] = useState(null);
  const [showObras, setShowObras] = useState(false);
  const [novaObraNome, setNovaObraNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Analisador
  const [fileName, setFileName] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileB64, setFileB64] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();

  // Orçamento
  const [filtroEtapa, setFiltroEtapa] = useState("Todas");
  const [filtroTexto, setFiltroTexto] = useState("");
  const [etapasColapsadas, setEtapasColapsadas] = useState({});

  // Financeiro
  const [showAddTransacao, setShowAddTransacao] = useState(false);
  const [novaTransacao, setNovaTransacao] = useState(emptyTransacao());
  const [filtroFinanceiro, setFiltroFinanceiro] = useState("Todos");

  // Estoque
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [novoMaterial, setNovoMaterial] = useState(emptyMaterial());
  const [editMaterialId, setEditMaterialId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("Todos");

  // Resumo
  const [expanded, setExpanded] = useState({});

  // ── LOAD ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const idx = await db.get("og2:index");
      if (idx && Array.isArray(idx)) {
        setObras(idx);
        if (idx.length > 0) {
          const last = await db.get(`og2:obra:${idx[idx.length-1].id}`);
          if (last) setObraAtual(last);
        }
      }
      setLoading(false);
    })();
  }, []);

  // ── DERIVED ───────────────────────────────────────────────────────────────
  const rows = obraAtual?.rows || [];
  const transacoes = obraAtual?.transacoes || [];
  const materiais = obraAtual?.materiais || [];
  const bdi = obraAtual?.bdi || "";

  const rowTotal = r => (parseFloat(r.quantidade)||0)*(parseFloat(r.precoUnit)||0);
  const grandTotal = rows.reduce((s,r)=>s+rowTotal(r),0);
  const bdiVal = parseFloat(bdi)||0;
  const totalComBdi = grandTotal*(1+(bdiVal/100));

  const totalEntradas = transacoes.filter(t=>t.tipo==="Entrada").reduce((s,t)=>s+(parseFloat(t.valor)||0),0);
  const totalSaidas = transacoes.filter(t=>t.tipo==="Saída").reduce((s,t)=>s+(parseFloat(t.valor)||0),0);
  const saldo = totalEntradas - totalSaidas;

  const valorEstoque = materiais.reduce((s,m)=>(parseFloat(m.quantidadeEstoque)||0)*(parseFloat(m.precoUnitario)||0)+s,0);
  const materiaisAlerta = materiais.filter(m=>m.status==="Baixo Estoque"||m.status==="Esgotado");

  const byEtapa = ETAPAS.map(et=>{ const items=rows.filter(r=>r.etapa===et); return {etapa:et,items,subtotal:items.reduce((s,r)=>s+rowTotal(r),0)}; }).filter(e=>e.items.length>0);
  const pct = v => grandTotal>0?((v/grandTotal)*100).toFixed(1):"0.0";

  // ── SAVE ──────────────────────────────────────────────────────────────────
  const salvarObra = useCallback(async (obra) => {
    if (!obra) return;
    setSaving(true);
    const ok = await db.set(`og2:obra:${obra.id}`, obra);
    const novaLista = obras.some(o=>o.id===obra.id)
      ? obras.map(o=>o.id===obra.id?{id:obra.id,nome:obra.nome,criadaEm:obra.criadaEm}:o)
      : [...obras,{id:obra.id,nome:obra.nome,criadaEm:obra.criadaEm}];
    await db.set("og2:index", novaLista);
    setObras(novaLista);
    setSaveMsg(ok?"✅ Salvo!":"❌ Erro");
    setSaving(false);
    setTimeout(()=>setSaveMsg(null),2500);
  }, [obras]);

  const autoSave = useCallback((updatedObra) => {
    setObraAtual(updatedObra);
    salvarObra(updatedObra);
  }, [salvarObra]);

  const updateObra = (patch) => {
    const updated = {...obraAtual,...patch};
    setObraAtual(updated);
  };

  const saveNow = () => salvarObra(obraAtual);

  // ── OBRAS CRUD ────────────────────────────────────────────────────────────
  const criarObra = async () => {
    const nome = novaObraNome.trim()||"Nova Obra";
    const id = `${slugify(nome)}-${Date.now()}`;
    const nova = {id, nome, rows:[], bdi:"", orcamentoTotal:"", transacoes:[], materiais:[], criadaEm: new Date().toLocaleDateString("pt-BR")};
    setObraAtual(nova); setNovaObraNome(""); setShowObras(false);
    setAnalysisResult(null); clearFile();
    await salvarObra(nova);
  };

  const abrirObra = async id => {
    const data = await db.get(`og2:obra:${id}`);
    if (data) { setObraAtual(data); setAnalysisResult(null); clearFile(); }
    setShowObras(false);
  };

  const excluirObra = async id => {
    await db.del(`og2:obra:${id}`);
    const novaLista = obras.filter(o=>o.id!==id);
    await db.set("og2:index", novaLista);
    setObras(novaLista);
    if (obraAtual?.id===id) setObraAtual(null);
  };

  // ── ORÇAMENTO CRUD ────────────────────────────────────────────────────────
  const setRows = fn => { const nr = typeof fn==="function"?fn(obraAtual?.rows||[]):fn; updateObra({rows:nr}); };
  const addRow = (etapa) => setRows(r=>[...r, emptyRow(etapa||"Fundação")]);
  const removeRow = id => setRows(r=>r.filter(row=>row.id!==id));
  const updateRow = (id,f,v) => setRows(r=>r.map(row=>row.id===id?{...row,[f]:v}:row));

  // ── FINANCEIRO CRUD ───────────────────────────────────────────────────────
  const addTransacao = () => {
    const t = {...novaTransacao, id:crypto.randomUUID()};
    const updated = {...obraAtual, transacoes:[...(obraAtual?.transacoes||[]),t]};
    autoSave(updated);
    setNovaTransacao(emptyTransacao()); setShowAddTransacao(false);
  };
  const removeTransacao = id => { const updated={...obraAtual,transacoes:transacoes.filter(t=>t.id!==id)}; autoSave(updated); };

  // ── ESTOQUE CRUD ──────────────────────────────────────────────────────────
  const saveMaterial = () => {
    const existing = materiais.find(m=>m.id===novoMaterial.id);
    const lista = existing ? materiais.map(m=>m.id===novoMaterial.id?novoMaterial:m) : [...materiais, {...novoMaterial, id:crypto.randomUUID()}];
    const updated = {...obraAtual, materiais:lista};
    autoSave(updated);
    setNovoMaterial(emptyMaterial()); setShowAddMaterial(false); setEditMaterialId(null);
  };
  const removeMaterial = id => { const updated={...obraAtual, materiais:materiais.filter(m=>m.id!==id)}; autoSave(updated); };
  const editMaterial = (m) => { setNovoMaterial({...m}); setEditMaterialId(m.id); setShowAddMaterial(true); };

  // ── ANALISADOR ────────────────────────────────────────────────────────────
  const handleFile = file => {
    if (!file) return;
    const isImg=file.type.startsWith("image/"); const isPDF=file.type==="application/pdf";
    if (!isImg&&!isPDF) return;
    setAnalysisResult(null); setErrorMsg(null); setIsPdf(isPDF); setFileName(file.name);
    const reader=new FileReader();
    reader.onload=e=>{ const b64=e.target.result.split(",")[1]; setFileB64(b64); if(isImg)setPreviewUrl(e.target.result); else setPreviewUrl(null); };
    reader.readAsDataURL(file);
  };
  const clearFile = () => { setFileName(null);setPreviewUrl(null);setFileB64(null);setIsPdf(false);setAnalysisResult(null);setErrorMsg(null); };

  const analyzeFile = async () => {
    if (!fileB64) return;
    setAnalyzing(true); setErrorMsg(null); setAnalysisResult(null);
    try {
      const fileBlock = isPdf
        ? {type:"document",source:{type:"base64",media_type:"application/pdf",data:fileB64}}
        : {type:"image",source:{type:"base64",media_type:"image/jpeg",data:fileB64}};
      const res = await fetch("/api/analyze",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:[fileBlock,{type:"text",text:PROMPT}]}]})
      });
      const data = await res.json();
      if (!res.ok) throw new Error(`API ${res.status}: ${data?.error?.message}`);
      const text = data.content.map(i=>i.text||"").join("");
      setAnalysisResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch(e) { setErrorMsg(e.message); }
    setAnalyzing(false);
  };

  const matchEtapa = etapa => {
    if (!etapa) return "Outros";
    const e=etapa.trim().toLowerCase();
    return ETAPAS.find(et=>et.toLowerCase()===e)||ETAPAS.find(et=>e.includes(et.toLowerCase())||et.toLowerCase().includes(e))||"Outros";
  };

  const importItems = () => {
    if (!analysisResult?.itens_sugeridos?.length) return;
    const newRows = analysisResult.itens_sugeridos.map(i=>({
      id:crypto.randomUUID(), etapa:matchEtapa(i.etapa), descricao:i.descricao||"", unidade:i.unidade||"un",
      quantidade:String(parseFloat(i.quantidade)||""), precoUnit:String(parseFloat(i.precoDesconto)||parseFloat(i.precoUnit)||"")
    }));
    const updated = {...obraAtual, rows:[...(obraAtual?.rows||[]),...newRows]};
    autoSave(updated);
    setTab("orcamento");
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{minHeight:"100vh",background:"#060b12",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{width:48,height:48,border:"3px solid #1f2937",borderTop:"3px solid #10b981",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <p style={{color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace",fontSize:13}}>carregando sistema...</p>
    </div>
  );

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Syne:wght@600;700;800&display=swap');
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:#060b12; }
    ::-webkit-scrollbar{width:6px;height:6px} ::-webkit-scrollbar-track{background:#0d1117} ::-webkit-scrollbar-thumb{background:#1f2937;border-radius:3px}
    input,select,textarea{outline:none;font-family:inherit;}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
    .anim{animation:fadeIn 0.25s ease}
    .row-hover:hover{background:#0d1117 !important}
    .tab-item:hover{background:#111827;color:#e5e7eb}
  `;

  const noObra = !obraAtual;

  return (
    <div style={{display:"flex",minHeight:"100vh",background:"#060b12",color:"#e5e7eb",fontFamily:"'Syne',sans-serif"}}>
      <style>{css}</style>

      {/* ── SIDEBAR ── */}
      <div style={{width:sidebarOpen?240:64,background:"#080e17",borderRight:"1px solid #0f1923",display:"flex",flexDirection:"column",transition:"width 0.2s",flexShrink:0,position:"sticky",top:0,height:"100vh",overflow:"hidden"}}>
        {/* Logo */}
        <div style={{padding:"20px 16px 16px",borderBottom:"1px solid #0f1923",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,background:"linear-gradient(135deg,#059669,#10b981)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:18}}>🏗️</span>
          </div>
          {sidebarOpen && <div><p style={{fontWeight:800,fontSize:15,color:"#10b981"}}>ObraGest</p><p style={{fontSize:10,color:"#374151",fontFamily:"'IBM Plex Mono',monospace"}}>PRO v2.0</p></div>}
        </div>

        {/* Obra Selector */}
        {sidebarOpen && (
          <div style={{padding:"12px 16px",borderBottom:"1px solid #0f1923",position:"relative"}}>
            <p style={{fontSize:10,color:"#374151",fontFamily:"'IBM Plex Mono',monospace",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Obra Ativa</p>
            <button onClick={()=>setShowObras(v=>!v)} style={{width:"100%",background:"#0d1117",border:"1px solid #1f2937",borderRadius:8,padding:"8px 12px",color:"#9ca3af",cursor:"pointer",textAlign:"left",fontSize:12,display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"'IBM Plex Mono',monospace"}}>
              <span style={{color:obraAtual?"#10b981":"#4b5563",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:140}}>{obraAtual?obraAtual.nome:"Selecionar..."}</span>
              <ChevronDown size={12}/>
            </button>
            {showObras && (
              <div style={{position:"absolute",top:"calc(100% - 4px)",left:16,right:16,background:"#0d1117",border:"1px solid #1f2937",borderRadius:10,zIndex:200,boxShadow:"0 12px 40px #000000aa"}}>
                <div style={{padding:10,borderBottom:"1px solid #1f2937"}}>
                  <div style={{display:"flex",gap:6}}>
                    <Input value={novaObraNome} onChange={e=>setNovaObraNome(e.target.value)} onKeyDown={e=>e.key==="Enter"&&criarObra()} placeholder="Nome da nova obra..." style={{flex:1,fontSize:12}}/>
                    <button onClick={criarObra} style={{background:"#10b981",border:"none",borderRadius:7,padding:"6px 10px",cursor:"pointer",color:"#fff"}}><Plus size={13}/></button>
                  </div>
                </div>
                <div style={{maxHeight:200,overflowY:"auto"}}>
                  {obras.length===0 ? <p style={{padding:12,color:"#374151",fontSize:11,textAlign:"center",fontFamily:"'IBM Plex Mono',monospace"}}>nenhuma obra</p>
                  : obras.map(o=>(
                    <div key={o.id} style={{display:"flex",alignItems:"center",padding:"8px 10px",borderBottom:"1px solid #0f1923",cursor:"pointer"}} className="row-hover">
                      <div onClick={()=>abrirObra(o.id)} style={{flex:1}}>
                        <p style={{fontSize:12,fontWeight:700,color:obraAtual?.id===o.id?"#10b981":"#e5e7eb"}}>{o.nome}</p>
                        <p style={{fontSize:10,color:"#374151",fontFamily:"'IBM Plex Mono',monospace"}}>{o.criadaEm}</p>
                      </div>
                      <button onClick={()=>excluirObra(o.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#ef4444",padding:4}}><Trash2 size={11}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nav */}
        <nav style={{flex:1,padding:"12px 8px",overflowY:"auto"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>{setTab(t.id);setShowObras(false);}} className="tab-item"
              style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:sidebarOpen?"10px 12px":"10px",border:"none",cursor:"pointer",borderRadius:10,marginBottom:2,background:tab===t.id?"#111827":"transparent",color:tab===t.id?"#10b981":"#6b7280",textAlign:"left",transition:"all 0.15s"}}>
              <span style={{fontSize:16,flexShrink:0}}>{t.icon}</span>
              {sidebarOpen&&<span style={{fontSize:13,fontWeight:700}}>{t.label}</span>}
              {sidebarOpen&&tab===t.id&&<div style={{marginLeft:"auto",width:4,height:4,borderRadius:"50%",background:"#10b981"}}/>}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{padding:"12px 8px",borderTop:"1px solid #0f1923"}}>
          <button onClick={()=>setSidebarOpen(v=>!v)} style={{width:"100%",background:"transparent",border:"none",cursor:"pointer",color:"#374151",padding:"8px",borderRadius:8,display:"flex",alignItems:"center",justifyContent:sidebarOpen?"flex-end":"center"}}>
            <Menu size={16}/>
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Topbar */}
        <div style={{background:"#080e17",borderBottom:"1px solid #0f1923",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
          <div>
            <h1 style={{fontSize:16,fontWeight:800,color:"#e5e7eb"}}>{TABS.find(t=>t.id===tab)?.icon} {TABS.find(t=>t.id===tab)?.label}</h1>
            {obraAtual && <p style={{fontSize:11,color:"#374151",fontFamily:"'IBM Plex Mono',monospace",marginTop:2}}>obra: {obraAtual.nome}</p>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {materiaisAlerta.length>0&&<div style={{background:"#f59e0b22",border:"1px solid #f59e0b44",borderRadius:20,padding:"4px 12px",fontSize:11,color:"#f59e0b",display:"flex",alignItems:"center",gap:4}}><AlertTriangle size={11}/>{materiaisAlerta.length} alerta{materiaisAlerta.length>1?"s":""}</div>}
            {saveMsg && <span style={{fontSize:12,color:saveMsg.startsWith("✅")?"#10b981":"#ef4444",fontFamily:"'IBM Plex Mono',monospace"}}>{saveMsg}</span>}
            <Btn onClick={saveNow} disabled={!obraAtual||saving} style={{fontSize:12,padding:"7px 14px"}}>
              {saving?<div style={{width:12,height:12,border:"2px solid #fff",borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>:<Save size={12}/>}
              {saving?"Salvando...":"Salvar"}
            </Btn>
          </div>
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:28}}>

          {/* ── SEM OBRA ── */}
          {noObra && (
            <div className="anim" style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:20}}>
              <div style={{fontSize:64}}>🏗️</div>
              <h2 style={{fontSize:22,fontWeight:800,color:"#1f2937"}}>Nenhuma obra selecionada</h2>
              <p style={{color:"#374151",fontSize:14,fontFamily:"'IBM Plex Mono',monospace"}}>Crie ou selecione uma obra no menu lateral para começar</p>
              <Btn onClick={()=>setShowObras(true)}><Plus size={14}/>Criar Nova Obra</Btn>
            </div>
          )}

          {/* ── DASHBOARD ── */}
          {obraAtual && tab==="dashboard" && (
            <div className="anim">
              <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
                <KPI label="Orçamento Total" value={fmt(grandTotal)} sub={bdiVal>0?`Com BDI: ${fmt(totalComBdi)}`:undefined} color="#10b981" icon="📋"/>
                <KPI label="Saldo Financeiro" value={fmt(saldo)} sub={`Entradas: ${fmt(totalEntradas)} | Saídas: ${fmt(totalSaidas)}`} color={saldo>=0?"#34d399":"#ef4444"} icon="💰"/>
                <KPI label="Valor em Estoque" value={fmt(valorEstoque)} sub={`${materiais.length} materiais cadastrados`} color="#8b5cf6" icon="📦"/>
                <KPI label="Execução Orçada" value={grandTotal>0?`${Math.min(100,(totalSaidas/grandTotal*100)).toFixed(1)}%`:"–"} sub={`${fmt(totalSaidas)} gastos`} color="#f59e0b" icon="⚡"/>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:24}}>
                <Card>
                  <p style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:16,textTransform:"uppercase",letterSpacing:1}}>Orçamento por Etapa</p>
                  {byEtapa.length===0 ? <p style={{color:"#374151",fontSize:12,textAlign:"center",padding:20,fontFamily:"'IBM Plex Mono',monospace"}}>sem dados no orçamento</p>
                  : byEtapa.sort((a,b)=>b.subtotal-a.subtotal).slice(0,6).map(e=>(
                    <div key={e.etapa} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                        <span style={{color:"#9ca3af"}}>{e.etapa}</span>
                        <span style={{color:COLORS[e.etapa],fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(e.subtotal)}</span>
                      </div>
                      <div style={{height:6,background:"#0d1117",borderRadius:4}}>
                        <div style={{height:"100%",background:COLORS[e.etapa],borderRadius:4,width:`${pct(e.subtotal)}%`,transition:"width 0.5s"}}/>
                      </div>
                    </div>
                  ))}
                </Card>

                <Card>
                  <p style={{fontSize:12,fontWeight:700,color:"#6b7280",marginBottom:16,textTransform:"uppercase",letterSpacing:1}}>Fluxo Financeiro Recente</p>
                  {transacoes.length===0 ? <p style={{color:"#374151",fontSize:12,textAlign:"center",padding:20,fontFamily:"'IBM Plex Mono',monospace"}}>sem transações registradas</p>
                  : [...transacoes].reverse().slice(0,6).map(t=>(
                    <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #0f1923"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:t.tipo==="Entrada"?"#10b981":"#ef4444"}}/>
                        <div>
                          <p style={{fontSize:12,color:"#e5e7eb",fontWeight:600}}>{t.descricao||t.categoria}</p>
                          <p style={{fontSize:10,color:"#374151",fontFamily:"'IBM Plex Mono',monospace"}}>{t.data} · {t.categoria}</p>
                        </div>
                      </div>
                      <span style={{fontWeight:700,fontSize:12,color:t.tipo==="Entrada"?"#10b981":"#ef4444",fontFamily:"'IBM Plex Mono',monospace"}}>{t.tipo==="Entrada"?"+":"-"}{fmt(parseFloat(t.valor)||0)}</span>
                    </div>
                  ))}
                </Card>
              </div>

              {materiaisAlerta.length>0 && (
                <Card style={{border:"1px solid #f59e0b44"}}>
                  <p style={{fontSize:12,fontWeight:700,color:"#f59e0b",marginBottom:12,display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={13}/>Alertas de Estoque</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {materiaisAlerta.map(m=>(
                      <div key={m.id} style={{background:"#0d1117",borderRadius:8,padding:"8px 14px",border:`1px solid ${statusColor(m.status)}44`}}>
                        <p style={{fontSize:12,fontWeight:700,color:"#e5e7eb"}}>{m.nome}</p>
                        <p style={{fontSize:11,color:statusColor(m.status),fontFamily:"'IBM Plex Mono',monospace"}}>{m.status} · {m.quantidadeEstoque} {m.unidade}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ── ORÇAMENTO ── */}
          {obraAtual && tab==="orcamento" && (
            <div className="anim">
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,gap:12,flexWrap:"wrap"}}>
                <div style={{display:"flex",gap:8,alignItems:"center",flex:1,flexWrap:"wrap"}}>
                  <div style={{position:"relative"}}>
                    <Input value={filtroTexto} onChange={e=>setFiltroTexto(e.target.value)} placeholder="🔍 Buscar item..." style={{paddingRight:32,minWidth:200}}/>
                    {filtroTexto&&<button onClick={()=>setFiltroTexto("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"transparent",border:"none",cursor:"pointer",color:"#6b7280"}}><X size={12}/></button>}
                  </div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    <button onClick={()=>setFiltroEtapa("Todas")} style={{padding:"6px 12px",borderRadius:20,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,background:filtroEtapa==="Todas"?"#10b981":"#111827",color:filtroEtapa==="Todas"?"#fff":"#6b7280"}}>Todas</button>
                    {ETAPAS.filter(et=>rows.some(r=>r.etapa===et)).map(et=>(
                      <button key={et} onClick={()=>setFiltroEtapa(filtroEtapa===et?"Todas":et)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${filtroEtapa===et?COLORS[et]:"#1f2937"}`,cursor:"pointer",fontSize:11,fontWeight:700,background:filtroEtapa===et?COLORS[et]+"22":"#111827",color:filtroEtapa===et?COLORS[et]:"#6b7280"}}>{et}</button>
                    ))}
                  </div>
                </div>
                <Btn onClick={()=>addRow()}><PlusCircle size={14}/>Adicionar Item</Btn>
              </div>

              <div style={{overflowX:"auto",marginBottom:24}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:720}}>
                  <thead><tr style={{background:"#080e17"}}>
                    {["#","Etapa","Descrição","Unidade","Quantidade","Preço Unit.","Total",""].map((h,i)=>(
                      <th key={i} style={{padding:"10px 12px",textAlign:"left",color:"#4b5563",fontWeight:600,borderBottom:"1px solid #1f2937",whiteSpace:"nowrap",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,textTransform:"uppercase"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(() => {
                      const rf = rows.filter(r=>(filtroEtapa==="Todas"||r.etapa===filtroEtapa)&&(!filtroTexto||r.descricao.toLowerCase().includes(filtroTexto.toLowerCase())));
                      const ep = ETAPAS.filter(et=>rf.some(r=>r.etapa===et));
                      if (ep.length===0) return <tr><td colSpan={8} style={{padding:40,textAlign:"center",color:"#374151",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>nenhum item encontrado</td></tr>;
                      let cnt=0;
                      return ep.map(et=>{
                        const itens=rf.filter(r=>r.etapa===et);
                        const sub=itens.reduce((s,r)=>s+rowTotal(r),0);
                        const col=etapasColapsadas[et];
                        return [
                          <tr key={`h-${et}`} onClick={()=>setEtapasColapsadas(e=>({...e,[et]:!e[et]}))} style={{cursor:"pointer",background:`${COLORS[et]}10`,borderLeft:`3px solid ${COLORS[et]}`}}>
                            <td colSpan={5} style={{padding:"10px 12px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <div style={{width:8,height:8,borderRadius:"50%",background:COLORS[et]}}/>
                                <span style={{fontWeight:800,color:COLORS[et],fontSize:12}}>{et}</span>
                                <span style={{background:"#0d1117",borderRadius:20,padding:"2px 8px",fontSize:10,color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{itens.length}</span>
                                {col?<ChevronDown size={12} color="#4b5563"/>:<ChevronUp size={12} color="#4b5563"/>}
                              </div>
                            </td>
                            <td style={{padding:"10px 12px",fontWeight:800,color:COLORS[et],fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(sub)}</td>
                            <td style={{padding:"10px 12px"}}>
                              <button onClick={e=>{e.stopPropagation();addRow(et);}} style={{background:"transparent",border:"none",cursor:"pointer",color:COLORS[et]}}><PlusCircle size={13}/></button>
                            </td>
                          </tr>,
                          ...(!col?itens.map(row=>{cnt++;return(
                            <tr key={row.id} style={{borderBottom:"1px solid #0f1923",background:"#0a1118"}} className="row-hover">
                              <td style={{padding:"8px 12px",color:"#374151",fontFamily:"'IBM Plex Mono',monospace",fontSize:11,paddingLeft:20}}>{cnt}</td>
                              <td style={{padding:"6px 8px"}}>
                                <select value={row.etapa} onChange={e=>updateRow(row.id,"etapa",e.target.value)} style={{background:`${COLORS[row.etapa]}18`,border:`1px solid ${COLORS[row.etapa]}66`,borderRadius:6,color:COLORS[row.etapa],padding:"5px 8px",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                                  {ETAPAS.map(et=><option key={et} value={et} style={{background:"#0d1117",color:"#e5e7eb"}}>{et}</option>)}
                                </select>
                              </td>
                              <td style={{padding:"6px 8px"}}><Input value={row.descricao} onChange={e=>updateRow(row.id,"descricao",e.target.value)} placeholder="Descrição..." style={{minWidth:160,width:"100%",fontSize:12}}/></td>
                              <td style={{padding:"6px 8px"}}><Input value={row.unidade} onChange={e=>updateRow(row.id,"unidade",e.target.value)} placeholder="m²" style={{width:60,fontSize:12}}/></td>
                              <td style={{padding:"6px 8px"}}><Input type="number" value={row.quantidade} onChange={e=>updateRow(row.id,"quantidade",e.target.value)} placeholder="0" style={{width:80,fontSize:12}}/></td>
                              <td style={{padding:"6px 8px"}}><Input type="number" value={row.precoUnit} onChange={e=>updateRow(row.id,"precoUnit",e.target.value)} placeholder="0.00" style={{width:100,fontSize:12}}/></td>
                              <td style={{padding:"10px 12px",fontWeight:800,color:"#34d399",fontFamily:"'IBM Plex Mono',monospace",whiteSpace:"nowrap"}}>{fmt(rowTotal(row))}</td>
                              <td style={{padding:"10px 8px"}}><button onClick={()=>removeRow(row.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#374151"}} onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#374151"}><Trash2 size={13}/></button></td>
                            </tr>
                          );}):[])]
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <Card style={{minWidth:280}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,fontSize:13}}>
                    <span style={{color:"#6b7280"}}>Subtotal</span>
                    <span style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:700}}>{fmt(grandTotal)}</span>
                  </div>
                  <div style={{marginBottom:16}}>
                    <label style={{color:"#6b7280",fontSize:11,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>BDI (%)</label>
                    <Input type="number" min="0" max="100" value={bdi} onChange={e=>updateObra({bdi:e.target.value})} placeholder="25" style={{width:100}}/>
                    {bdiVal>0&&<span style={{color:"#f59e0b",fontSize:12,marginLeft:8,fontFamily:"'IBM Plex Mono',monospace"}}>+{fmt(grandTotal*bdiVal/100)}</span>}
                  </div>
                  <div style={{borderTop:"1px solid #1f2937",paddingTop:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontWeight:800,color:"#10b981"}}>Total Geral</span>
                    <span style={{fontSize:20,fontWeight:800,color:"#34d399",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(bdiVal>0?totalComBdi:grandTotal)}</span>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ── FINANCEIRO ── */}
          {obraAtual && tab==="financeiro" && (
            <div className="anim">
              <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
                <KPI label="Total Entradas" value={fmt(totalEntradas)} color="#10b981" icon="📈"/>
                <KPI label="Total Saídas" value={fmt(totalSaidas)} color="#ef4444" icon="📉"/>
                <KPI label="Saldo" value={fmt(saldo)} color={saldo>=0?"#34d399":"#ef4444"} icon={saldo>=0?"✅":"⚠️"}/>
                <KPI label="% Orçamento Gasto" value={grandTotal>0?`${(totalSaidas/grandTotal*100).toFixed(1)}%`:"–"} color="#f59e0b" icon="⚡"/>
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:4}}>
                  {["Todos","Entrada","Saída",...CATEGORIAS_FINANCEIRO].map(f=>(
                    <button key={f} onClick={()=>setFiltroFinanceiro(f)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${filtroFinanceiro===f?"#10b981":"#1f2937"}`,cursor:"pointer",fontSize:11,fontWeight:700,background:filtroFinanceiro===f?"#10b98122":"#111827",color:filtroFinanceiro===f?"#10b981":"#6b7280"}}>{f}</button>
                  ))}
                </div>
                <Btn onClick={()=>{setNovaTransacao(emptyTransacao());setShowAddTransacao(true)}}><PlusCircle size={14}/>Nova Transação</Btn>
              </div>

              {showAddTransacao && (
                <Card style={{marginBottom:20,border:"1px solid #10b98144"}}>
                  <p style={{fontWeight:800,fontSize:13,color:"#10b981",marginBottom:16}}>Nova Transação</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:12}}>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Data</label><Input type="date" value={novaTransacao.data} onChange={e=>setNovaTransacao(t=>({...t,data:e.target.value}))} style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Tipo</label>
                      <Select value={novaTransacao.tipo} onChange={e=>setNovaTransacao(t=>({...t,tipo:e.target.value}))} style={{width:"100%"}}>
                        {TIPO_TRANSACAO.map(t=><option key={t}>{t}</option>)}
                      </Select>
                    </div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Categoria</label>
                      <Select value={novaTransacao.categoria} onChange={e=>setNovaTransacao(t=>({...t,categoria:e.target.value}))} style={{width:"100%"}}>
                        {CATEGORIAS_FINANCEIRO.map(c=><option key={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Etapa</label>
                      <Select value={novaTransacao.etapa} onChange={e=>setNovaTransacao(t=>({...t,etapa:e.target.value}))} style={{width:"100%"}}>
                        {ETAPAS.map(et=><option key={et}>{et}</option>)}
                      </Select>
                    </div>
                    <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Descrição</label><Input value={novaTransacao.descricao} onChange={e=>setNovaTransacao(t=>({...t,descricao:e.target.value}))} placeholder="Descrição da transação" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Valor (R$)</label><Input type="number" value={novaTransacao.valor} onChange={e=>setNovaTransacao(t=>({...t,valor:e.target.value}))} placeholder="0.00" style={{width:"100%"}}/></div>
                  </div>
                  <Input value={novaTransacao.observacao} onChange={e=>setNovaTransacao(t=>({...t,observacao:e.target.value}))} placeholder="Observação (opcional)" style={{width:"100%",marginBottom:12}}/>
                  <div style={{display:"flex",gap:8}}>
                    <Btn onClick={addTransacao}>Salvar Transação</Btn>
                    <Btn variant="secondary" onClick={()=>setShowAddTransacao(false)}>Cancelar</Btn>
                  </div>
                </Card>
              )}

              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead><tr style={{background:"#080e17"}}>
                    {["Data","Tipo","Categoria","Etapa","Descrição","Valor",""].map((h,i)=>(
                      <th key={i} style={{padding:"10px 12px",textAlign:"left",color:"#4b5563",fontWeight:600,borderBottom:"1px solid #1f2937",whiteSpace:"nowrap",fontFamily:"'IBM Plex Mono',monospace",fontSize:10,textTransform:"uppercase"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {transacoes.filter(t=>filtroFinanceiro==="Todos"||t.tipo===filtroFinanceiro||t.categoria===filtroFinanceiro).length===0
                    ? <tr><td colSpan={7} style={{padding:40,textAlign:"center",color:"#374151",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>nenhuma transação</td></tr>
                    : [...transacoes].reverse().filter(t=>filtroFinanceiro==="Todos"||t.tipo===filtroFinanceiro||t.categoria===filtroFinanceiro).map(t=>(
                      <tr key={t.id} style={{borderBottom:"1px solid #0f1923",background:"#0a1118"}} className="row-hover">
                        <td style={{padding:"10px 12px",color:"#6b7280",fontFamily:"'IBM Plex Mono',monospace",whiteSpace:"nowrap"}}>{t.data}</td>
                        <td style={{padding:"10px 12px"}}><Badge color={t.tipo==="Entrada"?"#10b981":"#ef4444"}>{t.tipo==="Entrada"?"↑":"↓"} {t.tipo}</Badge></td>
                        <td style={{padding:"10px 12px",color:"#9ca3af"}}>{t.categoria}</td>
                        <td style={{padding:"10px 12px"}}><span style={{fontSize:11,color:COLORS[t.etapa]||"#6b7280"}}>{t.etapa}</span></td>
                        <td style={{padding:"10px 12px",color:"#e5e7eb",fontWeight:600}}>{t.descricao||"—"}</td>
                        <td style={{padding:"10px 12px",fontWeight:800,color:t.tipo==="Entrada"?"#34d399":"#ef4444",fontFamily:"'IBM Plex Mono',monospace",whiteSpace:"nowrap"}}>{t.tipo==="Entrada"?"+":"-"}{fmt(parseFloat(t.valor)||0)}</td>
                        <td style={{padding:"10px 8px"}}><button onClick={()=>removeTransacao(t.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:"#374151"}} onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#374151"}><Trash2 size={13}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ESTOQUE ── */}
          {obraAtual && tab==="estoque" && (
            <div className="anim">
              <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
                <KPI label="Total de Materiais" value={materiais.length} color="#8b5cf6" icon="📦"/>
                <KPI label="Valor em Estoque" value={fmt(valorEstoque)} color="#10b981" icon="💎"/>
                <KPI label="Alertas Críticos" value={materiaisAlerta.length} color={materiaisAlerta.length>0?"#ef4444":"#10b981"} icon={materiaisAlerta.length>0?"⚠️":"✅"}/>
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {["Todos",...STATUS_MATERIAL].map(f=>(
                    <button key={f} onClick={()=>setFiltroStatus(f)} style={{padding:"6px 12px",borderRadius:20,border:`1px solid ${filtroStatus===f?(f==="Todos"?"#8b5cf6":statusColor(f)):"#1f2937"}`,cursor:"pointer",fontSize:11,fontWeight:700,background:filtroStatus===f?(f==="Todos"?"#8b5cf622":statusColor(f)+"22"):"#111827",color:filtroStatus===f?(f==="Todos"?"#8b5cf6":statusColor(f)):"#6b7280"}}>{f}</button>
                  ))}
                </div>
                <Btn onClick={()=>{setNovoMaterial(emptyMaterial());setEditMaterialId(null);setShowAddMaterial(true)}}><PlusCircle size={14}/>Novo Material</Btn>
              </div>

              {showAddMaterial && (
                <Card style={{marginBottom:20,border:"1px solid #8b5cf644"}}>
                  <p style={{fontWeight:800,fontSize:13,color:"#8b5cf6",marginBottom:16}}>{editMaterialId?"Editar":"Novo"} Material</p>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:12}}>
                    <div style={{gridColumn:"span 2"}}><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Nome</label><Input value={novoMaterial.nome} onChange={e=>setNovoMaterial(m=>({...m,nome:e.target.value}))} placeholder="Ex: Cimento CP-II" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Categoria</label><Input value={novoMaterial.categoria} onChange={e=>setNovoMaterial(m=>({...m,categoria:e.target.value}))} placeholder="Ex: Estrutural" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Unidade</label><Input value={novoMaterial.unidade} onChange={e=>setNovoMaterial(m=>({...m,unidade:e.target.value}))} placeholder="sc, m², un" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Qtd. em Estoque</label><Input type="number" value={novoMaterial.quantidadeEstoque} onChange={e=>setNovoMaterial(m=>({...m,quantidadeEstoque:e.target.value}))} placeholder="0" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Qtd. Mínima</label><Input type="number" value={novoMaterial.quantidadeMinima} onChange={e=>setNovoMaterial(m=>({...m,quantidadeMinima:e.target.value}))} placeholder="Min. alerta" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Preço Unitário</label><Input type="number" value={novoMaterial.precoUnitario} onChange={e=>setNovoMaterial(m=>({...m,precoUnitario:e.target.value}))} placeholder="0.00" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Fornecedor</label><Input value={novoMaterial.fornecedor} onChange={e=>setNovoMaterial(m=>({...m,fornecedor:e.target.value}))} placeholder="Nome do fornecedor" style={{width:"100%"}}/></div>
                    <div><label style={{fontSize:10,color:"#6b7280",display:"block",marginBottom:4,textTransform:"uppercase"}}>Status</label>
                      <Select value={novoMaterial.status} onChange={e=>setNovoMaterial(m=>({...m,status:e.target.value}))} style={{width:"100%"}}>
                        {STATUS_MATERIAL.map(s=><option key={s}>{s}</option>)}
                      </Select>
                    </div>
                  </div>
                  <Input value={novoMaterial.observacao} onChange={e=>setNovoMaterial(m=>({...m,observacao:e.target.value}))} placeholder="Observação (opcional)" style={{width:"100%",marginBottom:12}}/>
                  <div style={{display:"flex",gap:8}}>
                    <Btn onClick={saveMaterial}>{editMaterialId?"Atualizar":"Salvar"} Material</Btn>
                    <Btn variant="secondary" onClick={()=>{setShowAddMaterial(false);setEditMaterialId(null);}}>Cancelar</Btn>
                  </div>
                </Card>
              )}

              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
                {materiais.filter(m=>filtroStatus==="Todos"||m.status===filtroStatus).map(m=>(
                  <Card key={m.id} style={{borderLeft:`3px solid ${statusColor(m.status)}`}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                      <div>
                        <p style={{fontWeight:800,fontSize:13,color:"#e5e7eb",marginBottom:4}}>{m.nome||"Sem nome"}</p>
                        {m.categoria&&<p style={{fontSize:11,color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{m.categoria}</p>}
                      </div>
                      <Badge color={statusColor(m.status)}>{m.status}</Badge>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                      <div style={{background:"#0d1117",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:10,color:"#4b5563",marginBottom:2,textTransform:"uppercase"}}>Estoque</p>
                        <p style={{fontSize:15,fontWeight:800,color:"#e5e7eb",fontFamily:"'IBM Plex Mono',monospace"}}>{m.quantidadeEstoque||0} <span style={{fontSize:11,color:"#6b7280"}}>{m.unidade}</span></p>
                      </div>
                      <div style={{background:"#0d1117",borderRadius:8,padding:"8px 10px"}}>
                        <p style={{fontSize:10,color:"#4b5563",marginBottom:2,textTransform:"uppercase"}}>Valor Total</p>
                        <p style={{fontSize:13,fontWeight:800,color:"#10b981",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt((parseFloat(m.quantidadeEstoque)||0)*(parseFloat(m.precoUnitario)||0))}</p>
                      </div>
                    </div>
                    {m.quantidadeMinima&&(parseFloat(m.quantidadeEstoque)||0)<(parseFloat(m.quantidadeMinima)||0)&&(
                      <div style={{background:"#f59e0b11",border:"1px solid #f59e0b33",borderRadius:6,padding:"6px 10px",marginBottom:8,fontSize:11,color:"#f59e0b"}}>
                        ⚠️ Abaixo do mínimo ({m.quantidadeMinima} {m.unidade})
                      </div>
                    )}
                    {m.fornecedor&&<p style={{fontSize:11,color:"#4b5563",marginBottom:8,fontFamily:"'IBM Plex Mono',monospace"}}>🏭 {m.fornecedor}</p>}
                    <div style={{display:"flex",gap:6,marginTop:4}}>
                      <Btn variant="secondary" style={{fontSize:11,padding:"5px 12px"}} onClick={()=>editMaterial(m)}>Editar</Btn>
                      <button onClick={()=>removeMaterial(m.id)} style={{background:"transparent",border:"1px solid #1f2937",borderRadius:8,cursor:"pointer",color:"#374151",padding:"5px 10px",fontSize:11}} onMouseEnter={e=>e.currentTarget.style.color="#ef4444"} onMouseLeave={e=>e.currentTarget.style.color="#374151"}><Trash2 size={11}/></button>
                    </div>
                  </Card>
                ))}
                {materiais.filter(m=>filtroStatus==="Todos"||m.status===filtroStatus).length===0&&(
                  <div style={{gridColumn:"1/-1",textAlign:"center",padding:60,color:"#374151",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>nenhum material encontrado</div>
                )}
              </div>
            </div>
          )}

          {/* ── ANALISADOR ── */}
          {obraAtual && tab==="analisador" && (
            <div className="anim">
              <p style={{color:"#6b7280",marginBottom:24,fontSize:13,fontFamily:"'IBM Plex Mono',monospace"}}>Envie foto ou PDF de orçamento, nota fiscal ou foto de obra para extrair itens automaticamente com IA.</p>
              <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}} onClick={()=>!fileName&&fileRef.current.click()}
                style={{border:`2px dashed ${dragging?"#10b981":"#1f2937"}`,borderRadius:16,background:dragging?"#10b98108":"#0d1117",minHeight:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:fileName?"default":"pointer",transition:"all 0.2s",marginBottom:20,position:"relative"}}>
                <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
                {fileName ? (
                  <div style={{width:"100%",textAlign:"center",padding:24,position:"relative"}}>
                    {previewUrl ? <img src={previewUrl} alt="preview" style={{maxHeight:240,maxWidth:"100%",borderRadius:12,objectFit:"contain"}}/> :
                      <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:10,background:"#111827",borderRadius:16,padding:"28px 40px"}}>
                        <span style={{fontSize:48}}>📄</span>
                        <span style={{color:"#10b981",fontWeight:700,fontSize:13,fontFamily:"'IBM Plex Mono',monospace"}}>{fileName}</span>
                      </div>
                    }
                    <button onClick={e=>{e.stopPropagation();clearFile();}} style={{position:"absolute",top:8,right:8,background:"#ef4444",border:"none",borderRadius:"50%",width:26,height:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff"}}><X size={12}/></button>
                  </div>
                ) : (
                  <>
                    <Upload size={32} color="#1f2937" style={{marginBottom:10}}/>
                    <p style={{color:"#4b5563",fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",fontSize:13}}>arraste ou clique para selecionar</p>
                    <div style={{display:"flex",gap:8,marginTop:10}}>
                      {["📷 JPG/PNG","📄 PDF"].map(l=><span key={l} style={{background:"#111827",border:"1px solid #1f2937",borderRadius:20,padding:"3px 12px",fontSize:11,color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{l}</span>)}
                    </div>
                  </>
                )}
              </div>
              {fileName&&!analysisResult&&(
                <div style={{textAlign:"center",marginBottom:20}}>
                  <Btn onClick={analyzeFile} disabled={analyzing} style={{fontSize:14,padding:"12px 28px"}}>
                    {analyzing?<><div style={{width:14,height:14,border:"2px solid #fff",borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> Analisando...</>:"🔍 Analisar com IA"}
                  </Btn>
                </div>
              )}
              {errorMsg&&<div style={{background:"#ef444411",border:"1px solid #ef4444",borderRadius:10,padding:14,marginBottom:16,color:"#fca5a5",fontSize:12,fontFamily:"'IBM Plex Mono',monospace"}}><strong>erro:</strong> {errorMsg}</div>}
              {analysisResult && (
                <Card style={{border:"1px solid #10b98133"}}>
                  <p style={{fontWeight:800,color:"#10b981",marginBottom:16,fontSize:14}}>✅ Análise Concluída</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                    <div style={{background:"#0d1117",borderRadius:10,padding:14}}><p style={{color:"#4b5563",fontSize:10,marginBottom:4,textTransform:"uppercase"}}>Descrição</p><p style={{fontSize:13}}>{analysisResult.descricao}</p></div>
                    <div style={{background:"#0d1117",borderRadius:10,padding:14}}><p style={{color:"#4b5563",fontSize:10,marginBottom:6,textTransform:"uppercase"}}>Etapa Principal</p><Badge color={COLORS[analysisResult.etapa]||"#94a3b8"}>{analysisResult.etapa}</Badge></div>
                  </div>
                  {analysisResult.observacoes&&<div style={{background:"#0d1117",borderRadius:10,padding:14,marginBottom:16}}><p style={{color:"#4b5563",fontSize:10,marginBottom:4,textTransform:"uppercase"}}>Observações</p><p style={{fontSize:12,color:"#9ca3af"}}>{analysisResult.observacoes}</p></div>}
                  {analysisResult.itens_sugeridos?.length>0&&(
                    <>
                      <p style={{color:"#4b5563",fontSize:10,marginBottom:8,textTransform:"uppercase"}}>{analysisResult.itens_sugeridos.length} Itens Encontrados</p>
                      <div style={{overflowX:"auto",marginBottom:16}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead><tr style={{background:"#0d1117"}}>
                            {["Etapa","Descrição","Un","Qtd","Preço","c/Desc","Total"].map(h=><th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#4b5563",fontWeight:600,borderBottom:"1px solid #1f2937",fontSize:10,textTransform:"uppercase"}}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {analysisResult.itens_sugeridos.map((it,i)=>{
                              const desc=parseFloat(it.precoDesconto)||parseFloat(it.precoUnit)||0;
                              const tot=(parseFloat(it.quantidade)||0)*desc;
                              return <tr key={i} style={{borderBottom:"1px solid #0f1923"}}>
                                <td style={{padding:"8px 10px"}}><Badge color={COLORS[matchEtapa(it.etapa)]||"#94a3b8"}>{matchEtapa(it.etapa)}</Badge></td>
                                <td style={{padding:"8px 10px",maxWidth:200,fontSize:11}}>{it.descricao}</td>
                                <td style={{padding:"8px 10px",color:"#6b7280"}}>{it.unidade}</td>
                                <td style={{padding:"8px 10px",color:"#6b7280"}}>{it.quantidade}</td>
                                <td style={{padding:"8px 10px",color:"#6b7280",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(parseFloat(it.precoUnit)||0)}</td>
                                <td style={{padding:"8px 10px",color:"#f59e0b",fontWeight:700,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(desc)}</td>
                                <td style={{padding:"8px 10px",color:"#34d399",fontWeight:800,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(tot)}</td>
                              </tr>;
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Btn onClick={importItems}><PlusCircle size={14}/>Importar para Orçamento</Btn>
                    </>
                  )}
                </Card>
              )}
            </div>
          )}

          {/* ── RESUMO ── */}
          {obraAtual && tab==="resumo" && (
            <div className="anim">
              {byEtapa.length===0 ? (
                <div style={{textAlign:"center",padding:80,color:"#374151",fontFamily:"'IBM Plex Mono',monospace",fontSize:12}}>
                  <BarChart2 size={48} style={{margin:"0 auto 16px",display:"block",opacity:0.3}}/>
                  sem dados no orçamento
                </div>
              ) : (
                <>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,marginBottom:28}}>
                    {byEtapa.map(e=>(
                      <Card key={e.etapa} style={{borderLeft:`3px solid ${COLORS[e.etapa]}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                          <div style={{width:8,height:8,borderRadius:"50%",background:COLORS[e.etapa]}}/>
                          <span style={{fontWeight:800,fontSize:12}}>{e.etapa}</span>
                        </div>
                        <div style={{fontSize:16,fontWeight:800,color:COLORS[e.etapa],marginBottom:4,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(e.subtotal)}</div>
                        <div style={{fontSize:11,color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{pct(e.subtotal)}% · {e.items.length} {e.items.length===1?"item":"itens"}</div>
                        <div style={{marginTop:8,height:3,background:"#0d1117",borderRadius:4}}><div style={{height:"100%",borderRadius:4,background:COLORS[e.etapa],width:`${pct(e.subtotal)}%`}}/></div>
                      </Card>
                    ))}
                  </div>

                  <Card style={{marginBottom:24}}>
                    <p style={{fontSize:11,fontWeight:700,color:"#4b5563",marginBottom:16,textTransform:"uppercase",letterSpacing:1}}>Distribuição de Custos</p>
                    {byEtapa.sort((a,b)=>b.subtotal-a.subtotal).map(e=>(
                      <div key={e.etapa} style={{marginBottom:12}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                          <span style={{color:"#9ca3af",fontWeight:700}}>{e.etapa}</span>
                          <span style={{color:COLORS[e.etapa],fontWeight:800,fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(e.subtotal)} <span style={{color:"#374151"}}>({pct(e.subtotal)}%)</span></span>
                        </div>
                        <div style={{height:16,background:"#0d1117",borderRadius:6,overflow:"hidden"}}>
                          <div style={{height:"100%",background:`linear-gradient(90deg,${COLORS[e.etapa]}88,${COLORS[e.etapa]})`,width:`${pct(e.subtotal)}%`,borderRadius:6,transition:"width 0.5s"}}/>
                        </div>
                      </div>
                    ))}
                  </Card>

                  <div>
                    {byEtapa.map(e=>(
                      <Card key={e.etapa} style={{marginBottom:10,border:`1px solid ${COLORS[e.etapa]}22`}}>
                        <div onClick={()=>setExpanded(ex=>({...ex,[e.etapa]:!ex[e.etapa]}))} style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:10,height:10,borderRadius:"50%",background:COLORS[e.etapa]}}/>
                            <span style={{fontWeight:800,fontSize:13}}>{e.etapa}</span>
                            <span style={{background:"#0d1117",borderRadius:20,padding:"2px 8px",fontSize:10,color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{e.items.length}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:12}}>
                            <span style={{fontWeight:800,color:COLORS[e.etapa],fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(e.subtotal)}</span>
                            {expanded[e.etapa]?<ChevronUp size={14} color="#4b5563"/>:<ChevronDown size={14} color="#4b5563"/>}
                          </div>
                        </div>
                        {expanded[e.etapa]&&(
                          <div style={{marginTop:12,overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                              <thead><tr style={{background:"#0d1117"}}>
                                {["Descrição","Un","Qtd","Preço","Total"].map(h=><th key={h} style={{padding:"7px 12px",textAlign:"left",color:"#374151",fontWeight:600,fontSize:10,textTransform:"uppercase"}}>{h}</th>)}
                              </tr></thead>
                              <tbody>
                                {e.items.map(row=>(
                                  <tr key={row.id} style={{borderTop:"1px solid #0f1923"}}>
                                    <td style={{padding:"7px 12px",color:"#9ca3af"}}>{row.descricao||"—"}</td>
                                    <td style={{padding:"7px 12px",color:"#4b5563"}}>{row.unidade}</td>
                                    <td style={{padding:"7px 12px",color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{row.quantidade||"—"}</td>
                                    <td style={{padding:"7px 12px",color:"#4b5563",fontFamily:"'IBM Plex Mono',monospace"}}>{row.precoUnit?fmt(parseFloat(row.precoUnit)):"—"}</td>
                                    <td style={{padding:"7px 12px",fontWeight:800,color:"#34d399",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(rowTotal(row))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>

                  <Card style={{marginTop:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <p style={{color:"#4b5563",fontSize:11,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Total Geral {bdiVal>0?`com BDI ${bdiVal}%`:"sem BDI"}</p>
                      <p style={{fontSize:28,fontWeight:800,color:"#34d399",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(bdiVal>0?totalComBdi:grandTotal)}</p>
                    </div>
                    {bdiVal>0&&<div style={{textAlign:"right"}}>
                      <p style={{color:"#4b5563",fontSize:11,marginBottom:4,textTransform:"uppercase",letterSpacing:1}}>Sem BDI</p>
                      <p style={{fontSize:18,fontWeight:700,color:"#6b7280",fontFamily:"'IBM Plex Mono',monospace"}}>{fmt(grandTotal)}</p>
                    </div>}
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
