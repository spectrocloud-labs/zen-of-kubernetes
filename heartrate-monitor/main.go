package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/go-logr/logr"
	"github.com/go-logr/zerologr"
	"github.com/rs/zerolog"
	"tinygo.org/x/bluetooth"
)

var (
	level zerolog.Level
	log   logr.Logger

	device                                 *bluetooth.Device
	scanResult                             *bluetooth.ScanResult
	heartRateCharacteristic                *bluetooth.DeviceCharacteristic
	deviceAddress                          string
	baseline, baselineCount, delta, max    int
	baselineValues, challengeValues        HeartRateSlice
	recording                              = make(chan bool, 1)
	baselineEstablished, isChallengeActive bool

	adapter                     = bluetooth.DefaultAdapter
	heartRateServiceUUID        = bluetooth.ServiceUUIDHeartRate
	heartRateCharacteristicUUID = bluetooth.CharacteristicUUIDHeartRateMeasurement
)

const (
	alreadyConnected = "failed to connect... you must disconnect first"
)

type HeartRateSlice []uint8

func (h HeartRateSlice) MarshalJSON() ([]byte, error) {
	var result string
	if h == nil {
		result = "null"
	} else {
		result = strings.Join(strings.Fields(fmt.Sprintf("%d", h)), ",")
	}
	return []byte(result), nil
}

type Response struct {
	Message  string `json:"message"`
	Baseline int    `json:"baseline"`
	Max      int    `json:"max"`
	Delta    int    `json:"delta"`
	Error    string `json:"error"`
}

// device address: 48a44b18-555a-e689-8140-f16dc6fdd3d6

func init() {
	if len(os.Args) < 2 {
		fmt.Println("usage: hrm [address] [log-level]")
		os.Exit(1)
	}
	deviceAddress = os.Args[1]

	if len(os.Args) > 2 {
		l, err := strconv.ParseInt(os.Args[2], 10, 64)
		if err != nil {
			fmt.Fprintf(os.Stderr, "failed to parse log level %s: %v\n", os.Args[2], err)
			panic(err)
		}
		level = zerolog.Level(l)
	} else {
		level = zerolog.InfoLevel
	}

	zl := zerolog.New(os.Stderr).Level(level)
	log = zerologr.New(&zl)
	log.V(0).Info("hrm", "address", deviceAddress, "logLevel", level)
}

func main() {

	http.HandleFunc("/hrm/connect", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(&w)
		reset()

		var response Response
		if err := connect(); err != nil && err.Error() != alreadyConnected {
			response.Error = err.Error()
			w.WriteHeader(http.StatusInternalServerError)
		} else {
			response.Message = "connected"
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			panic(err)
		}
	})

	http.HandleFunc("/hrm/baseline", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(&w)

		if err := recordBaseline(); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			if err := json.NewEncoder(w).Encode(Response{Error: err.Error()}); err != nil {
				panic(err)
			}
			return
		}
		response := Response{Message: "baseline", Baseline: baseline}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			panic(err)
		}
	})

	http.HandleFunc("/hrm/challenge", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(&w)

		var err error
		var response Response
		go func() {
			err = challenge()
		}()
		if err != nil {
			response.Error = err.Error()
		}
		if err := json.NewEncoder(w).Encode(response); err != nil {
			panic(err)
		}
	})

	http.HandleFunc("/hrm/disconnect", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(&w)
		err := disconnect()
		<-recording
		response := Response{
			Message:  "delta",
			Baseline: baseline,
			Max:      max,
			Delta:    delta,
		}
		if err != nil {
			response.Error = err.Error()
		}
		reset()
		if err := json.NewEncoder(w).Encode(response); err != nil {
			panic(err)
		}
	})

	http.HandleFunc("/hrm/heart-rate-data-baseline", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(&w)
		if err := json.NewEncoder(w).Encode(baselineValues); err != nil {
			panic(err)
		}
	})

	http.HandleFunc("/hrm/heart-rate-data-challenge", func(w http.ResponseWriter, r *http.Request) {
		setHeaders(&w)
		if err := json.NewEncoder(w).Encode(challengeValues); err != nil {
			panic(err)
		}
	})

	log.V(0).Info("Listening on 127.0.0.1:8081...")
	_ = http.ListenAndServe(":8081", nil)
}

func reset() {
	baseline, baselineCount, delta, max = 0, 0, 0, 0
	baselineValues, challengeValues = make(HeartRateSlice, 0), make(HeartRateSlice, 0)
	baselineEstablished, isChallengeActive = false, false
}

func setHeaders(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
	(*w).Header().Set("Content-Type", "application/json")
}

