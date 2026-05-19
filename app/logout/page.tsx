'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getClient } from '@/lib/supabase'

export default function LogoutPage(){
  const router = useRouter()
  useEffect(()=>{
    async function logout(){
      await getClient().auth.signOut()
      router.replace('/login')
    }
    logout()
  },[])
  return(
    <div style={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100dvh',background:'var(--bg)',color:'var(--text3)',fontSize:14}}>
      Cerrando sesión…
    </div>
  )
}
