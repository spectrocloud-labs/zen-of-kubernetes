# zen-of-kubernetes
Can you beat the first level of Super Mario without increasing your heart rate? First, connect and establish your baseline heart rate. Then, once you're ready, you'll be given 60 seconds to beat the first level of Super Mario. Once you're finished, the delta between your maximum and baseline heart rates will be computed.

### heartrate-monitor
Uses [tinygo.org/x/bluetooth](https://github.com/tinygo-org/bluetooth) to connect with a heart rate monitoring device. Provides a basic webserver to expose connect, baseline, challenge, and disconnect functionality.

### heartrate-ui
Front end for the heart rate monitor server.