import { React, useState } from 'react'
import { trackPromise, usePromiseTracker } from 'react-promise-tracker'
import { ThreeDots } from 'react-loader-spinner'

import './App.css'
import spectroLogo from './assets/logo_landscape_for_dark.png'

const API_URL = import.meta.env.VITE_API_BASE_URL

function App () {
  const [baseline, setBaseline] = useState(0)
  const [recording, setRecording] = useState(false)
  const [delta, setDelta] = useState(0)
  const [max, setMax] = useState(0)
  const [result, setResult] = useState({ message: '', error: '' })

  return (
    <div className="App">
      <div>
        <a href="https://spectrocloud.com" target="_blank" rel="noreferrer">
          <img src={spectroLogo} className="logo" alt="Spectro logo"/>
        </a>
        <h1>Zen of Kubernetes</h1>
        <h2 className="spectro">Heart Rate Challenge</h2>
      </div>
      <div className="hrm">
        <table>
          <tbody>
            <tr>
              <th>Baseline</th>
              <th>Max</th>
              <th>Delta</th>
            </tr>
            <tr>
              <td>{baseline}</td>
              <td>{max}</td>
              <Delta/>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="loader">
        <LoadingIndicator/>
      </div>
      <div className="connected">
        <Connected/>
      </div>
      <div className="recording">
        <Recording/>
      </div>
      <div className="error">
        <Error/>
      </div>
      <div className="card">
        <button onClick={connect}>
          Connect
        </button>
        <button onClick={getBaseline}>
          Baseline
        </button>
        <button onClick={startChallenge}>
          Start Challenge
        </button>
        <button onClick={disconnect}>
          Finish
        </button>
      </div>
    </div>
  )

  function Delta () {
    if (delta === 0) {
      return <td>{delta}</td>
    } else if (delta < 0) {
      return <td id='deltaNegative'>{delta}</td>
    }
    return <td id='deltaPositive'>{delta}</td>
  }

  function Connected () {
    if (result.message === 'connected') {
      return <p id='connected'>Connected</p>
    }
    return null
  }

  function Recording () {
    if (recording) {
      return <p id='recording'>Recording heart rate...</p>
    }
    return null
  }

  function Error () {
    if (result.error !== '') {
      return <p id='error'>{result.error}</p>
    }
    return null
  }

  function reset () {
    setResult({ message: '', error: '' })
    setRecording(false)
    setBaseline(0)
    setMax(0)
    setDelta(0)
  }

  function connect () {
    reset()
    trackPromise(
      fetch(API_URL + '/connect')
        .then(result => result.json())
        .then(d => setResult(d))
    )
  }

  function getBaseline () {
    setResult({ message: '', error: '' })
    trackPromise(
      fetch(API_URL + '/baseline')
        .then(result => result.json())
        .then(d => {
          setBaseline(d.baseline)
          setMax(d.max)
          setDelta(d.delta)
          setResult({ error: d.error })
        })
    )
  }

  function startChallenge () {
    setResult({ message: '', error: '' })
    trackPromise(
      fetch(API_URL + '/challenge')
        .then(result => result.json())
        .then(d => {
          setResult({ error: d.error })
          if (d.error === '') {
            setRecording(true)
          }
        })
    )
  }

  function disconnect () {
    setRecording(false)
    trackPromise(
      fetch(API_URL + '/disconnect')
        .then(result => result.json())
        .then(d => {
          setBaseline(d.baseline)
          setMax(d.max)
          setDelta(d.delta)
          setResult({ error: d.error })
        })
    )
  }
}

export const LoadingIndicator = () => {
  const { promiseInProgress } = usePromiseTracker()
  if (promiseInProgress) {
    return <ThreeDots color="#2BAD60" height="100" width="100" />
  }
  return null
}

export default App
