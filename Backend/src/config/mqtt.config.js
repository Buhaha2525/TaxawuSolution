// src/config/mqtt.config.js

require("dotenv").config();

const MACHINE_ID = process.env.MACHINE_ID || "1";

const MQTT_HOST = process.env.MQTT_HOST || "192.168.1.98";
const MQTT_PORT = Number(process.env.MQTT_PORT || 1883);
const MQTT_PROTOCOL = process.env.MQTT_PROTOCOL || "mqtt";

const MQTT_USERNAME = process.env.MQTT_USERNAME || "";
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || "";

const MQTT_URL = `${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}`;

function getMachineTopics(machineId = MACHINE_ID) {
    return {
        commands: `machines/${machineId}/commands`,
        events: `machines/${machineId}/events`,
        telemetry: `machines/${machineId}/telemetry`,
        status: `machines/${machineId}/status`,
        acks: `machines/${machineId}/acks`,
        all: `machines/${machineId}/#`
    };
}

const MQTT_OPTIONS = {
    reconnectPeriod: 5000,
    keepalive: 60,
    clean: true
};

if (MQTT_USERNAME && MQTT_PASSWORD) {
    MQTT_OPTIONS.username = MQTT_USERNAME;
    MQTT_OPTIONS.password = MQTT_PASSWORD;
}

module.exports = {
    MACHINE_ID,
    MQTT_HOST,
    MQTT_PORT,
    MQTT_PROTOCOL,
    MQTT_URL,
    MQTT_OPTIONS,
    getMachineTopics
};