'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase'

export default function RegistroPage(){
  const [step, setStep] = useState<'form'|'success'>('form')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  function validate(){
    if(!nombre.trim()) return 'Ingresá tu nombre'
    if(!email.includes('@')) return 'Email inválido'
    if(password.length < 6) return 'La contraseña debe tener al menos 6 caracteres'
    if(password !== confirm) return 'Las contraseñas no coinciden'
    return null
  }

  async function handleRegistro(){
    const err = validate()
    if(err){ setError(err); return }
    setLoading(true); setError('')
    try {
      const sb = getClient()
      const { error: signUpErr } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: nombre.trim() } }
      })
      if(signUpErr){ setError(signUpErr.message); setLoading(false); return }
      setStep('success')
    } catch(e){
      setError('Error al conectar'); setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width:'100%', padding:'12px 14px', borderRadius:10,
    border:'0.5px solid var(--border2)', background:'var(--bg2)',
    color:'var(--text1)', fontSize:15, marginBottom:10, outline:'none',
    boxSizing:'border-box'
  }

  if(step === 'success'){
    return(
      <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',minHeight:'100dvh',padding:24,background:'var(--bg)'}}>
        <div style={{width:'100%',maxWidth:340,textAlign:'center'}}>
          <div style={{fontSize:56,marginBottom:16}}>🎉</div>
          <div style={{fontSize:22,fontWeight:700,color:'var(--text1)',marginBottom:8}}>¡Cuenta creada!</div>
          <div style={{fontSize:14,color:'var(--text3)',marginBottom:32,lineHeight:1.5}}>
            Te enviamos un email de confirmación a <strong style={{color:'var(--text2)'}}>{email}</strong>. Confirmá tu cuenta para empezar.
          </div>
          <Link href="/login"
            style={{display:'block',width:'100%',padding:14,borderRadius:10,background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600,textAlign:'center',textDecoration:'none'}}>
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return(
    <div style={{display:'flex',flexDirection:'column',justifyContent:'center',alignItems:'center',minHeight:'100dvh',padding:24,background:'var(--bg)'}}>
      <div style={{width:'100%',maxWidth:340}}>
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{fontSize:40,marginBottom:8}}>💰</div>
          <div style={{fontSize:24,fontWeight:700,color:'var(--text1)'}}>PocketFlow</div>
          <div style={{fontSize:14,color:'var(--text3)',marginTop:4}}>Creá tu cuenta gratis</div>
        </div>

        <input
          type="text" value={nombre} onChange={e=>setNombre(e.target.value)}
          placeholder="Tu nombre" style={inputStyle}
        />
        <input
          type="email" value={email} onChange={e=>setEmail(e.target.value)}
          placeholder="Email" style={inputStyle}
        />
        <input
          type="password" value={password} onChange={e=>setPassword(e.target.value)}
          placeholder="Contraseña (mín. 6 caracteres)" style={inputStyle}
        />
        <input
          type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
          placeholder="Repetir contraseña"
          onKeyDown={e=>e.key==='Enter'&&handleRegistro()}
          style={{...inputStyle, marginBottom:16}}
        />

        {error&&<div style={{fontSize:13,color:'var(--red)',marginBottom:12,textAlign:'center'}}>{error}</div>}

        <button onClick={handleRegistro} disabled={loading}
          style={{width:'100%',padding:14,borderRadius:10,background:'var(--blue)',color:'#fff',fontSize:15,fontWeight:600,border:'none',cursor:'pointer',opacity:loading?.6:1,marginBottom:16}}>
          {loading?'Creando cuenta…':'Crear cuenta'}
        </button>

        <div style={{textAlign:'center',fontSize:14,color:'var(--text3)'}}>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" style={{color:'var(--blue)',fontWeight:500,textDecoration:'none'}}>
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
