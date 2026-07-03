import { useEffect, useRef, useState } from 'react'

export function useDebouncedSensorValue(
  value: string,
  commit: (v: string) => void,
  delay = 200
) {
  const [local, setLocal] = useState(value)
  const lastCommitted = useRef(value)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (value !== lastCommitted.current) {
      setLocal(value)
      lastCommitted.current = value
    }
  }, [value])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function onChange(v: string) {
    setLocal(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      lastCommitted.current = v
      commit(v)
    }, delay)
  }

  return [local, onChange] as const
}
