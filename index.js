/*
 * @bufferstack.io/mqtt-socket.io-gateway/index.js
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



const fs = require('fs');
const http = require('http');
const TOML = require('@iarna/toml');
const mqtt = require('mqtt');
const { Server } = require('socket.io');
const { validateConfig } = require('./config-validator');

// --- Logger Utility ---
const logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
let currentLogLevel = logLevels.info; // Default before config is loaded
const log = {
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => currentLogLevel >= logLevels.warn && console.warn('[WARN]', ...args),
    info: (...args) => currentLogLevel >= logLevels.info && console.info('[INFO]', ...args),
    debug: (...args) => currentLogLevel >= logLevels.debug && console.debug('[DEBUG]', ...args),
};

// --- Configuration Loading and Validation ---
function loadAndValidateConfig(path) {
    try {
        const tomlString = fs.readFileSync(path, 'utf-8');
        const rawConfig = TOML.parse(tomlString);
        const { value: config, error } = validateConfig(rawConfig);

        if (error) {
            log.error('Configuration validation failed:');
            error.details.forEach(detail => log.error(`- ${detail.message}`));
            process.exit(1);
        }
        
        currentLogLevel = logLevels[config.log.level];
        log.info('Configuration loaded and validated successfully.');

        if (config.mqtt.tls) {
            const tlsOptions = {};
            if (config.mqtt.tls.ca) tlsOptions.ca = config.mqtt.tls.ca.map(p => fs.readFileSync(p));
            if (config.mqtt.tls.cert) tlsOptions.cert = fs.readFileSync(config.mqtt.tls.cert);
            if (config.mqtt.tls.key) tlsOptions.key = fs.readFileSync(config.mqtt.tls.key);
            if (typeof config.mqtt.tls.rejectUnauthorized !== 'undefined') {
                tlsOptions.rejectUnauthorized = config.mqtt.tls.rejectUnauthorized;
            }
            config.mqtt.options = { ...config.mqtt.options, ...tlsOptions };
        }
        return config;
    } catch (e) {
        log.error(`Failed to load, parse, or validate config from ${path}:`, e.message);
        process.exit(1);
    }
}

// --- Main Gateway Class ---
class MqttSocketGateway {
    constructor(config) {
        this.config = config;
        this.mqttClient = null;
        this.io = null;
        this.isMqttConnected = false;
        this.outgoingQueue = [];
        this.dynamicTopics = new Set();
    }

    start() {
        this.setupSocketServer();
        this.setupMqttClient();
        log.info('Gateway started successfully.');
    }

    setupMqttClient() {
        log.info(`Connecting to MQTT broker at ${this.config.mqtt.url}...`);
        this.mqttClient = mqtt.connect(this.config.mqtt.url, this.config.mqtt.options);

        this.mqttClient.on('connect', () => {
            this.isMqttConnected = true;
            log.info('MQTT connected.');
            this.io.emit('gateway-status', { status: 'connected', message: 'MQTT broker connected.' });
            
            const allTopics = [...new Set([...this.config.mqtt.topics, ...this.dynamicTopics])];
            if (allTopics.length > 0) {
                log.info('Subscribing to topics...');
                allTopics.forEach(topic => {
                    this.mqttClient.subscribe(topic, { qos: 1 }, (err, granted) => {
                        if (err) {
                            return log.error(`Subscription failed for topic "${topic}":`, err.message);
                        }
                        if (Array.isArray(granted) && granted.length > 0) {
                            log.info(`- Successfully subscribed to "${granted[0].topic}" with QoS ${granted[0].qos}`);
                        } else {
                            log.warn(`Subscription granted array empty or undefined for topic "${topic}"`);
                        }
                    });
                });
            }
            this.processOutgoingQueue();
        });

        this.mqttClient.on('reconnect', () => {
            log.warn('MQTT client attempting to reconnect...');
            this.io.emit('gateway-status', { status: 'reconnecting', message: 'Attempting to reconnect to MQTT...' });
        });

        this.mqttClient.on('close', () => {
            this.isMqttConnected = false;
            log.error('MQTT connection closed.');
            this.io.emit('gateway-status', { status: 'disconnected', message: 'MQTT broker connection lost.' });
        });

        this.mqttClient.on('error', (error) => {
            log.error('MQTT Client Error:', error.message);
            this.io.emit('gateway-error', `MQTT Error: ${error.message}`);
        });

        this.mqttClient.on('message', (topic, message) => {
            log.debug(`[MQTT ->] Topic: ${topic}, Message: ${message.toString()}`);
            this.io.emit('mqtt-message', { topic, message: message.toString() });
        });
    }

    setupSocketServer() {
        const httpServer = http.createServer();
        this.io = new Server(httpServer, this.config.socketio.options);

        this.io.on('connection', (socket) => {
            log.info(`Socket.IO client connected: ${socket.id}`);
            socket.emit('gateway-status', { status: this.isMqttConnected ? 'connected' : 'disconnected' });

            socket.on('mqtt-publish', ({ topic, message, options }) => {
                if (this.isMqttConnected) {
                    this.mqttClient.publish(topic, message, options, (err) => {
                        if (err) {
                            log.error(`[-> MQTT ERROR] Publish failed to topic "${topic}":`, err);
                            socket.emit('gateway-error', `Publish failed: ${err.message}`);
                        } else {
                            log.debug(`[-> MQTT SUCCESS] Published to topic "${topic}"`);
                            socket.emit('publish-success', { topic });
                        }
                    });
                } else if (this.config.queue.enabled) {
                    this.enqueueMessage({ topic, message, options }, socket);
                } else {
                    socket.emit('gateway-error', 'MQTT disconnected. Message dropped.');
                }
            });

            socket.on('mqtt-subscribe', (topic) => {
                if (typeof topic !== 'string' || topic.trim() === '') {
                    return socket.emit('gateway-error', 'Invalid topic for subscription.');
                }
                log.info(`Client ${socket.id} requested subscription to: ${topic}`);
                this.dynamicTopics.add(topic);
                if (this.isMqttConnected) {
                    this.mqttClient.subscribe(topic, { qos: 1 }, (err, granted) => {
                        if (err) {
                            log.error(`Failed to subscribe to ${topic}:`, err.message);
                            return socket.emit('gateway-error', `Failed to subscribe to ${topic}: ${err.message}`);
                        }
                        if (Array.isArray(granted) && granted.length > 0) {
                            log.info(`Subscription successful for ${granted[0].topic} with QoS ${granted[0].qos}`);
                        } else {
                            log.warn('Subscription granted array empty or undefined');
                        }
                        socket.emit('subscribe-success', topic);
                    });
                }
            });

            socket.on('mqtt-unsubscribe', (topic) => {
                log.info(`Client ${socket.id} requested unsubscribe from: ${topic}`);
                this.dynamicTopics.delete(topic);
                if (this.isMqttConnected) {
                    this.mqttClient.unsubscribe(topic, (err) => {
                        if (err) return socket.emit('gateway-error', `Failed to unsubscribe from ${topic}: ${err.message}`);
                        socket.emit('unsubscribe-success', topic);
                    });
                }
            });

            socket.on('disconnect', (reason) => {
                log.info(`Socket.IO client disconnected: ${socket.id}. Reason: ${reason}`);
            });
        });

        const port = this.config.socketio.port;
        httpServer.listen(port, () => log.info(`Socket.IO server running on port ${port}`));
    }

    enqueueMessage(msg, socket) {
        if (this.outgoingQueue.length >= this.config.queue.maxSize) {
            log.error('Outgoing queue is full. Message dropped.');
            return socket.emit('gateway-error', 'Queue is full. Message dropped.');
        }
        log.debug('MQTT offline. Enqueuing message.');
        this.outgoingQueue.push(msg);
        socket.emit('gateway-info', 'Message queued and will be sent upon reconnection.');
    }

    processOutgoingQueue() {
        if (this.outgoingQueue.length === 0) return;
        log.info(`Processing ${this.outgoingQueue.length} queued messages...`);
        while (this.outgoingQueue.length > 0 && this.isMqttConnected) {
            const { topic, message, options } = this.outgoingQueue.shift();
            this.mqttClient.publish(topic, message, options, (err) => {
                if (err) {
                    log.error(`Failed to publish queued message to topic "${topic}":`, err);
                } else {
                    log.debug(`Successfully published queued message to topic "${topic}".`);
                }
            });
        }
    }
}

// --- Application Entry Point ---
const config = loadAndValidateConfig('./config.toml');
const gateway = new MqttSocketGateway(config);
gateway.start();

// --- Graceful Shutdown ---
process.on('SIGINT', () => {
    log.info('SIGINT received. Shutting down gracefully...');
    if (gateway.mqttClient) {
        gateway.mqttClient.end(true, () => {
            log.info('MQTT client disconnected.');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});
