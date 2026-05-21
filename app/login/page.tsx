'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage(){
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const router=useRouter()

  async function handleLogin(){
    setLoading(true); setError('')
    try {
      const {createBrowserClient} = await import('@supabase/ssr')
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const {error:err} = await sb.auth.signInWithPassword({email,password})
      if(err){setError('Email o contraseña incorrectos');setLoading(false);return}
      router.push('/')
      router.refresh()
    } catch(e){
      setError('Error al conectar');setLoading(false)
    }
  }

  return(
    <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',minHeight:'100dvh',padding:24,background:'var(--bg)'}}>
      <div style={{width:'100%',maxWidth:340}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>💰</div>
          <div style={{fontSize:24,fontWeight:700,color:'var(--text1)'}}>PocketFlow</div>
          <div style={{fontSize:14,color:'var(--text3)',marginTop:4}}>Tu plata, clara.</div>
        </div>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"
          style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:15,marginBottom:10,outline:'none'}}/>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña"
          onKeyDown={e=>e.key==='Enter'&&handleLogin()}
          style={{width:'100%',padding:'12px 14px',borderRadius:10,border:'0.5px solid var(--border2)',background:'var(--bg2)',color:'var(--text1)',fontSize:15,marginBottom:16,outline:'none'}}/>
        {error&&<div style={{fontSize:13,color:'var(--red)',marginBottom:12,textAlign:'center'}}>{error}</div>}
        <button onClick={handleLogin} disabled={loading||!email||!password}
          style={{width:'100%',padding:14,borderRadius:10,background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600,border:'none',cursor:'pointer',opacity:(loading||!email||!password)?.5:1,marginBottom:16}}>
          {loading?'Entrando…':'Entrar'}
        </button>
        <div style={{textAlign:'center',fontSize:14,color:'var(--text3)'}}>
          ¿No tenés cuenta?{' '}
          <Link href="/registro" style={{color:'var(--blue)',fontWeight:500,textDecoration:'none'}}>
            Registrate
          </Link>
        </div>
      </div>
    </div>
  )
}
