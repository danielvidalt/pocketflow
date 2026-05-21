'use client'
import { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
type PillColor = 'green'|'blue'|'red'|'purple'|'amber'|'gray'
const PS: Record<PillColor,{bg:string;color:string}> = {
  green:{bg:'var(--green-bg)',color:'var(--green)'},blue:{bg:'var(--blue-bg)',color:'var(--blue)'},
  red:{bg:'var(--red-bg)',color:'var(--red)'},purple:{bg:'var(--purple-bg)',color:'var(--purple)'},
  amber:{bg:'var(--amber-bg)',color:'var(--amber)'},gray:{bg:'var(--bg2)',color:'var(--text2)'},
}
export function PillTag({color='gray',children,className=''}:{color?:PillColor;children:ReactNode;className?:string}){
  const s=PS[color]; return <span className={clsx('pill',className)} style={{background:s.bg,color:s.color}}>{children}</span>
}
export function MetricCard({label,value,sub,valueColor}:{label:string;value:string;sub?:string;valueColor?:string}){
  return(<div style={{background:'var(--bg2)',borderRadius:'var(--radius-sm)',padding:'10px 12px'}}>
    <div style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.04em',marginBottom:3}}>{label}</div>
    <div style={{fontSize:20,fontWeight:600,color:valueColor||'var(--text1)'}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>{sub}</div>}
  </div>)
}
export function ProgressBar({percent,color='var(--green)',height=6}:{percent:number;color?:string;height?:number}){
  return(<div className="prog-wrap" style={{height}}><div className="prog-fill" style={{width:`${Math.min(100,Math.max(0,percent))}%`,background:color}}/></div>)
}
export function BtnPrimary({children,onClick,disabled,className=''}:{children:ReactNode;onClick?:()=>void;disabled?:boolean;className?:string}){
  return(<button onClick={onClick} disabled={disabled} className={clsx('flex items-center justify-center gap-1.5 w-full py-3 rounded-lg text-white text-sm font-medium transition-opacity disabled:opacity-50',className)} style={{background:'var(--blue)'}}>{children}</button>)
}
export function BtnGhost({children,onClick,className=''}:{children:ReactNode;onClick?:()=>void;className?:string}){
  return(<button onClick={onClick} className={clsx('flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-sm',className)} style={{border:'0.5px solid var(--border2)',color:'var(--text2)',background:'transparent'}}>{children}</button>)
}
export function SectionHeader({title,subtitle,action,back}:{title:string;subtitle?:string;action?:ReactNode;back?:boolean}){
  const router = useRouter()
  return(<div style={{padding:'16px 16px 12px',borderBottom:'0.5px solid var(--border)',background:'var(--bg)',flexShrink:0}}>
    <div className="flex items-center gap-2">
      {back&&<button onClick={()=>router.back()} style={{width:34,height:34,borderRadius:10,background:'var(--bg2)',border:'0.5px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer'}}><ArrowLeft size={17} color="var(--text2)" strokeWidth={1.7}/></button>}
      <div style={{flex:1}}>
        <div style={{fontSize:17,fontWeight:600,color:'var(--text1)'}}>{title}</div>
        {subtitle&&<div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{subtitle}</div>}
      </div>
      {action}
    </div>
  </div>)
}
export function Divider({margin='10px 0'}:{margin?:string}){return <div style={{height:'0.5px',background:'var(--border)',margin}}/>}
export function EmptyState({message}:{message:string}){return(<div className="flex flex-col items-center justify-center py-12" style={{color:'var(--text3)',fontSize:13}}>{message}</div>)}
