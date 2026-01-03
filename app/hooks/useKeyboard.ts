"use client"

import { useEffect, useRef } from "react"

export default function useKeyboard (){
    const keysPressed = useRef<Set<string>>(new Set())

    useEffect(()=>{
        const handleKeyDown = (e:KeyboardEvent) => {
            keysPressed.current.add(e.key.toLowerCase())
        }
        const handleKeyUp = (e:KeyboardEvent) => {
            keysPressed.current.delete(e.key.toLowerCase())
        }

        window.addEventListener("keydown", handleKeyDown)
        window.addEventListener("keyup", handleKeyUp)

        return ()=> {
            window.removeEventListener("keydown", handleKeyDown)
            window.removeEventListener("keyup", handleKeyUp)
        }
    },[])

    return keysPressed
}