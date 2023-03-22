package main

import (
	"strconv"
	"time"

	"tinygo.org/x/bluetooth"
)

var adapter = bluetooth.DefaultAdapter

var seen = make(map[string]bool, 0)

func main() {
	wait()

	// Enable BLE interface.
	must("enable BLE stack", adapter.Enable())

	ch := make(chan bluetooth.ScanResult, 1)

	// Start scanning.
	println("scanning...")

	go func() {
		for {
			err := adapter.Scan(func(adapter *bluetooth.Adapter, result bluetooth.ScanResult) {
				uuid := result.Address.String()
				// println("found device:", result.Address.String(), result.RSSI, result.LocalName())
				// if result.Address.String() == connectAddress() {
				// 	adapter.StopScan()
				// 	ch <- result
				// }
				_, ok := seen[uuid]
				if !ok {
					println("found device:", uuid, result.RSSI, result.LocalName())
					seen[uuid] = true
					_ = adapter.StopScan()
					ch <- result
				}
			})
			if err != nil {
				panic(err)
			}
		}
	}()

	go func() {
		for {
			result := <-ch
			println("attempting to connect to device:", result.Address.String(), result.RSSI, result.LocalName())

			var device *bluetooth.Device
			device, err := adapter.Connect(result.Address, bluetooth.ConnectionParams{
				ConnectionTimeout: bluetooth.NewDuration(1 * time.Second),
			})
			if err != nil {
				println(err.Error())
				continue
			}
			println("connected to ", result.Address.String())

			// get services
			println("discovering services/characteristics")
			srvcs, err := device.DiscoverServices(nil)
			must("discover services", err)

			// buffer to retrieve characteristic data
			buf := make([]byte, 255)

			for _, srvc := range srvcs {
				println("- service", srvc.UUID().String())

				chars, err := srvc.DiscoverCharacteristics(nil)
				if err != nil {
					println(err)
				}
				for _, char := range chars {
					println("-- characteristic", char.UUID().String())
					n, err := char.Read(buf)
					if err != nil {
						println("    ", err.Error())
					} else {
						println("    data bytes", strconv.Itoa(n))
						println("    value =", string(buf[:n]))
					}
				}
			}

			err = device.Disconnect()
			if err != nil {
				println(err)
			}
		}
	}()

	done()
}

func must(action string, err error) {
	if err != nil {
		panic("failed to " + action + ": " + err.Error())
	}
}

// wait on baremetal, proceed immediately on desktop OS.
func wait() {
}

// done just prints a message and allows program to exit.
func done() {
	time.Sleep(30 * time.Minute)
	//println("Done.")
}
