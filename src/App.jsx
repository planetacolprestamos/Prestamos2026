import { useState, useEffect, useMemo, useRef } from 'react'
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts'
import { 
  TrendingUp, DollarSign, AlertCircle, CheckCircle2, Clock, 
  RefreshCw, Search, ArrowLeft, ChevronRight, Calculator, X
} from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || ''

const fmt = n => '$' + Math.round(Number(n)||0).toLocaleString('es-CO')
const fmtK = n => {
  const v = Math.round(Number(n)||0)
  if(v >= 1000000) return '$'+(v/1000000).toFixed(1)+'M'
  if(v >= 1000) return '$'+(v/1000).toFixed(0)+'K'
  return '$'+v
}
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const fmtF = d => {
  if(!d) return '-'
  const s = String(d).slice(0,10).split('-')
  if(s.length<3) return d
  return parseInt(s[2])+' '+MESES[parseInt(s[1])-1]+' '+s[0].slice(2)
}
const fmtFLargo = d => {
  if(!d) return '—'
  const [y,m,dia] = String(d).slice(0,10).split('-')
  return parseInt(dia)+' de '+MESES_ES[parseInt(m)-1]+' de '+y
}
const hoyStr = () => new Date().toISOString().slice(0,10)

// ── CALCULADORA ──────────────────────────────────────────────────────────────

const MODS_CALC = {
  diario:    {ops:[20,30,40,50,60]},
  semanal:   {ops:[2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40]},
  quincenal: {ops:[2,3,4,5,6,7,8,9,10,11,12]},
  mensual:   {ops:[1,2,3,4,6,7,8,9,10,11,12]}
}

function sigFecha(fActual, mod, fInicio, jornada) {
  const d = new Date(fActual+'T12:00:00')
  if(mod==='diario'){
    d.setDate(d.getDate()+1)
    let r = d.toISOString().slice(0,10)
    while(true){
      const dia = new Date(r+'T12:00:00').getDay()
      const ok = jornada==='lv' ? (dia>=1&&dia<=5) : (dia>=2&&dia<=6)
      if(ok) break
      const dd = new Date(r+'T12:00:00'); dd.setDate(dd.getDate()+1)
      r = dd.toISOString().slice(0,10)
    }
    return r
  }
  if(mod==='semanal'){ d.setDate(d.getDate()+7); return d.toISOString().slice(0,10) }
  if(mod==='quincenal'){
    const dia = d.getDate()
    if(dia<=15){ const ult=new Date(d.getFullYear(),d.getMonth()+1,0); return ult.toISOString().slice(0,10) }
    else { const sig=new Date(d.getFullYear(),d.getMonth()+1,15); return sig.toISOString().slice(0,10) }
  }
  if(mod==='mensual'){
    const diaOrigen = new Date(fInicio+'T12:00:00').getDate()
    d.setMonth(d.getMonth()+1)
    const ult = new Date(d.getFullYear(),d.getMonth()+1,0).getDate()
    d.setDate(Math.min(diaOrigen,ult))
    return d.toISOString().slice(0,10)
  }
  return fActual
}

function cierreMes(fInicio, m){
  const d = new Date(fInicio+'T12:00:00')
  d.setDate(d.getDate()+30*m)
  return d.toISOString().slice(0,10)
}

function calcularPrestamo({nombre, capital, tasa, mod, nC, fInicio, f1, jornada}){
  const entregado = capital - capital*tasa
  const capXC = capital/nC
  const fechas = [f1]
  for(let i=1;i<nC;i++) fechas.push(sigFecha(fechas[i-1], mod, fInicio, jornada))
  const mesDe = fechas.map(f=>{ let m=0; while(f>cierreMes(fInicio,m+1)) m++; return m })
  const totalMeses = mesDe[mesDe.length-1]+1
  let totalCobrar=0, saldoM=capital
  const resMeses=[]
  for(let m=0;m<totalMeses;m++){
    const cEM=mesDe.filter(x=>x===m).length
    const intM=m===0?capital*tasa:saldoM*tasa
    const capM=capXC*cEM
    totalCobrar+=m===0?capM:capM+intM
    resMeses.push({mes:m+1,int:intM,saldo:saldoM,nc:cEM})
    saldoM=Math.max(0,saldoM-capM)
  }
  const totalInt=resMeses.reduce((s,r)=>s+r.int,0)
  const cuotaFija=Math.ceil((totalCobrar/nC)/1000)*1000
  const intXC=[]
  resMeses.forEach(r=>{ const ix=r.nc>0?(r.mes===1?0:r.int)/r.nc:0; for(let q=0;q<r.nc;q++) intXC.push(ix) })
  let saldoCap=capital, acum=0
  const cuotas=[]
  for(let i=0;i<nC;i++){
    saldoCap=Math.max(0,saldoCap-capXC)
    const esUlt=i===nC-1
    const total=esUlt?totalCobrar-acum:cuotaFija
    cuotas.push({num:i+1,fecha:fechas[i],cap:capXC,int:intXC[i],total,saldo:saldoCap})
    if(!esUlt) acum+=cuotaFija
  }
  return {nombre,capital,entregado,mod,nC,tasa,fInicio,cuotaFija,totalInt,totalCobrar,cuotas,resMeses}
}

