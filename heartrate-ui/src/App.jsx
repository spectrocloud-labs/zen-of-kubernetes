/* eslint-disable react/prop-types */
import { React, useState } from 'react'
import { trackPromise, usePromiseTracker } from 'react-promise-tracker'
import { ThreeDots } from 'react-loader-spinner'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import './App.css'
import spectroLogo from './assets/logo_landscape_for_dark.png'
import intelLogo from './assets/intel-logo-2022.png'
import Game from './components/Game'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom',
      // adds padding between plot and legend boxes
      title: {
        display: true,
        text: ''
      },
      labels: {
        boxWidth: 30,
        boxHeight: 15,
        color: 'rgb(73, 131, 212)',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    }
  },
  scales: {
    x: {
      display: false
    },
    y: {
      display: true,
      beginAtZero: false,
      grid: {
        color: 'rgba(255, 255, 240, 0.2)'
      },
      border: {
        color: 'rgba(255, 255, 240, 0.2)'
      },
      ticks: {
        stepSize: 1,
        color: 'rgb(255, 255, 240)',
        font: {
          size: 16
        }
      },
      min: 50,
      max: 140
    }
  },
  title: {
    display: true,
    text: 'Heart Rate'
  }
}

let baselineIntervalId
let challengeIntervalId

function App () {
  const [baseline, setBaseline] = useState(0)
  const [delta, setDelta] = useState(0)
  const [max, setMax] = useState(0)
  const [result, setResult] = useState({ message: '', error: '' })
  const [dataBaseline, setDataBaseline] = useState([])
  const [dataChallenge, setDataChallenge] = useState([])
  const [step, setStep] = useState('home')

  const baselineChartData = {
    labels: getLabels(),
    datasets: [
      {
        label: 'Baseline',
        data: dataBaseline,
        borderColor: 'rgba(73, 131, 212, 0.4)'
        // backgroundColor: 'rgba(73, 131, 212, 0.3)'
      },
      {
        label: 'Challenge',
        data: dataChallenge,
        borderColor: 'rgba(255, 0, 50, 0.4)'
        // backgroundColor: 'rgba(255, 0, 50, 0.3)'
      }
    ]
  }

  function getLabels () {
    const len = Math.max(dataBaseline.length, dataChallenge.length)
    return Array.from(Array(len).keys())
  }

  let content = (
    <>
      <div>
        <div className="logos-wrap">
          <a href="https://spectrocloud.com" target="_blank" rel="noreferrer">
            <img src={spectroLogo} className="logo" alt="Spectro logo" />
          </a>
          <em>&times;</em>
          <a href="https://intel.com">
            <img src={intelLogo} className="intel-logo" alt="Spectro logo" />
          </a>
        </div>
        <h1 className="title">Zen of Kubernetes</h1>
        <h2 className="subtitle">Heart Rate Challenge</h2>
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
              <Delta />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="loader">
        <LoadingIndicator />
      </div>
      <div className="connected">
        <Connected />
      </div>
      <div className="error">
        <Error />
      </div>
      <div className="line">
        <Line options={chartOptions} data={baselineChartData} />
      </div>
      <div className="card">
        <button onClick={connect}>Connect</button>
        <button onClick={getBaseline}>Baseline</button>
        <button onClick={startChallenge}>Start Challenge</button>
      </div>
      <p className="pii">
        <strong>Disclaimer:</strong> Heart rate data is wiped each time the Finish
        button is clicked. No PII is persisted. Heart rate deltas are recorded
        for the purposes of the prize draw and will be destroyed once a winner
        is determined.
      </p>
    </>
  )
  if (step === 'game') {
    const curMax = Math.max(...dataBaseline, ...dataChallenge)
    if (curMax > max) {
      setMax(curMax)
      setDelta(max - baseline)
    }

    content = (
      <>
        <div className="banner">
          <div className="line">
            <Line
              options={{
                ...chartOptions,
                plugins: {
                  legend: { display: false },
                  customCanvasBackgroundColor: {
                    color: '#000'
                  }
                }
              }}
              data={baselineChartData}
            />
          </div>
          <div className="stats">
            <dt>Baseline</dt>
            <dd>{baseline}</dd>
            <dt>Max</dt>
            <dd>{max}</dd>
            <dt>Delta</dt>
            <dd>{delta}</dd>
          </div>
          <button onClick={disconnect}>Finish</button>
        </div>
        <Game game="mario-brothers" />
      </>
    )
  }

  return <div className="App">{content}</div>

  function Delta ({ as = 'td' } = {}) {
    const Component = as
    if (delta === 0) {
      return <Component>{delta}</Component>
    } else if (delta < 0) {
      return <Component id="deltaNegative">{delta}</Component>
    }
    return <Component id="deltaPositive">{delta}</Component>
  }

  function Connected () {
    if (result.message === 'connected') {
      return <p id="connected">Connected</p>
    }
    return null
  }

  function Error () {
    if (result.error !== '') {
      return <p id="error">{result.error}</p>
    }
    return null
  }

  function reset () {
    setResult({ message: '', error: '' })
    setBaseline(0)
    setMax(0)
    setDelta(0)
    disableBaselineInterval()
    disableChallengeInterval()
    setDataBaseline([])
    setDataChallenge([])
    setStep('home')
  }

  function disableBaselineInterval () {
    clearInterval(baselineIntervalId)
  }

  function disableChallengeInterval () {
    clearInterval(challengeIntervalId)
  }

  function connect () {
    reset()
    trackPromise(
      fetch(window.VITE_API_BASE_URL + '/connect')
        .then((result) => result.json())
        .then((d) => setResult(d))
    )
  }

  function getBaseline () {
    baselineIntervalId = setInterval(
      () => getHeartRateDataBaseline(),
      window.REFRESH_INTERVAL_MS
    )
    setResult({ message: '', error: '' })

    trackPromise(
      fetch(window.VITE_API_BASE_URL + '/baseline')
        .then((result) => result.json())
        .then((d) => {
          setBaseline(d.baseline)
          setMax(d.max)
          setDelta(d.delta)
          setResult({ error: d.error })
        })
    )
  }

  function startChallenge () {
    disableBaselineInterval()
    setStep('game')
    challengeIntervalId = setInterval(
      () => getHeartRateDataChallenge(),
      window.REFRESH_INTERVAL_MS
    )
    setResult({ message: '', error: '' })

    trackPromise(
      fetch(window.VITE_API_BASE_URL + '/challenge')
        .then((result) => result.json())
        .then((d) => {
          setResult({ error: d.error })
        })
    )
  }

  function disconnect () {
    disableChallengeInterval()
    setStep('home')

    trackPromise(
      fetch(window.VITE_API_BASE_URL + '/disconnect')
        .then((result) => result.json())
        .then((d) => {
          setBaseline(d.baseline)
          setMax(d.max)
          setDelta(d.delta)
          setResult({ error: d.error })
        })
    )
  }

  function getHeartRateDataBaseline () {
    fetch(window.VITE_API_BASE_URL + '/heart-rate-data-baseline')
      .then((result) => result.json())
      .then((d) => {
        if (d) {
          setDataBaseline(d)
        }
      })
  }

  function getHeartRateDataChallenge () {
    fetch(window.VITE_API_BASE_URL + '/heart-rate-data-challenge')
      .then((result) => result.json())
      .then((d) => {
        if (d) {
          setDataChallenge(d)
        }
      })
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