func connect() error {
	if device != nil {
		return errors.New(alreadyConnected)
	}
	if err := adapter.Enable(); err != nil {
		if err.Error() != "already calling Enable function" { // from bluetooth lib
			return err
		}
	} else {
		log.V(1).Info("enabled BLE interface")
	}

	// scan for device
	log.V(1).Info("scanning...")
	ch := make(chan *bluetooth.ScanResult, 1)
	err := adapter.Scan(func(adapter *bluetooth.Adapter, result bluetooth.ScanResult) {
		log.V(0).Info("found device", "address", result.Address.String(), "rssi", result.RSSI, "localName", result.LocalName())
		if result.Address.String() == deviceAddress {
			if err := adapter.StopScan(); err != nil {
				log.V(0).Error(err, "failed to stop scan")
			}
			ch <- &result
		}
	})
	if err != nil {
		log.V(0).Error(err, "failed to initiate Bluetooth scan")
		return err
	}

	// connect to device
	scanResult = <-ch
	device, err = adapter.Connect(scanResult.Address, bluetooth.ConnectionParams{})
	if err != nil {
		log.V(0).Error(err, "failed to connect to address", "address", scanResult.Address.String())
		return err
	}
	log.V(0).Info("connected", "address", scanResult.Address.String())

	// get heart rate service
	log.V(1).Info("discovering services/characteristics")
	srvcs, err := device.DiscoverServices([]bluetooth.UUID{heartRateServiceUUID})
	if err != nil {
		log.V(0).Error(err, "failed to discover services")
		return err
	}
	if len(srvcs) == 0 {
		return errors.New("could not find heart rate service")
	}
	srvc := srvcs[0]
	log.V(0).Info("found heart rate service", "service", srvc.UUID().String())

	// get heart rate characteristic
	chars, err := srvc.DiscoverCharacteristics([]bluetooth.UUID{heartRateCharacteristicUUID})
	if err != nil {
		log.Error(err, "failed to discover characteristics")
	}
	if len(chars) == 0 {
		return errors.New("could not find heart rate characteristic")
	}
	heartRateCharacteristic = &chars[0]
	log.V(0).Info("found heart rate characteristic", "characteristic", heartRateCharacteristic.UUID().String())

	return nil
}

func recordBaseline() error {
	if device == nil {
		return errors.New("failed to record baseline... you must connect first")
	}

	// subscribe to heart rate notifications
	if err := heartRateCharacteristic.EnableNotifications(heartRateCallback); err != nil {
		log.V(0).Error(err, "failed to subscribe to heart rate notifications")
		return err
	}

	// establish baseline
	log.V(0).Info("establishing baseline heart rate")
	//baselineTimer := time.NewTimer(30 * time.Second)
	baselineTimer := time.NewTimer(5 * time.Second)
	<-baselineTimer.C

	var sum int
	baselineCount = len(baselineValues)
	for _, v := range baselineValues {
		sum += int(v)
		log.V(1).Info("calculating", "sum", sum, "baselineCount", baselineCount)
	}
	if baselineCount == 0 {
		return errors.New("failed to establish baseline")
	}
	baseline = sum / baselineCount
	baselineEstablished = true
	log.V(0).Info("baseline established", "heartRate", baseline)

	return nil
}

func challenge() error {
	log.V(0).Info("recording heart rate")
	isChallengeActive = true

	// block until termination signal
	<-recording

	// determine maximum heart rate
	max = 0
	for _, v := range challengeValues {
		if int(v) > max {
			max = int(v)
		}
		log.V(1).Info("calculating", "max", max, "v", v)
	}
	log.V(0).Info("maximum", "heartRate", max)

	delta = max - baseline
	log.V(0).Info("final result", "delta", delta)

	recording <- false
	return nil
}

func disconnect() error {
	recording <- false

	if device == nil {
		return errors.New("failed to disconnect... you must connect first")
	}
	if err := device.Disconnect(); err != nil {
		log.V(0).Error(err, "failed to disconnect", "deviceName", scanResult.LocalName())
		return err
	}
	device = nil

	log.V(0).Info("disconnected", "deviceName", scanResult.LocalName())
	return nil
}

func heartRateCallback(buf []byte) {
	v := uint8(buf[1])
	if v == 0 {
		log.V(1).Info("sensor initializing", "heartRate", v)
		return
	}
	if !isChallengeActive && baselineEstablished {
		// avoid growing the baselineValues slice indefinitely
		// while waiting for the user to start the challenge
		return
	}
	log.Info("sensor input", "heartRate", v, "isChallenge", isChallengeActive)
	if isChallengeActive {
		challengeValues = append(challengeValues, v)
	} else {
		baselineValues = append(baselineValues, v)
	}
}