function Calculadora({ onClose, apiUrl }) {
  const [mod, setMod] = useState('quincenal')
  const [nSel, setNSel] = useState(4)
  const [jornada, setJornada] = useState('lv')
  const [resultado, setResultado] = useState(null)
  const [msgSheets, setMsgSheets] = useState(null)
  const [aprobando, setAprobando] = useState(false)
  const [tab, setTab] = useState('int')
  const fmtCOP = n => '$'+Math.round(n).toLocaleString('es-CO')

  const chips = MODS_CALC[mod]?.ops || []

  const calcular = () => {
    const nombre = document.getElementById('c-nombre').value.trim()||'Cliente'
    const capital = parseFloat(document.getElementById('c-capital').value)
    const tasa = parseFloat(document.getElementById('c-tasa').value)/100
    const fInicio = document.getElementById('c-finicio').value || document.getElementById('c-f1').value
    const f1 = document.getElementById('c-f1').value || fInicio
    if(!capital||capital<=0){ alert('Ingresa un monto válido'); return }
    const r = calcularPrestamo({nombre,capital,tasa,mod,nC:nSel,fInicio,f1,jornada})
    setResultado(r)
    setMsgSheets(null)
    setTimeout(()=>document.getElementById('calc-res')?.scrollIntoView({behavior:'smooth'}),100)
  }

  const aprobar = async () => {
    if(!resultado) return
    setAprobando(true)
    setMsgSheets({tipo:'info', txt:'Registrando en Google Sheets...'})
    try {
      const intAnticipado = resultado.resMeses[0]?.int || 0
      const payload = {
        accion: 'guardar',
        datos: {
          nombre: resultado.nombre,
          capital: resultado.capital,
          entregado: resultado.entregado,
          intAnticipado: Math.round(intAnticipado),
          tasa: resultado.tasa*100,
          mod: resultado.mod,
          nC: resultado.nC,
          fInicio: resultado.fInicio,
          f1: resultado.cuotas[0]?.fecha || resultado.fInicio,
          cuotaFija: resultado.cuotaFija,
          totalCobrar: resultado.totalCobrar,
          totalInt: Math.round(resultado.totalInt),
          cuotas: resultado.cuotas.map(c=>({num:c.num,fecha:c.fecha,total:Math.round(c.total),cap:Math.round(c.cap),int:Math.round(c.int)}))
        }
      }
      const res = await fetch(apiUrl, { method:'POST', body: JSON.stringify(payload) })
      const json = await res.json()
      if(!json.ok) throw new Error(json.error||'Error al registrar')
      setMsgSheets({tipo:'ok', txt:'✅ Préstamo registrado en Google Sheets'})
    } catch(e) {
      setMsgSheets({tipo:'err', txt:'❌ Error: '+e.message})
    }
    setAprobando(false)
  }

  const imprimir = () => {
    if(!resultado) return
    const d = resultado
    const fmt2 = n => '$'+Math.round(n).toLocaleString('es-CO')
    const filas = d.cuotas.map(c=>`<tr><td style="text-align:center">${c.num}</td><td>${fmtFLargo(c.fecha)}</td><td style="text-align:right">${fmt2(Math.round(c.cap))}</td><td style="text-align:right">${fmt2(Math.round(c.int))}</td><td style="text-align:right;font-weight:700">${fmt2(Math.round(c.total))}</td><td style="text-align:right">${fmt2(Math.round(c.saldo))}</td></tr>`).join('')
    const filasCliente = d.cuotas.map(c=>`<tr><td style="text-align:center">${c.num}</td><td>${fmtFLargo(c.fecha)}</td><td style="text-align:right;font-weight:700">${fmt2(Math.round(c.total))}</td><td style="height:36px">&nbsp;</td><td style="height:36px">&nbsp;</td></tr>`).join('')
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Documentos</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;font-size:11px;color:#111;padding:20px}h2{font-size:14px;margin-bottom:4px}h3{font-size:11px;color:#555;font-weight:normal;margin-bottom:12px}table{width:100%;border-collapse:collapse;margin-bottom:12px}th{background:#f0e6d8;padding:5px 7px;text-align:left;font-size:9px;letter-spacing:.08em;text-transform:uppercase;border:1px solid #ddd}td{padding:5px 7px;border:1px solid #ddd;font-size:10px}.section{margin-bottom:32px;page-break-inside:avoid}.row2{display:flex;gap:16px;margin-bottom:8px}.kv{flex:1;background:#fafafa;border:1px solid #ddd;border-radius:4px;padding:6px 10px}.kv .k{font-size:8px;color:#888;text-transform:uppercase;letter-spacing:.08em}.kv .v{font-size:12px;font-weight:700;margin-top:2px}.check{border:1px solid #ccc;border-radius:4px;padding:10px 14px;margin-bottom:8px}.check-title{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#888;margin-bottom:8px}.check-item{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:11px}.box{width:14px;height:14px;border:1.5px solid #555;border-radius:2px;display:inline-block;flex-shrink:0}.ganancia{color:#2e8b57;font-weight:700}.page-break{page-break-before:always;padding-top:24px;margin-top:8px}@media print{body{padding:10px}}</style></head><body><div class="section"><h2>Control interno de credito</h2><h3>Documento confidencial</h3><div class="row2"><div class="kv"><div class="k">Cliente</div><div class="v">${d.nombre}</div></div><div class="kv"><div class="k">Capital aprobado</div><div class="v">${fmt2(d.capital)}</div></div><div class="kv"><div class="k">Valor entregado</div><div class="v">${fmt2(d.entregado)}</div></div></div><div class="row2"><div class="kv"><div class="k">Modalidad</div><div class="v">${d.mod} — ${d.nC} cuotas</div></div><div class="kv"><div class="k">Cuota nivelada</div><div class="v">${fmt2(d.cuotaFija)}</div></div><div class="kv"><div class="k">Total intereses (ganancia)</div><div class="v ganancia">${fmt2(Math.round(d.totalInt))}</div></div></div><div class="check"><div class="check-title">Requisitos verificados</div><div class="check-item"><span class="box"></span> Cedula</div><div class="check-item"><span class="box"></span> Antecedentes</div><div class="check-item"><span class="box"></span> Letra</div></div><table><thead><tr><th>#</th><th>Fecha</th><th>Abono capital</th><th>Interes</th><th>Cuota</th><th>Saldo capital</th></tr></thead><tbody>${filas}</tbody><tfoot><tr style="background:#fdf0f0;font-weight:700"><td colspan="2">TOTAL</td><td style="text-align:right">${fmt2(d.capital)}</td><td style="text-align:right">${fmt2(Math.round(d.totalInt-d.capital*d.tasa))}</td><td style="text-align:right">${fmt2(d.totalCobrar)}</td><td style="text-align:right">$0</td></tr></tfoot></table></div><div class="section page-break"><h2>Plan de pagos — ${d.nombre}</h2><h3>Fecha de inicio: ${fmtFLargo(d.fInicio)}</h3><table><thead><tr><th>#</th><th>Fecha de pago</th><th>Valor</th><th>Recibido</th><th>Firma cliente</th></tr></thead><tbody>${filasCliente}</tbody></table><p style="font-size:9px;color:#888;margin-top:8px">El pago se realiza en efectivo y en la oficina en la fecha acordada. Es responsabilidad del cliente presentarse a pagar. Si por fuerza mayor no puede venir debe avisar con anticipacion ya que consignar genera un cargo adicional.</p></div><script>window.print();<\/script></body></html>`
    const blob = new Blob([html],{type:'text/html;charset=utf-8'})
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.target='_blank'
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(()=>URL.revokeObjectURL(url),10000)
  }

  const wInt = resultado ? (() => {
    const d = resultado
    let wi='GESTIÓN INTERNA — APROBACIÓN DE CRÉDITO\n━━━━━━━━━━━━━━━━━━━━\n'
    wi+='Cliente: '+d.nombre+'\nCapital aprobado: '+fmtCOP(d.capital)+'\nValor entregado: '+fmtCOP(d.entregado)+'\nModalidad: '+d.mod+' | '+d.nC+' cuotas\nCuota nivelada: '+fmtCOP(d.cuotaFija)+'\n━━━━━━━━━━━━━━━━━━━━\nDESGLOSE DE INTERESES:\n\n'
    d.resMeses.forEach(r=>{ wi+=r.mes===1?'  Mes 1 — Cobrado anticipado al entregar: '+fmtCOP(Math.round(r.int))+'\n':'  Mes '+r.mes+' — Sobre saldo '+fmtCOP(r.saldo)+': '+fmtCOP(Math.round(r.int))+'\n' })
    wi+='\nTotal intereses: '+fmtCOP(Math.round(d.totalInt))+'\nCapital a recuperar en cuotas: '+fmtCOP(d.capital)+'\n━━━━━━━━━━━━━━━━━━━━\nFECHAS DE PAGO:\n\n'
    d.cuotas.forEach(c=>{ wi+='  '+c.num+'. '+fmtFLargo(c.fecha)+' — '+fmtCOP(Math.round(c.total))+' (saldo: '+fmtCOP(Math.round(c.saldo))+')\n' })
    wi+='\n━━━━━━━━━━━━━━━━━━━━\nDocumento confidencial. No compartir.'
    return wi
  })() : ''

  const wCli = resultado ? (() => {
    const d = resultado
    let wc='Señor(a) '+d.nombre+',\n\nLe informamos que su plan de pagos está activo.\n\nSu cuota es de '+fmtCOP(d.cuotaFija)+' con frecuencia de pago '+d.mod+'.\n\nFECHAS DE PAGO:\n\n'
    d.cuotas.forEach(c=>{ wc+='  '+c.num+'. '+fmtFLargo(c.fecha)+' — '+fmtCOP(Math.round(c.total))+'\n' })
    wc+='\nCondiciones:\n\n1. El pago se realiza en efectivo y en la oficina en la fecha acordada.\n\n2. Es responsabilidad del cliente presentarse a pagar. No se realizan cobros a domicilio ni se sale a buscar al cliente.\n\n3. Si por fuerza mayor no puede venir debe avisar con anticipación ya que consignar genera un cargo adicional.\n\n4. El incumplimiento o la ausencia sin aviso genera ajustes en su plan de pagos.\n\nGracias por su compromiso.'
    return wc
  })() : ''

  const copiar = (txt, id) => {
    navigator.clipboard.writeText(txt).then(()=>{
      const b = document.getElementById(id)
      const o = b.textContent; b.textContent='✅ Copiado'
      setTimeout(()=>b.textContent=o, 2000)
    })
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:1000,overflowY:'auto',padding:'20px 12px'}}>
      <div style={{maxWidth:820,margin:'0 auto',background:'var(--bg)',borderRadius:20,padding:24,position:'relative'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <div>
            <h2 style={{fontSize:22,fontWeight:800}}>Calculadora de <span style={{color:'var(--accent)'}}>Préstamos</span></h2>
            <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Gestiona tu cartera con facilidad 💼</div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted)'}}>
            <X size={24}/>
          </button>
        </div>

        {/* Datos del préstamo */}
        <div style={cCard}>
          <div style={cTitle}>📋 Datos del préstamo</div>
          <div style={g2}>
            <div>
              <label style={lbl}>Nombre del cliente</label>
              <input id="c-nombre" type="text" placeholder="Ej: María García" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Capital a prestar ($)</label>
              <input id="c-capital" type="number" placeholder="Ej: 500000" min="1" style={inp}/>
            </div>
          </div>
          <div style={g2}>
            <div>
              <label style={lbl}>Tasa de interés mensual</label>
              <select id="c-tasa" style={inp}>
                {[3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(v=><option key={v} value={v} selected={v===5}>{v}%</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Modalidad de pago</label>
              <select style={inp} value={mod} onChange={e=>{setMod(e.target.value);setNSel(MODS_CALC[e.target.value].ops[1]||MODS_CALC[e.target.value].ops[0])}}>
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
          </div>
          {mod==='diario' && (
            <div style={{marginBottom:12}}>
              <label style={lbl}>Jornada</label>
              <select style={inp} value={jornada} onChange={e=>setJornada(e.target.value)}>
                <option value="lv">Lunes a viernes</option>
                <option value="ms">Martes a sábado</option>
              </select>
            </div>
          )}
          <div style={{marginBottom:12}}>
            <label style={lbl}>Número de cuotas</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {chips.map(n=>(
                <label key={n} style={{cursor:'pointer',fontSize:13,fontWeight:600,color:nSel===n?'var(--accent)':'var(--muted)',background:nSel===n?'rgba(192,84,90,0.08)':'var(--bg)',border:nSel===n?'1.5px solid var(--accent)':'1.5px solid var(--border)',padding:'5px 12px',borderRadius:999,transition:'all .15s'}}>
                  <input type="radio" name="nc-calc" value={n} checked={nSel===n} onChange={()=>setNSel(n)} style={{display:'none'}}/>{n}
                </label>
              ))}
            </div>
          </div>
          <div style={g2}>
            <div>
              <label style={lbl}>Fecha inicio préstamo</label>
              <input id="c-finicio" type="date" style={inp}/>
            </div>
            <div>
              <label style={lbl}>Fecha 1ª cuota</label>
              <input id="c-f1" type="date" style={inp}/>
            </div>
          </div>
          <button onClick={calcular} style={btnCalc}>✨ Calcular préstamo</button>
        </div>

        {/* Resultado */}
        {resultado && (
          <div id="calc-res">
            {/* Resumen */}
            <div style={cCard}>
              <div style={cTitle}>📊 Resumen del crédito</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:10,marginBottom:10}}>
                <Stat l="💼 Capital aprobado" v={fmtCOP(resultado.capital)} />
                <Stat l="📤 Valor a entregar" v={fmtCOP(resultado.entregado)} c="var(--green)"/>
                {resultado.resMeses.map(r=>(
                  <Stat key={r.mes} l={r.mes===1?'✅ Interés mes 1 — cobrado hoy':'📅 Interés mes '+r.mes+' — sobre '+fmtCOP(r.saldo)} v={fmtCOP(Math.round(r.int))} c="var(--gold)"/>
                ))}
                <Stat l="💰 Total intereses" v={fmtCOP(Math.round(resultado.totalInt))} c="var(--accent)"/>
                <Stat l="📋 Cuota del préstamo" v={fmtCOP(resultado.cuotaFija)} c="var(--green)"/>
              </div>
              <div style={{background:'rgba(212,149,106,0.1)',border:'1px solid rgba(212,149,106,0.3)',borderRadius:10,padding:'10px 14px',fontSize:12,color:'var(--warn)'}}>
                ⚠️ El interés del mes 1 fue cobrado al entregar el dinero. Los meses siguientes se recaudan dentro de las cuotas.
              </div>
            </div>

            {/* Tabla */}
            <div style={cCard}>
              <div style={cTitle}>🗓️ Tabla de cuotas</div>
              <div style={{overflowX:'auto',borderRadius:10,border:'1px solid var(--border)'}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead><tr style={{background:'rgba(192,84,90,0.07)'}}>
                    {['#','Fecha','Abono capital','Interés real','Cuota','Saldo capital'].map(h=><th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:10,letterSpacing:'.1em',color:'var(--accent)',textTransform:'uppercase',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {resultado.cuotas.map((c,i)=>(
                      <tr key={c.num} style={{background:i%2?'rgba(212,149,106,0.06)':''}}>
                        <td style={tdC}>{c.num}</td>
                        <td style={tdC}>{fmtFLargo(c.fecha)}</td>
                        <td style={tdC}>{fmtCOP(Math.round(c.cap))}</td>
                        <td style={tdC}>{fmtCOP(Math.round(c.int))}</td>
                        <td style={{...tdC,fontWeight:700}}>{fmtCOP(Math.round(c.total))}</td>
                        <td style={tdC}>{fmtCOP(Math.round(c.saldo))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr style={{background:'rgba(192,84,90,0.07)'}}>
                    <td colSpan={2} style={{...tdC,fontWeight:700,color:'var(--accent)'}}>TOTAL</td>
                    <td style={{...tdC,fontWeight:700,color:'var(--accent)'}}>{fmtCOP(resultado.capital)}</td>
                    <td style={{...tdC,fontWeight:700,color:'var(--accent)'}}>{fmtCOP(Math.round(resultado.totalInt-resultado.capital*resultado.tasa))}</td>
                    <td style={{...tdC,fontWeight:700,color:'var(--accent)'}}>{fmtCOP(resultado.totalCobrar)}</td>
                    <td style={{...tdC,fontWeight:700,color:'var(--accent)'}}>$0</td>
                  </tr></tfoot>
                </table>
              </div>
            </div>

            {/* Acciones */}
            <div style={cCard}>
              <div style={cTitle}>📋 Acciones</div>
              <button onClick={imprimir} style={{...btnCalc,background:'#2e8b57',boxShadow:'0 4px 14px rgba(46,139,87,0.25)',marginBottom:10}}>
                🖨️ Imprimir control interno y hoja del cliente
              </button>
              <button onClick={aprobar} disabled={aprobando} style={{...btnCalc,background:'#1a73e8',boxShadow:'0 4px 14px rgba(26,115,232,0.25)'}}>
                📊 Aprobar y registrar en Google Sheets
              </button>
              {msgSheets && (
                <div style={{marginTop:10,padding:'10px 14px',borderRadius:8,fontSize:13,background:msgSheets.tipo==='ok'?'#e8f6ee':msgSheets.tipo==='err'?'#fdecec':'#e7f0fd',color:msgSheets.tipo==='ok'?'#1a6b3a':msgSheets.tipo==='err'?'#c0392b':'#1a56b5'}}>
                  {msgSheets.txt}
                </div>
              )}
            </div>

            {/* WhatsApp */}
            <div style={cCard}>
              <div style={cTitle}>📱 Mensajes WhatsApp</div>
              <div style={{display:'flex',gap:8,borderBottom:'2px solid var(--border)',marginBottom:14}}>
                {[['int','🔒 Interno'],['cli','👤 Cliente']].map(([k,l])=>(
                  <button key={k} onClick={()=>setTab(k)} style={{background:'none',border:'none',fontWeight:700,fontSize:13,color:tab===k?'var(--accent)':'var(--muted)',padding:'8px 12px',cursor:'pointer',borderBottom:tab===k?'2px solid var(--accent)':'2px solid transparent',marginBottom:-2}}>
                    {l}
                  </button>
                ))}
              </div>
              {tab==='int' && (
                <>
                  <pre style={{background:'#fdf0f0',border:'1.5px solid #e8a0a4',borderRadius:12,padding:14,fontSize:11,lineHeight:1.8,whiteSpace:'pre-wrap',wordBreak:'break-word',fontFamily:'monospace'}}>{wInt}</pre>
                  <button id="cb-int" onClick={()=>copiar(wInt,'cb-int')} style={btnCopy}>📋 Copiar interno</button>
                </>
              )}
              {tab==='cli' && (
                <>
                  <pre style={{background:'#f0fff4',border:'1.5px solid #a8d5b5',borderRadius:12,padding:14,fontSize:11,lineHeight:1.8,whiteSpace:'pre-wrap',wordBreak:'break-word',fontFamily:'monospace'}}>{wCli}</pre>
                  <button id="cb-cli" onClick={()=>copiar(wCli,'cb-cli')} style={btnCopy}>📋 Copiar cliente</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({l,v,c}) {
  return (
    <div style={{background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:12,padding:'10px 14px',flex:1,minWidth:140}}>
      <div style={{fontSize:10,letterSpacing:'.1em',color:'var(--muted)',textTransform:'uppercase',fontWeight:700,marginBottom:4}}>{l}</div>
      <div style={{fontSize:15,fontWeight:700,color:c||'var(--text)'}}>{v}</div>
    </div>
  )
}

const cCard = {background:'#fff',border:'1px solid var(--border)',borderRadius:16,padding:20,marginBottom:14,boxShadow:'0 4px 20px rgba(192,84,90,0.07)'}
const cTitle = {fontSize:11,letterSpacing:'.2em',color:'var(--accent)',textTransform:'uppercase',fontWeight:700,marginBottom:14}
const g2 = {display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}
const lbl = {display:'block',fontSize:11,fontWeight:700,letterSpacing:'.07em',color:'var(--muted)',textTransform:'uppercase',marginBottom:6}
const inp = {width:'100%',background:'#fdf6f0',border:'1.5px solid var(--border)',color:'var(--text)',fontFamily:'system-ui,sans-serif',fontSize:14,padding:'10px 12px',borderRadius:10,outline:'none',boxSizing:'border-box'}
const btnCalc = {background:'var(--accent)',color:'#fff',border:'none',fontFamily:'system-ui,sans-serif',fontWeight:700,fontSize:14,padding:'12px 20px',borderRadius:12,cursor:'pointer',width:'100%',boxShadow:'0 4px 14px rgba(192,84,90,0.25)'}
const tdC = {padding:'8px 10px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap',fontSize:12}
const btnCopy = {background:'transparent',border:'1.5px solid #25D366',color:'#1a8c47',fontFamily:'system-ui,sans-serif',fontWeight:700,fontSize:12,padding:'8px 16px',borderRadius:10,cursor:'pointer',marginTop:10}

// ── DASHBOARD ────────────────────────────────────────────────────────────────

export default function App() {
  const [data, setData] = useState({ prestamos: [], cuotas: [] })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [vista, setVista] = useState('home')
  const [clienteSel, setClienteSel] = useState(null)
  const [filtroCuotas, setFiltroCuotas] = useState('todas')
  const [busqueda, setBusqueda] = useState('')
  const [showCalc, setShowCalc] = useState(false)

  const cargar = async () => {
    setLoading(true); setErr(null)
    try {
      const res = await fetch(API_URL + '?page=api&t=' + Date.now())
      const json = await res.json()
      if(!json.ok) throw new Error(json.error||'Error')
      setData({ prestamos: json.prestamos||[], cuotas: json.cuotas||[] })
    } catch(e) { setErr(e.message) }
    setLoading(false)
  }

  useEffect(() => { cargar() }, [])

  const accion = async (tipo, payload) => {
    try {
      const res = await fetch(API_URL, { method:'POST', body: JSON.stringify({ accion: tipo, ...payload }) })
      const json = await res.json()
      if(!json.ok) throw new Error(json.error)
      await cargar()
    } catch(e) { alert('Error: '+e.message) }
  }

  const stats = useMemo(() => {
    const hoy = hoyStr()
    const d7 = new Date(); d7.setDate(d7.getDate()+7)
    const lim7 = d7.toISOString().slice(0,10)
    let tp=0, ti=0, tr=0, tpend=0, mora=0, prox=0, cuotasMora=[], cuotasProx=[]
    data.prestamos.forEach(p => { tp+=p.capital||0; ti+=p.totalInt||0 })
    data.cuotas.forEach(c => {
      const v=c.valor||0
      if(c.estado==='PAGADA') tr+=v
      else { tpend+=v; if(c.estado==='MORA'||c.fecha<hoy){mora+=v;cuotasMora.push(c)} else if(c.fecha<=lim7){prox+=v;cuotasProx.push(c)} }
    })
    return {tp,ti,tr,tpend,mora,prox,cuotasMora,cuotasProx}
  }, [data])

  const clientes = useMemo(() => {
    const map = {}
    data.prestamos.forEach(p => {
      if(!map[p.cliente]) map[p.cliente]={nombre:p.cliente,capital:0,prestamos:0,activos:0,mora:false,prestamoIds:[]}
      map[p.cliente].capital+=p.capital||0
      map[p.cliente].prestamos++
      map[p.cliente].prestamoIds.push(p.id)
      const cp=data.cuotas.filter(c=>c.idP===p.id)
      if(cp.some(c=>c.estado!=='PAGADA')) map[p.cliente].activos++
      const hoy=hoyStr()
      if(cp.some(c=>c.estado!=='PAGADA'&&(c.estado==='MORA'||c.fecha<hoy))) map[p.cliente].mora=true
    })
    return Object.values(map).sort((a,b)=>b.capital-a.capital)
  }, [data])

  const dataPie = useMemo(() => {
    const porCobrar = stats.tpend - stats.mora - stats.prox
    return [
      {name:'Recaudado',value:stats.tr,color:'#2e8b57'},
      {name:'Por cobrar',value:Math.max(0,porCobrar),color:'#d4956a'},
      {name:'Proximos 7d',value:stats.prox,color:'#1a73e8'},
      {name:'En mora',value:stats.mora,color:'#d23b3b'}
    ].filter(d=>d.value>0)
  }, [stats])

  const dataMes = useMemo(() => {
    const m={}
    data.cuotas.forEach(c=>{
      const ym=String(c.fecha).slice(0,7)
      if(!m[ym]) m[ym]={mes:ym,pagado:0,pendiente:0}
      if(c.estado==='PAGADA') m[ym].pagado+=c.valor||0
      else m[ym].pendiente+=c.valor||0
    })
    return Object.values(m).sort((a,b)=>a.mes<b.mes?-1:1).map(d=>({...d,label:MESES[parseInt(d.mes.slice(5,7))-1]+' '+d.mes.slice(2,4)}))
  }, [data])

  if(loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{textAlign:'center'}}>
        <RefreshCw size={40} className="spin" style={{color:'var(--accent)',marginBottom:16}}/>
        <div style={{color:'var(--muted)',fontSize:14}}>Cargando datos...</div>
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if(err) return (
    <div style={{minHeight:'100vh',padding:24}}>
      <div style={{background:'#fff',border:'1px solid #f5b5b5',borderRadius:12,padding:24,maxWidth:600,margin:'40px auto'}}>
        <h2 style={{color:'var(--red)',marginBottom:8}}>Error al cargar</h2>
        <p style={{color:'var(--muted)',marginBottom:16}}>{err}</p>
        <button onClick={cargar} style={btnPrim}>Reintentar</button>
      </div>
    </div>
  )

  if(vista==='cliente'&&clienteSel) return <VistaCliente cliente={clienteSel} data={data} onBack={()=>{setVista('home');setClienteSel(null)}} onAccion={accion}/>
  if(vista==='cuotas') return <VistaCuotas data={data} filtro={filtroCuotas} setFiltro={setFiltroCuotas} busqueda={busqueda} setBusqueda={setBusqueda} onBack={()=>setVista('home')} onAccion={accion}/>

  return (
    <div style={{minHeight:'100vh',padding:'20px 16px',maxWidth:1200,margin:'0 auto'}}>
      {showCalc && <Calculadora onClose={()=>setShowCalc(false)} apiUrl={API_URL}/>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,color:'var(--text)'}}>Prestamos <span style={{color:'var(--accent)'}}>2026</span></h1>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>{data.prestamos.length} prestamos activos · Actualizado ahora</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowCalc(true)} style={{...btnSec,display:'inline-flex',alignItems:'center',gap:6}}>
            <Calculator size={16}/> Calculadora
          </button>
          <button onClick={cargar} style={{...btnSec,display:'inline-flex',alignItems:'center',gap:6}}>
            <RefreshCw size={16}/> Actualizar
          </button>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        <KPI icon={<DollarSign size={18}/>} label="Total prestado" valor={fmt(stats.tp)} color="var(--text)"/>
        <KPI icon={<TrendingUp size={18}/>} label="Ganancia esperada" valor={fmt(stats.ti)} color="var(--green)"/>
        <KPI icon={<CheckCircle2 size={18}/>} label="Recaudado" valor={fmt(stats.tr)} color="var(--green)"/>
        <KPI icon={<Clock size={18}/>} label="Por cobrar" valor={fmt(stats.tpend)} color="var(--gold)"/>
        <KPI icon={<AlertCircle size={18}/>} label="En mora" valor={fmt(stats.mora)} color="var(--red)" alarm={stats.mora>0}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16,marginBottom:20}}>
        <Card titulo="Estado de cartera">
          {dataPie.length>0?(
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={dataPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={d=>d.name}>
                {dataPie.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie><Tooltip formatter={v=>fmt(v)}/></PieChart>
            </ResponsiveContainer>
          ):<Vacio msg="Sin datos"/>}
        </Card>
        <Card titulo="Cobranza por mes">
          {dataMes.length>0?(
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dataMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d8"/>
                <XAxis dataKey="label" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}} tickFormatter={fmtK}/>
                <Tooltip formatter={v=>fmt(v)}/>
                <Legend wrapperStyle={{fontSize:12}}/>
                <Bar dataKey="pagado" fill="#2e8b57" name="Pagado"/>
                <Bar dataKey="pendiente" fill="#d4956a" name="Pendiente"/>
              </BarChart>
            </ResponsiveContainer>
          ):<Vacio msg="Sin datos"/>}
        </Card>
      </div>

      {(stats.cuotasMora.length>0||stats.cuotasProx.length>0)&&(
        <Card titulo="Alertas">
          {stats.cuotasMora.length>0&&(
            <div style={alertaMora} onClick={()=>{setFiltroCuotas('mora');setVista('cuotas')}}>
              <AlertCircle size={20}/><div style={{flex:1}}><strong>{stats.cuotasMora.length} cuota(s) en mora</strong> · {fmt(stats.mora)}</div><ChevronRight size={18}/>
            </div>
          )}
          {stats.cuotasProx.length>0&&(
            <div style={alertaProx} onClick={()=>{setFiltroCuotas('prox');setVista('cuotas')}}>
              <Clock size={20}/><div style={{flex:1}}><strong>{stats.cuotasProx.length} cuota(s) vencen en 7 dias</strong> · {fmt(stats.prox)}</div><ChevronRight size={18}/>
            </div>
          )}
        </Card>
      )}

      <Card titulo={`Clientes (${clientes.length})`} accion={
        <button onClick={()=>setVista('cuotas')} style={btnLink}>Ver todas las cuotas</button>
      }>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
          {clientes.map(c=>(
            <div key={c.nombre} style={tarjetaCliente} onClick={()=>{setClienteSel(c);setVista('cliente')}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{c.nombre}</div>
                {c.mora&&<span style={badge('mora')}>MORA</span>}
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--muted)'}}>
                <span>{c.prestamos} prestamo{c.prestamos>1?'s':''}</span>
                <span>{c.activos} activo{c.activos!==1?'s':''}</span>
              </div>
              <div style={{marginTop:8,fontSize:16,fontWeight:700,color:'var(--accent)'}}>{fmt(c.capital)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function VistaCliente({cliente,data,onBack,onAccion}){
  const prestamosCliente=data.prestamos.filter(p=>p.cliente===cliente.nombre)
  return(
    <div style={{minHeight:'100vh',padding:'20px 16px',maxWidth:1000,margin:'0 auto'}}>
      <button onClick={onBack} style={{...btnSec,marginBottom:16,display:'inline-flex',alignItems:'center',gap:6}}><ArrowLeft size={16}/> Volver</button>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:4}}>{cliente.nombre}</h2>
      <div style={{color:'var(--muted)',fontSize:13,marginBottom:20}}>{cliente.prestamos} prestamo{cliente.prestamos>1?'s':''} · {fmt(cliente.capital)} en total</div>
      {prestamosCliente.map(p=>{
        const cuotasP=data.cuotas.filter(c=>c.idP===p.id).sort((a,b)=>a.num-b.num)
        const pagadas=cuotasP.filter(c=>c.estado==='PAGADA').length
        return(
          <Card key={p.id} titulo={`${p.mod} · ${p.nC} cuotas · ${fmt(p.capital)}`}>
            <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap',fontSize:12}}>
              <span><strong>Entregado:</strong> {fmt(p.entregado)}</span>
              <span><strong>Interes:</strong> {p.tasa}</span>
              <span><strong>Cuota:</strong> {fmt(p.cuotaFija)}</span>
              <span><strong>Progreso:</strong> {pagadas}/{cuotasP.length}</span>
            </div>
            <div style={{width:'100%',height:8,background:'#f0e6d8',borderRadius:4,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',width:`${(pagadas/cuotasP.length)*100}%`,background:'var(--green)',transition:'width .3s'}}/>
            </div>
            <TablaCuotas cuotas={cuotasP} onAccion={onAccion}/>
          </Card>
        )
      })}
    </div>
  )
}

function VistaCuotas({data,filtro,setFiltro,busqueda,setBusqueda,onBack,onAccion}){
  const hoy=hoyStr()
  const d7=new Date(); d7.setDate(d7.getDate()+7)
  const lim7=d7.toISOString().slice(0,10)
  let lista=data.cuotas.slice()
  if(filtro==='pend') lista=lista.filter(c=>c.estado==='PENDIENTE'&&c.fecha>=hoy)
  if(filtro==='mora') lista=lista.filter(c=>c.estado!=='PAGADA'&&(c.estado==='MORA'||c.fecha<hoy))
  if(filtro==='prox') lista=lista.filter(c=>c.estado!=='PAGADA'&&c.fecha>=hoy&&c.fecha<=lim7)
  if(filtro==='pag') lista=lista.filter(c=>c.estado==='PAGADA')
  if(busqueda) lista=lista.filter(c=>c.cliente.toLowerCase().includes(busqueda.toLowerCase()))
  lista.sort((a,b)=>a.fecha<b.fecha?-1:1)
  return(
    <div style={{minHeight:'100vh',padding:'20px 16px',maxWidth:1200,margin:'0 auto'}}>
      <button onClick={onBack} style={{...btnSec,marginBottom:16,display:'inline-flex',alignItems:'center',gap:6}}><ArrowLeft size={16}/> Volver</button>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:16}}>Control de cuotas</h2>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {[['todas','Todas'],['pend','Pendientes'],['mora','En mora'],['prox','Proximos 7d'],['pag','Pagadas']].map(([k,l])=>(
          <button key={k} onClick={()=>setFiltro(k)} style={filtro===k?btnFilOn:btnFil}>{l}</button>
        ))}
      </div>
      <div style={{position:'relative',marginBottom:16}}>
        <Search size={16} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
        <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={inputStyle}/>
      </div>
      <Card titulo={`${lista.length} cuota${lista.length!==1?'s':''}`}>
        <TablaCuotas cuotas={lista} onAccion={onAccion} mostrarCliente/>
      </Card>
    </div>
  )
}

function TablaCuotas({cuotas,onAccion,mostrarCliente}){
  const hoy=hoyStr()
  const d7=new Date(); d7.setDate(d7.getDate()+7)
  const lim7=d7.toISOString().slice(0,10)
  if(cuotas.length===0) return <Vacio msg="Sin cuotas en este filtro"/>
  const accionPagar=fila=>{ if(!confirm('Confirmar pago de esta cuota?')) return; onAccion('pagar',{fila,fechaPago:hoyStr()}) }
  const accionMora=fila=>{ const obs=prompt('Observacion (opcional):')||''; onAccion('mora',{fila,observacion:obs}) }
  return(
    <div style={{overflowX:'auto'}}>
      <table style={tabla}>
        <thead><tr>
          {mostrarCliente&&<th style={th}>Cliente</th>}
          <th style={th}>#</th><th style={th}>Vence</th><th style={th}>Valor</th><th style={th}>Estado</th><th style={th}>Accion</th>
        </tr></thead>
        <tbody>
          {cuotas.map(c=>{
            let estadoBadge,tipoBadge
            if(c.estado==='PAGADA'){estadoBadge='Pagada';tipoBadge='pag'}
            else if(c.estado==='MORA'||c.fecha<hoy){estadoBadge='Mora';tipoBadge='mora'}
            else if(c.fecha<=lim7){estadoBadge='Proxima';tipoBadge='prox'}
            else{estadoBadge='Pendiente';tipoBadge='pend'}
            return(
              <tr key={c.fila}>
                {mostrarCliente&&<td style={td}>{c.cliente}</td>}
                <td style={td}>{c.num}</td>
                <td style={td}>{fmtF(c.fecha)}</td>
                <td style={{...td,fontWeight:600}}>{fmt(c.valor)}</td>
                <td style={td}><span style={badge(tipoBadge)}>{estadoBadge}</span></td>
                <td style={td}>
                  {c.estado==='PAGADA'?<span style={{fontSize:11,color:'var(--muted)'}}>{fmtF(c.fPago)}</span>:(
                    <div style={{display:'flex',gap:4}}>
                      <button onClick={()=>accionPagar(c.fila)} style={btnPagar}>Pagar</button>
                      <button onClick={()=>accionMora(c.fila)} style={btnMora}>Mora</button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function KPI({icon,label,valor,color,alarm}){
  return(
    <div style={{...card,padding:14,borderColor:alarm?'#f5b5b5':'var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--muted)',fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>{icon} {label}</div>
      <div style={{fontSize:18,fontWeight:800,color}}>{valor}</div>
    </div>
  )
}

function Card({titulo,accion,children}){
  return(
    <div style={{...card,padding:18,marginBottom:14}}>
      {(titulo||accion)&&(
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          {titulo&&<h3 style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--accent)'}}>{titulo}</h3>}
          {accion}
        </div>
      )}
      {children}
    </div>
  )
}

function Vacio({msg}){return <div style={{textAlign:'center',padding:'40px 20px',color:'var(--muted)',fontSize:13}}>{msg}</div>}

const card={background:'#fff',border:'1px solid var(--border)',borderRadius:14}
const btnPrim={background:'var(--accent)',color:'#fff',border:'none',padding:'10px 18px',borderRadius:10,fontSize:14,fontWeight:700}
const btnSec={background:'#fff',color:'var(--text)',border:'1.5px solid var(--border)',padding:'8px 14px',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer'}
const btnFil={background:'var(--bg)',border:'1.5px solid var(--border)',color:'var(--muted)',padding:'7px 14px',borderRadius:999,fontSize:12,fontWeight:700,cursor:'pointer'}
const btnFilOn={...btnFil,borderColor:'var(--accent)',background:'rgba(192,84,90,0.08)',color:'var(--accent)'}
const btnLink={background:'none',border:'none',color:'var(--blue)',fontSize:12,fontWeight:600,cursor:'pointer'}
const btnPagar={background:'var(--green)',color:'#fff',border:'none',padding:'5px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}
const btnMora={background:'var(--red)',color:'#fff',border:'none',padding:'5px 10px',borderRadius:6,fontSize:11,fontWeight:700,cursor:'pointer'}
const tabla={width:'100%',borderCollapse:'collapse',fontSize:13}
const th={textAlign:'left',padding:'10px 8px',fontSize:10,letterSpacing:'0.1em',color:'var(--accent)',textTransform:'uppercase',fontWeight:700,borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}
const td={padding:'10px 8px',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap'}
const tarjetaCliente={background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:10,padding:14,cursor:'pointer',transition:'all .15s'}
const inputStyle={width:'100%',padding:'10px 14px 10px 36px',background:'#fff',border:'1.5px solid var(--border)',borderRadius:10,fontSize:13,outline:'none'}
const alertaMora={display:'flex',alignItems:'center',gap:10,background:'#fdecec',border:'1px solid #f5b5b5',borderRadius:10,padding:'12px 14px',marginBottom:8,color:'#c0392b',cursor:'pointer',fontSize:13}
const alertaProx={...alertaMora,background:'#e7f0fd',border:'1px solid #a8c5f0',color:'#1a56b5'}
const badge=tipo=>{
  const colores={pag:{bg:'#e8f6ee',color:'#1a6b3a'},mora:{bg:'#fdecec',color:'#c0392b'},prox:{bg:'#e7f0fd',color:'#1a56b5'},pend:{bg:'#fff4e0',color:'#b5790f'}}
  const c=colores[tipo]||colores.pend
  return{background:c.bg,color:c.color,fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:999,textTransform:'uppercase',letterSpacing:'0.05em',display:'inline-block'}
}
