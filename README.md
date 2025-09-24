# @bufferstack.io/mqtt-socket.io-gateway 
A Node.js gateway bridging MQTT brokers and web clients via Socket.IO for real-time, bidirectional IoT messaging.

---

## Features

- Bidirectional communication between MQTT and Socket.IO clients  
- Secure MQTT connections with TLS and authentication  
- Dynamic MQTT topic subscription management  
- Outbound message queueing during MQTT broker disconnects  
- Configurable logging and CORS support  
- Includes CLI clients and a web test client

---

## Installation

Install the package dependencies:` 

npm install


 `Start the gateway server:` 

npm start


 `Or run directly via Node.js:` 

node index.js


## Configuration

Edit the `config.toml` file to configure the gateway:`` 

[mqtt]  
url = "mqtts://broker.example.com:8883"  
topics = ["sensor/#"]

[socketio]  
port = 3000

[queue]  
enabled = true  
maxSize = 1000

[log]  
level = "info"



- Set your MQTT broker URL and credentials  
- Define default MQTT topics to subscribe to  
- Configure Socket.IO server port and CORS options  
- Enable outbound message queue and set logging verbosity  

---

## Usage

- **Web client:** Open `client.html` in a browser for interactive MQTT-Socket.IO testing  
- **Publish CLI:** Use `mqtt-push-client.js` to send MQTT messages via the gateway  
- **Subscribe CLI:** Use `mqtt-pull-client.js` to subscribe and receive MQTT messages  

## Example to publish a message from the CLI client:`` 

node mqtt-push-client.js

## License

This project is licensed under the Apache 2.0 License. See the [LICENSE](LICENSE) file for details.

---

## Author

Harshad Joshi - [GitHub @hj91](https://github.com/hj91) - harshad@bufferstack.io

---

## Contributions

Contributions and feedback are welcome! Please open issues or submit pull requests on the GitHub repository.

---

## Support

For support, please open an issue on the GitHub repo or contact harshad@bufferstack.io.` 
