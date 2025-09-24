/*
 * @bufferstack.io/mqtt-socket.io-gateway/mqtt-subscribe-client.js
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

// The MQTT topic pattern you want to subscribe to dynamically
const subscribeTopic = 'sensor/#';

socket.on('connect', () => {
  console.log('Connected to Socket.IO gateway with id:', socket.id);

  // Request gateway to subscribe to the MQTT topic pattern
  console.log(`Subscribing to MQTT topic via gateway: ${subscribeTopic}`);
  socket.emit('mqtt-subscribe', subscribeTopic);
});

// Listen for MQTT messages forwarded from the gateway
socket.on('mqtt-message', (data) => {
  console.log(`Received MQTT message from topic "${data.topic}": ${data.message}`);
});

// Listen for confirmation of subscription success
socket.on('subscribe-success', (topic) => {
  console.log(`Successfully subscribed to topic: ${topic}`);
});

// Handle any gateway errors
socket.on('gateway-error', (errMsg) => {
  console.error('Gateway error:', errMsg);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected from gateway:', reason);
});
