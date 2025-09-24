/*
 * @bufferstack.io/mqtt-socket.io-gateway/mqtt-push-client.js
 * Copyright 2025 Harshad Joshi and Bufferstack.IO Analytics LLP
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const { io } = require('socket.io-client');

// Replace with your gateway Socket.IO server URL
const socket = io('http://localhost:3000');

const topic = 'sensor/temp'; // MQTT topic to publish to

// Connect to Socket.IO gateway
socket.on('connect', () => {
  console.log('Connected to Socket.IO gateway with id:', socket.id);

  // Function to publish a value to the MQTT topic periodically
  function publishValue(value) {
    console.log(`Publishing value ${value} to MQTT topic "${topic}"`);
    socket.emit('mqtt-publish', { topic, message: value.toString() });
  }

  // Publish values every 5 seconds (example: random temperature values)
  setInterval(() => {
    const randomTemp = (20 + Math.random() * 10).toFixed(2);
    publishValue(randomTemp);
  }, 5000);
});

// Listen for confirmations on publish success
socket.on('publish-success', (data) => {
  console.log(`Publish to topic "${data.topic}" succeeded.`);
});

// Error handling
socket.on('gateway-error', (errorMsg) => {
  console.error('Gateway error:', errorMsg);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from gateway:', reason);
});
