import React, { useEffect, useRef } from 'react'

const gamePaths = {
  aladdin: 'ALADDIN.EXE',
  doom: 'DOOM.EXE',
  'mario-brothers': 'MARIO.EXE',
  'mega-man-x': 'MMXDEMO.EXE',
  'prince-of-persia': 'pop1demo.exe',
  quake: 'QUAKE.EXE',
  'sim-city-2k': 'SC2000.EXE',
  'warcraft-ii': 'WAR21.EXE'
}

export default function Game ({ game }) {
  const once = useRef(false)
  const canvasRef = React.useRef()
  useEffect(() => {
    if (once.current) {
      return
    }
    const gameRunner = Dos(canvasRef.current, {})
    gameRunner.ready((fs, main) => {
      fs.extract(`/${game}` + '.zip').then(() => {
        main(['-c', gamePaths[game]])
      })
    })
    once.current = true
  }, [])

  return <div className='game-wrap'>
    <canvas ref={canvasRef} />
  </div>
}
