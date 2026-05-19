'use client'
import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { usePocketFlow } from '@/lib/store'
import { format,startOfMonth,endOfMonth,startOfWeek,endOfWeek,eachDayOfInterval,isToday,isSameMonth,parseISO,isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowLeft } from 'lucide-react'

export default function CalendarioPage(){
  const router=useRouter(); const {incomeSources,incomeEntries}=usePocketFlow()
  const now=new Date()
  const days=eachDayOfInterval({start:startOfWeek(startOfMonth(now),{weekStartsOn:1}),end:endOfWeek(endOfMonth(now),{weekStartsOn:1})})
  const active=useMemo(()=>incomeSources.filter(s=>s.is_active&&s.frequency!=='once'),[incomeSources])
  function srcs(d:Date){const dow=(d.getDay()+6)%7;return active.filter(s=>s.frequency==='weekly'&&s.day_of_week===dow)}
  function recv(sid:string,d:Date){return incomeEntries.some(e=>e.source_id===sid&&isSameDay(parseISO(e.received_at),d))}
  const weeks:Date[][]=[];for(let i=0;i<days.length;i+=7)weeks.push(days.slice(i,i+7))
  return(<div style={{display:'flex',flexDirection:'column',height:'100dvh',background:'var(--bg)'}}>
    <div style={{padding:'16px 20px 12px',borderBottom:'0.5px solid var(--border)',flexShrink:0}}>
      <div className="flex items-center">
        <button onClick={()=>router.back()} style={{width:36,height:36,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',marginRight:12}}><ArrowLeft size={18} color="var(--text2)" strokeWidth={1.7}/></button>
        <div style={{fontSize:17,fontWeight:600,color:'var(--text1)',flex:1,textAlign:'center'}}>{format(now,'MMMM yyyy',{locale:es})}</div>
        <div style={{width:36}}/>
      </div>
    </div>
    <div className="grid grid-cols-7" style={{flexShrink:0,borderBottom:'0.5px solid var(--border)'}}>
      {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=><div key={d} style={{textAlign:'center',padding:'7px 2px',fontSize:10,fontWeight:600,color:'var(--text3)',background:'var(--bg2)'}}>{d}</div>)}
    </div>
    <div style={{flex:1,overflowY:'auto',scrollbarWidth:'none'}}>
      {weeks.map((wk,wi)=>{
        const real=wk.filter(d=>isSameMonth(d,now))
        return(<div key={wi}>
          <div className="grid grid-cols-7">
            {wk.map((d,di)=>{
              const inM=isSameMonth(d,now); const td=isToday(d); const ss=inM?srcs(d):[]
              return(<div key={di} style={{minHeight:64,padding:'5px 4px',background:td?'var(--green-bg)':inM?'var(--bg)':'var(--bg3)',borderBottom:'0.5px solid var(--border)',borderRight:di<6?'0.5px solid var(--border)':'none'}}>
                <div style={{fontSize:11,fontWeight:td?600:500,color:td?'var(--green)':'var(--text3)',marginBottom:3}}>{inM?d.getDate():''}</div>
                {ss.map(s=>{const p=d<=now;const r=recv(s.id,d);return(<span key={s.id} style={{display:'block',fontSize:9,fontWeight:500,padding:'2px 4px',borderRadius:3,marginBottom:1,background:s.color+(p?'33':'15'),color:s.color,opacity:p&&!r?.5:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name.split(' ')[0]}{r?' ✓':''}</span>)})}
              </div>)
            })}
          </div>
          {real.length>0&&<div className="flex justify-between" style={{padding:'5px 8px',background:'var(--bg2)',fontSize:11,borderBottom:'0.5px solid var(--border)'}}>
            <span style={{color:'var(--text3)'}}>{real[0].getDate()}–{real[real.length-1].getDate()} {format(now,'MMM',{locale:es})}</span>
            <span style={{color:'var(--text3)'}}>—</span>
          </div>}
        </div>)
      })}
    </div>
  </div>)
}
