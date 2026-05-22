import { useState, useEffect, useMemo } from 'react'
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, LineChart, Line, Legend 
} from 'recharts'
import { 
  TrendingUp, DollarSign, AlertCircle, CheckCircle2, Clock, 
  Users, Calendar, RefreshCw, Search, ArrowLeft, ChevronRight 
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
const fmtF = d => {
  if(!d) return '-'
  const s = String(d).slice(0,10).split('-')
  if(s.length<3) return d
  return parseInt(s[2])+' '+MESES[parseInt(s[1])-1]+' '+s[0].slice(2)
}
const hoyStr = () => new Date().toISOString().slice(0,10)

export default function App() {
  const [data, setData] = useState({ prestamos: [], cuotas: [] })
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(null)
  const [vista, setVista] = useState('home') // home | cliente | cuotas
  const [clienteSel, setClienteSel] = useState(null)
  const [filtroCuotas, setFiltroCuotas] = useState('todas')
  const [busqueda, setBusqueda] = useState('')

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
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ accion: tipo, ...payload })
      })
      const json = await res.json()
      if(!json.ok) throw new Error(json.error)
      await cargar()
    } catch(e) { alert('Error: '+e.message) }
  }

  // Calculos
  const stats = useMemo(() => {
    const hoy = hoyStr()
    const d7 = new Date(); d7.setDate(d7.getDate()+7)
    const lim7 = d7.toISOString().slice(0,10)
    let tp=0, ti=0, tr=0, tpend=0, mora=0, prox=0
    let cuotasMora=[], cuotasProx=[]
    data.prestamos.forEach(p => { tp += p.capital||0; ti += p.totalInt||0 })
    data.cuotas.forEach(c => {
      const v = c.valor||0
      if(c.estado==='PAGADA') tr += v
      else {
        tpend += v
        if(c.estado==='MORA' || c.fecha < hoy) { mora += v; cuotasMora.push(c) }
        else if(c.fecha <= lim7) { prox += v; cuotasProx.push(c) }
      }
    })
    return { tp, ti, tr, tpend, mora, prox, cuotasMora, cuotasProx }
  }, [data])

  // Resumen por cliente
  const clientes = useMemo(() => {
    const map = {}
    data.prestamos.forEach(p => {
      if(!map[p.cliente]) map[p.cliente] = { nombre: p.cliente, capital:0, prestamos:0, activos:0, mora:false, prestamoIds:[] }
      map[p.cliente].capital += p.capital||0
      map[p.cliente].prestamos++
      map[p.cliente].prestamoIds.push(p.id)
      const cp = data.cuotas.filter(c => c.idP === p.id)
      const tienePend = cp.some(c => c.estado !== 'PAGADA')
      if(tienePend) map[p.cliente].activos++
      const hoy = hoyStr()
      if(cp.some(c => c.estado!=='PAGADA' && (c.estado==='MORA'||c.fecha<hoy))) map[p.cliente].mora = true
    })
    return Object.values(map).sort((a,b) => b.capital - a.capital)
  }, [data])

  // Datos para grafico de cartera por estado
  const dataPie = useMemo(() => {
    const recaudado = stats.tr
    const porCobrar = stats.tpend - stats.mora - stats.prox
    return [
      { name: 'Recaudado', value: recaudado, color: '#2e8b57' },
      { name: 'Por cobrar', value: Math.max(0, porCobrar), color: '#d4956a' },
      { name: 'Proximos 7d', value: stats.prox, color: '#1a73e8' },
      { name: 'En mora', value: stats.mora, color: '#d23b3b' }
    ].filter(d => d.value > 0)
  }, [stats])

  // Cobranza por mes (proyeccion)
  const dataMes = useMemo(() => {
    const m = {}
    data.cuotas.forEach(c => {
      const ym = String(c.fecha).slice(0,7)
      if(!m[ym]) m[ym] = { mes: ym, pagado:0, pendiente:0 }
      if(c.estado === 'PAGADA') m[ym].pagado += c.valor||0
      else m[ym].pendiente += c.valor||0
    })
    return Object.values(m).sort((a,b) => a.mes < b.mes ? -1 : 1).map(d => ({
      ...d, label: MESES[parseInt(d.mes.slice(5,7))-1]+' '+d.mes.slice(2,4)
    }))
  }, [data])

  if(loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
      <div style={{textAlign:'center'}}>
        <RefreshCw size={40} className="spin" style={{color:'var(--accent)',marginBottom:16}} />
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

  if(vista === 'cliente' && clienteSel) {
    return <VistaCliente cliente={clienteSel} data={data} onBack={()=>{setVista('home');setClienteSel(null)}} onAccion={accion} />
  }

  if(vista === 'cuotas') {
    return <VistaCuotas data={data} filtro={filtroCuotas} setFiltro={setFiltroCuotas} busqueda={busqueda} setBusqueda={setBusqueda} onBack={()=>setVista('home')} onAccion={accion} />
  }

  return (
    <div style={{minHeight:'100vh',padding:'20px 16px',maxWidth:1200,margin:'0 auto'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24,flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={{fontSize:28,fontWeight:800,color:'var(--text)'}}>Prestamos <span style={{color:'var(--accent)'}}>2026</span></h1>
          <div style={{fontSize:13,color:'var(--muted)',marginTop:4}}>{data.prestamos.length} prestamos activos · Actualizado ahora</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <a href={API_URL.replace(/\?.*$/,'')} style={{...btnSec,textDecoration:'none',display:'inline-flex',alignItems:'center',gap:6}}>
            <DollarSign size={16}/> Calculadora
          </a>
          <button onClick={cargar} style={{...btnSec,display:'inline-flex',alignItems:'center',gap:6}}>
            <RefreshCw size={16}/> Actualizar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:20}}>
        <KPI icon={<DollarSign size={18}/>} label="Total prestado" valor={fmt(stats.tp)} color="var(--text)" />
        <KPI icon={<TrendingUp size={18}/>} label="Ganancia esperada" valor={fmt(stats.ti)} color="var(--green)" />
        <KPI icon={<CheckCircle2 size={18}/>} label="Recaudado" valor={fmt(stats.tr)} color="var(--green)" />
        <KPI icon={<Clock size={18}/>} label="Por cobrar" valor={fmt(stats.tpend)} color="var(--gold)" />
        <KPI icon={<AlertCircle size={18}/>} label="En mora" valor={fmt(stats.mora)} color="var(--red)" alarm={stats.mora>0} />
      </div>

      {/* Graficos */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))',gap:16,marginBottom:20}}>
        <Card titulo="Estado de cartera">
          {dataPie.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={dataPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={d => d.name}>
                  {dataPie.map((e,i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Vacio msg="Sin datos" />}
        </Card>
        <Card titulo="Cobranza por mes">
          {dataMes.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dataMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0e6d8" />
                <XAxis dataKey="label" tick={{fontSize:11}} />
                <YAxis tick={{fontSize:11}} tickFormatter={fmtK} />
                <Tooltip formatter={v => fmt(v)} />
                <Legend wrapperStyle={{fontSize:12}}/>
                <Bar dataKey="pagado" fill="#2e8b57" name="Pagado" />
                <Bar dataKey="pendiente" fill="#d4956a" name="Pendiente" />
              </BarChart>
            </ResponsiveContainer>
          ) : <Vacio msg="Sin datos" />}
        </Card>
      </div>

      {/* Alertas */}
      {(stats.cuotasMora.length>0 || stats.cuotasProx.length>0) && (
        <Card titulo="Alertas">
          {stats.cuotasMora.length>0 && (
            <div style={alertaMora} onClick={()=>{setFiltroCuotas('mora');setVista('cuotas')}}>
              <AlertCircle size={20} />
              <div style={{flex:1}}>
                <strong>{stats.cuotasMora.length} cuota(s) en mora</strong> · {fmt(stats.mora)}
              </div>
              <ChevronRight size={18} />
            </div>
          )}
          {stats.cuotasProx.length>0 && (
            <div style={alertaProx} onClick={()=>{setFiltroCuotas('prox');setVista('cuotas')}}>
              <Clock size={20} />
              <div style={{flex:1}}>
                <strong>{stats.cuotasProx.length} cuota(s) vencen en 7 dias</strong> · {fmt(stats.prox)}
              </div>
              <ChevronRight size={18} />
            </div>
          )}
        </Card>
      )}

      {/* Clientes */}
      <Card titulo={`Clientes (${clientes.length})`} accion={
        <button onClick={()=>setVista('cuotas')} style={btnLink}>Ver todas las cuotas</button>
      }>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
          {clientes.map(c => (
            <div key={c.nombre} style={tarjetaCliente} onClick={()=>{setClienteSel(c);setVista('cliente')}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'start',marginBottom:8}}>
                <div style={{fontWeight:700,fontSize:14,color:'var(--text)'}}>{c.nombre}</div>
                {c.mora && <span style={badge('mora')}>MORA</span>}
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

function VistaCliente({ cliente, data, onBack, onAccion }) {
  const prestamosCliente = data.prestamos.filter(p => p.cliente === cliente.nombre)
  return (
    <div style={{minHeight:'100vh',padding:'20px 16px',maxWidth:1000,margin:'0 auto'}}>
      <button onClick={onBack} style={{...btnSec,marginBottom:16,display:'inline-flex',alignItems:'center',gap:6}}>
        <ArrowLeft size={16}/> Volver
      </button>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:4}}>{cliente.nombre}</h2>
      <div style={{color:'var(--muted)',fontSize:13,marginBottom:20}}>
        {cliente.prestamos} prestamo{cliente.prestamos>1?'s':''} · {fmt(cliente.capital)} en total
      </div>
      {prestamosCliente.map(p => {
        const cuotasP = data.cuotas.filter(c => c.idP === p.id).sort((a,b) => a.num - b.num)
        const pagadas = cuotasP.filter(c => c.estado === 'PAGADA').length
        return (
          <Card key={p.id} titulo={`${p.mod} · ${p.nC} cuotas · ${fmt(p.capital)}`}>
            <div style={{display:'flex',gap:12,marginBottom:12,flexWrap:'wrap',fontSize:12}}>
              <span><strong>Entregado:</strong> {fmt(p.entregado)}</span>
              <span><strong>Interes:</strong> {p.tasa}</span>
              <span><strong>Cuota:</strong> {fmt(p.cuotaFija)}</span>
              <span><strong>Progreso:</strong> {pagadas}/{cuotasP.length}</span>
            </div>
            <div style={{width:'100%',height:8,background:'#f0e6d8',borderRadius:4,overflow:'hidden',marginBottom:16}}>
              <div style={{height:'100%',width:`${(pagadas/cuotasP.length)*100}%`,background:'var(--green)',transition:'width .3s'}} />
            </div>
            <TablaCuotas cuotas={cuotasP} onAccion={onAccion} />
          </Card>
        )
      })}
    </div>
  )
}

function VistaCuotas({ data, filtro, setFiltro, busqueda, setBusqueda, onBack, onAccion }) {
  const hoy = hoyStr()
  const d7 = new Date(); d7.setDate(d7.getDate()+7)
  const lim7 = d7.toISOString().slice(0,10)
  let lista = data.cuotas.slice()
  if(filtro === 'pend') lista = lista.filter(c => c.estado==='PENDIENTE' && c.fecha >= hoy)
  if(filtro === 'mora') lista = lista.filter(c => c.estado !== 'PAGADA' && (c.estado === 'MORA' || c.fecha < hoy))
  if(filtro === 'prox') lista = lista.filter(c => c.estado !== 'PAGADA' && c.fecha >= hoy && c.fecha <= lim7)
  if(filtro === 'pag') lista = lista.filter(c => c.estado === 'PAGADA')
  if(busqueda) lista = lista.filter(c => c.cliente.toLowerCase().includes(busqueda.toLowerCase()))
  lista.sort((a,b) => a.fecha < b.fecha ? -1 : 1)

  return (
    <div style={{minHeight:'100vh',padding:'20px 16px',maxWidth:1200,margin:'0 auto'}}>
      <button onClick={onBack} style={{...btnSec,marginBottom:16,display:'inline-flex',alignItems:'center',gap:6}}>
        <ArrowLeft size={16}/> Volver
      </button>
      <h2 style={{fontSize:24,fontWeight:800,marginBottom:16}}>Control de cuotas</h2>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
        {[['todas','Todas'],['pend','Pendientes'],['mora','En mora'],['prox','Proximos 7d'],['pag','Pagadas']].map(([k,l]) => (
          <button key={k} onClick={()=>setFiltro(k)} style={filtro===k?btnFilOn:btnFil}>{l}</button>
        ))}
      </div>
      <div style={{position:'relative',marginBottom:16}}>
        <Search size={16} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)'}}/>
        <input type="text" placeholder="Buscar cliente..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} style={inputStyle}/>
      </div>
      <Card titulo={`${lista.length} cuota${lista.length!==1?'s':''}`}>
        <TablaCuotas cuotas={lista} onAccion={onAccion} mostrarCliente />
      </Card>
    </div>
  )
}

function TablaCuotas({ cuotas, onAccion, mostrarCliente }) {
  const hoy = hoyStr()
  const d7 = new Date(); d7.setDate(d7.getDate()+7)
  const lim7 = d7.toISOString().slice(0,10)
  if(cuotas.length === 0) return <Vacio msg="Sin cuotas en este filtro" />
  
  const accionPagar = (fila) => {
    if(!confirm('Confirmar pago de esta cuota?')) return
    onAccion('pagar', { fila, fechaPago: hoyStr() })
  }
  const accionMora = (fila) => {
    const obs = prompt('Observacion (opcional):') || ''
    onAccion('mora', { fila, observacion: obs })
  }
  
  return (
    <div style={{overflowX:'auto'}}>
      <table style={tabla}>
        <thead>
          <tr>
            {mostrarCliente && <th style={th}>Cliente</th>}
            <th style={th}>#</th>
            <th style={th}>Vence</th>
            <th style={th}>Valor</th>
            <th style={th}>Estado</th>
            <th style={th}>Accion</th>
          </tr>
        </thead>
        <tbody>
          {cuotas.map(c => {
            let estadoBadge, tipoBadge
            if(c.estado==='PAGADA') { estadoBadge='Pagada'; tipoBadge='pag' }
            else if(c.estado==='MORA' || c.fecha < hoy) { estadoBadge='Mora'; tipoBadge='mora' }
            else if(c.fecha <= lim7) { estadoBadge='Proxima'; tipoBadge='prox' }
            else { estadoBadge='Pendiente'; tipoBadge='pend' }
            return (
              <tr key={c.fila}>
                {mostrarCliente && <td style={td}>{c.cliente}</td>}
                <td style={td}>{c.num}</td>
                <td style={td}>{fmtF(c.fecha)}</td>
                <td style={{...td,fontWeight:600}}>{fmt(c.valor)}</td>
                <td style={td}><span style={badge(tipoBadge)}>{estadoBadge}</span></td>
                <td style={td}>
                  {c.estado === 'PAGADA' ? (
                    <span style={{fontSize:11,color:'var(--muted)'}}>{fmtF(c.fPago)}</span>
                  ) : (
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

function KPI({ icon, label, valor, color, alarm }) {
  return (
    <div style={{...card,padding:14,borderColor:alarm?'#f5b5b5':'var(--border)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,color:'var(--muted)',fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:6}}>
        {icon} {label}
      </div>
      <div style={{fontSize:18,fontWeight:800,color}}>{valor}</div>
    </div>
  )
}

function Card({ titulo, accion, children }) {
  return (
    <div style={{...card,padding:18,marginBottom:14}}>
      {(titulo || accion) && (
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          {titulo && <h3 style={{fontSize:11,fontWeight:700,letterSpacing:'0.15em',textTransform:'uppercase',color:'var(--accent)'}}>{titulo}</h3>}
          {accion}
        </div>
      )}
      {children}
    </div>
  )
}

function Vacio({ msg }) {
  return <div style={{textAlign:'center',padding:'40px 20px',color:'var(--muted)',fontSize:13}}>{msg}</div>
}

// Estilos
const card = { background:'#fff', border:'1px solid var(--border)', borderRadius:14 }
const btnPrim = { background:'var(--accent)', color:'#fff', border:'none', padding:'10px 18px', borderRadius:10, fontSize:14, fontWeight:700 }
const btnSec = { background:'#fff', color:'var(--text)', border:'1.5px solid var(--border)', padding:'8px 14px', borderRadius:10, fontSize:13, fontWeight:600 }
const btnFil = { background:'var(--bg)', border:'1.5px solid var(--border)', color:'var(--muted)', padding:'7px 14px', borderRadius:999, fontSize:12, fontWeight:700 }
const btnFilOn = { ...btnFil, borderColor:'var(--accent)', background:'rgba(192,84,90,0.08)', color:'var(--accent)' }
const btnLink = { background:'none', border:'none', color:'var(--blue)', fontSize:12, fontWeight:600, cursor:'pointer' }
const btnPagar = { background:'var(--green)', color:'#fff', border:'none', padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700 }
const btnMora = { background:'var(--red)', color:'#fff', border:'none', padding:'5px 10px', borderRadius:6, fontSize:11, fontWeight:700 }
const tabla = { width:'100%', borderCollapse:'collapse', fontSize:13 }
const th = { textAlign:'left', padding:'10px 8px', fontSize:10, letterSpacing:'0.1em', color:'var(--accent)', textTransform:'uppercase', fontWeight:700, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }
const td = { padding:'10px 8px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }
const tarjetaCliente = { background:'var(--bg)', border:'1.5px solid var(--border)', borderRadius:10, padding:14, cursor:'pointer', transition:'all .15s' }
const inputStyle = { width:'100%', padding:'10px 14px 10px 36px', background:'#fff', border:'1.5px solid var(--border)', borderRadius:10, fontSize:13, outline:'none' }
const alertaMora = { display:'flex', alignItems:'center', gap:10, background:'#fdecec', border:'1px solid #f5b5b5', borderRadius:10, padding:'12px 14px', marginBottom:8, color:'#c0392b', cursor:'pointer', fontSize:13 }
const alertaProx = { ...alertaMora, background:'#e7f0fd', border:'1px solid #a8c5f0', color:'#1a56b5' }

const badge = tipo => {
  const colores = {
    pag: { bg:'#e8f6ee', color:'#1a6b3a' },
    mora: { bg:'#fdecec', color:'#c0392b' },
    prox: { bg:'#e7f0fd', color:'#1a56b5' },
    pend: { bg:'#fff4e0', color:'#b5790f' }
  }
  const c = colores[tipo] || colores.pend
  return { background:c.bg, color:c.color, fontSize:10, fontWeight:700, padding:'3px 8px', borderRadius:999, textTransform:'uppercase', letterSpacing:'0.05em', display:'inline-block' }
}
