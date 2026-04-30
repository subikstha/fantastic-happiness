'use client'

import { useSession } from "next-auth/react"

const CheckSession = () => {
    const session = useSession()
    console.log('session in client component is', session);
  return (
    null
  )
}

export default CheckSession