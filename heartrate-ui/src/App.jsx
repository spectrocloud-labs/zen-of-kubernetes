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
        boxWidth: 32,
        boxHeight: 14,
        color: 'rgb(215, 218, 229)',
        font: {
          family: 'Poppins, system-ui, Avenir, Helvetica, Arial, sans-serif',
          size: 17
        },
        useBorderRadius: true,
        borderRadius: 2
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
        color: 'rgb(75, 83, 114)'
      },
      border: {
        color: 'rgba(255, 255, 240, 0.2)'
      },
      ticks: {
        autoSkip: false,
        stepSize: 5,
        color: 'rgb(215, 218, 229)',
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
        borderColor: 'rgb(53, 117, 207)',
        pointBorderColor: 'rgb(98, 154, 238)',
        pointBorderWidth: '2'
      },
      {
        label: 'Challenge',
        data: dataChallenge,
        borderColor: 'rgb(181, 74, 161)',
        pointBorderColor: 'rgb(205, 106, 187)',
        pointBorderWidth: '2'
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
        <table className="header">
          <tbody>
            <th>
              <h1 className="title">Zen of <e>Kubernetes</e></h1>
              <h2 className="subtitle">Heart Rate Challenge</h2>
            </th>
            <th className="logos">
              <div className="logos-wrap">
                <a href="https://spectrocloud.com" target="_blank" rel="noreferrer">
                  <img src={spectroLogo} className="logo" alt="Spectro logo" />
                </a>
                <em>|</em>
                <a href="https://intel.com">
                  <img src={intelLogo} className="intel-logo" alt="Spectro logo" />
                </a>
              </div>
            </th>
          </tbody>
        </table>
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
              <td id="baselineValue">{baseline}</td>
              <td id="maxValue">{max}</td>
              <Delta />
            </tr>
          </tbody>
        </table>
      </div>
      <div className="loader">
        <Connected />
        <Error />
        <LoadingIndicator />
      </div>
      <div className="line">
        <Line options={chartOptions} data={baselineChartData} />
      </div>
      <div className="card">
        <button id="baselineButton" onClick={getBaseline}>Baseline</button>
        <button onClick={startChallenge}>Start Challenge</button>
      </div>
      <div className="connect">
        <button id="connectButton" onClick={connect}>Connect</button>
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
      setDelta(curMax - baseline)
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
                },
                scales: {
                  x: {
                    display: false
                  },
                  y: {
                    ticks: {
                      color: 'rgb(215, 218, 229)',
                      font: {
                        size: 12,
                        weight: 'bold'
                      }
                    }
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
      return <Component id="deltaNeutral">{delta}</Component>
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
    reset()

    // prevent accumulation of baseline intervals if "baseline"
    // re-clicked before clicking "start challenge"
    disableBaselineInterval()

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
    // zero out results for anticipation until disconnect loader resolves
    setBaseline(0)
    setMax(0)
    setDelta(0)

    disableChallengeInterval()
    // shift challenge data to after baseline
    if (dataBaseline.length > 0) {
      const buffer = Array(dataBaseline.length - 1).fill(null)
      const d = buffer.concat(dataChallenge)
      setDataChallenge(d)
    }
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
    return <ThreeDots color="#60BEA9" height="50" width="60" textAlign="center" />
  }
  return null
}

export default App
