// src/main.cpp

#include <Arduino.h>
#include <ArduinoJson.h>

#include "config/config.h"
#include "config/secrets.h"
#include "hardware/PulseOutput.h"
#include "hardware/CoinAcceptor.h"
#include "hardware/Dispenser.h"
#include "transaction/TransactionManager.h"
#include "transaction/TransactionStore.h"
#include "telemetry/TelemetryService.h"
#include "security/CommandValidator.h"
#include "network/WiFiManager.h"
#include "network/MqttManager.h"

/*
   =========================================================
   PROJET : MONNAYEUR / DISTRIBUTEUR INTELLIGENT CONNECTÉ
   CARTE  : ESP32 DOIT DEVKIT V1
   =========================================================
*/

using AppConfig::SystemState;

static SystemState currentState = SystemState::BOOT;
static uint32_t lastHeartbeatMs = 0;
static bool ledState = false;

/*
   Objet global du module PulseOutput.
   Il est global parce que setup(), loop() et les fonctions de test
   doivent pouvoir l'utiliser.
*/
PulseOutput pulseOutput;

CoinAcceptor coinAcceptor;

Dispenser dispenser;

TransactionManager transactionManager;

TransactionStore transactionStore;

TelemetryService telemetryService;

CommandValidator commandValidator;

WiFiManager wifiManager;

MqttManager mqttManager;

bool coinInputDisabledBySystem = false;

uint32_t lastRawDebugMs = 0;
String lastProcessedMqttTransactionId = "";
uint32_t lastProcessedMqttTransactionMs = 0;

uint16_t lastCoinEventAmount = 0;
uint16_t lastCoinEventPulses = 0;
uint32_t lastCoinEventMs = 0;

bool lastPublishedMachineAvailability = false;
bool hasPublishedMachineAvailability = false;
uint32_t lastMachineAvailabilityPublishMs = 0;

static constexpr uint32_t COIN_EVENT_DUPLICATE_WINDOW_MS = 1000;
static constexpr uint32_t MACHINE_AVAILABILITY_PERIODIC_PUBLISH_MS = 5000;

void disableCoinInputDuringCreditEmission();
void enableCoinInputAfterCreditEmission();

const char* systemStateToString(SystemState state) {
    switch (state) {
        case SystemState::BOOT:
            return "BOOT";

        case SystemState::WIFI_CONNECTING:
            return "WIFI_CONNECTING";

        case SystemState::MQTT_CONNECTING:
            return "MQTT_CONNECTING";

        case SystemState::IDLE:
            return "IDLE";

        case SystemState::WAITING_FOR_COIN:
            return "WAITING_FOR_COIN";

        case SystemState::COIN_RECEIVED:
            return "COIN_RECEIVED";

        case SystemState::VALIDATING_COIN:
            return "VALIDATING_COIN";

        case SystemState::DISPENSING:
            return "DISPENSING";

        case SystemState::DISPENSE_SUCCESS:
            return "DISPENSE_SUCCESS";

        case SystemState::DISPENSE_FAILED:
            return "DISPENSE_FAILED";

        case SystemState::ERROR:
            return "ERROR";

        case SystemState::MAINTENANCE:
            return "MAINTENANCE";

        default:
            return "UNKNOWN";
    }
}

void setSystemState(SystemState newState) {
    currentState = newState;

    Serial.print("[STATE] Nouvel état système : ");
    Serial.println(systemStateToString(currentState));
}
bool isDuplicateMqttTransactionId(const char* transactionId);
void rememberMqttTransactionId(const char* transactionId);

bool isMachineCanAcceptPayment();
void updateMachineAvailabilityStatus(bool forcePublish = false);

bool isDuplicateCoinPaymentEvent(uint16_t amountFcfa, uint16_t pulseCount);
void rememberCoinPaymentEvent(uint16_t amountFcfa, uint16_t pulseCount);
String buildCoinPaymentEventId(uint16_t amountFcfa, uint16_t pulseCount);

void initHardwarePins() {
    pinMode(AppConfig::Pins::COIN_INPUT_PIN, INPUT_PULLUP);
    pinMode(AppConfig::Pins::LED_STATUS_PIN, OUTPUT);
    pinMode(AppConfig::Pins::PULSE_OUT_PIN, OUTPUT);

    digitalWrite(AppConfig::Pins::LED_STATUS_PIN, LOW);
    digitalWrite(AppConfig::Pins::PULSE_OUT_PIN, LOW);

    Serial.println("[BOOT] Pins hardware initialisées.");
}

void printBootInfo() {
    Serial.println();
    Serial.println("==============================================");
    Serial.println("   MONNAYEUR / DISTRIBUTEUR INTELLIGENT ESP32 ");
    Serial.println("==============================================");

    Serial.print("Machine ID       : ");
    Serial.println(AppConfig::Machine::ID);

    Serial.print("Firmware version : ");
    Serial.println(AppConfig::Machine::FIRMWARE_VERSION);

    Serial.print("MQTT Client ID   : ");
    Serial.println(AppSecrets::MqttConfig::CLIENT_ID);

    Serial.println("----------------------------------------------");
    Serial.println("Configuration hardware :");

    Serial.print("Coin input pin   : GPIO ");
    Serial.println(AppConfig::Pins::COIN_INPUT_PIN);

    Serial.print("LED status pin   : GPIO ");
    Serial.println(AppConfig::Pins::LED_STATUS_PIN);

    Serial.print("Pulse output pin : GPIO ");
    Serial.println(AppConfig::Pins::PULSE_OUT_PIN);

    Serial.println("----------------------------------------------");
    Serial.println("Tarifs configurés :");

    for (uint8_t i = 0; i < AppConfig::TARIFF_COUNT; i++) {
        Serial.print("- ");
        Serial.print(AppConfig::TARIFFS[i].label);
        Serial.print(" = ");
        Serial.print(AppConfig::TARIFFS[i].pulses);
        Serial.println(" impulsions");
    }

    Serial.println("----------------------------------------------");
    Serial.println("Topics MQTT prévus :");

    Serial.print("Commands  : ");
    Serial.println(AppConfig::Topics::COMMANDS);

    Serial.print("Events    : ");
    Serial.println(AppConfig::Topics::EVENTS);

    Serial.print("Telemetry : ");
    Serial.println(AppConfig::Topics::TELEMETRY);

    Serial.print("Status    : ");
    Serial.println(AppConfig::Topics::STATUS);

    Serial.print("ACKs      : ");
    Serial.println(AppConfig::Topics::ACKS);

    Serial.println("==============================================");
    Serial.println();
}

void updateHeartbeat() {
    const uint32_t now = millis();

    if (now - lastHeartbeatMs >= AppConfig::Timing::HEARTBEAT_INTERVAL_MS) {
        lastHeartbeatMs = now;

        ledState = !ledState;
        digitalWrite(AppConfig::Pins::LED_STATUS_PIN, ledState ? HIGH : LOW);

       Serial.print("[HEARTBEAT] Système vivant | État : ");
       Serial.println(systemStateToString(currentState));

       telemetryService.publishHeartbeat(currentState);

       const bool machineCanAcceptPayment = isMachineCanAcceptPayment();

       telemetryService.publishMachineAvailabilityStatus(
       machineCanAcceptPayment
       );

       Serial.print("[MACHINE][COUNTER] Disponibilité machine : ");
       Serial.println(machineCanAcceptPayment ? "AVAILABLE" : "UNAVAILABLE");
     }
}
/*
   Test manuel des impulsions depuis le Serial Monitor.

   1 = 100 FCFA = 2 impulsions
   2 = 300 FCFA = 6 impulsions
   3 = 600 FCFA = 12 impulsions
*/
void enableCoinInputAfterCreditEmission() {
    coinAcceptor.enable();

    coinInputDisabledBySystem = false;

    Serial.println("[MAIN][PROTECTION] Lecture COIN réactivée après émission ESP32.");
}

void handleSerialPulseTest() {
    if (!Serial.available()) {
        return;
    }

    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() == 0) {
    return;
      }
    
    const AppConfig::Tariff* selectedTariff = nullptr;

    if (input == "1") {
        selectedTariff = &AppConfig::TARIFFS[0]; // 100 FCFA
    } 
    else if (input == "2") {
        selectedTariff = &AppConfig::TARIFFS[1]; // 300 FCFA
    } 
    else if (input == "3") {
        selectedTariff = &AppConfig::TARIFFS[2]; // 600 FCFA
    } 
    else {
        Serial.println("[TEST] Commande inconnue.");
        Serial.println("[TEST] Tape 1, 2 ou 3 dans le Serial Monitor.");
        return;
    }

    Serial.println("----------------------------------------------");
    Serial.print("[TEST] Montant choisi : ");
    Serial.print(selectedTariff->amountFcfa);
    Serial.println(" FCFA");

    Serial.print("[TEST] Impulsions à envoyer : ");
    Serial.println(selectedTariff->pulses);
    Serial.println("----------------------------------------------");

    char transactionId[40];
snprintf(
    transactionId,
    sizeof(transactionId),
    "SERIAL-%lu",
    millis()
);

CommandValidator::DispenseCommand command = {
    "DISPENSE",
    AppConfig::Machine::ID,
    transactionId,
    selectedTariff->amountFcfa,
    "serial_test"
};

CommandValidator::ValidationResult validation;

if (!commandValidator.validateDispenseCommand(command, validation)) {
    Serial.println("----------------------------------------------");
    Serial.println("[MAIN][SECURITY] Commande refusée.");

    Serial.print("[MAIN][SECURITY] Code : ");
    Serial.println(validation.errorCode);

    Serial.print("[MAIN][SECURITY] Message : ");
    Serial.println(validation.message);
    Serial.println("----------------------------------------------");

    telemetryService.publishError(
        validation.errorCode,
        validation.message
    );

    setSystemState(SystemState::IDLE);
    return;
}

Serial.println("----------------------------------------------");
Serial.println("[MAIN][SECURITY] Commande validée.");

Serial.print("[MAIN][SECURITY] Message : ");
Serial.println(validation.message);

Serial.print("[MAIN][SECURITY] Impulsions autorisées : ");
Serial.println(validation.pulseCount);
Serial.println("----------------------------------------------");

disableCoinInputDuringCreditEmission();

if (transactionManager.startTransaction(
        selectedTariff->amountFcfa,
        transactionId,
        "serial_test"
    )) {
    setSystemState(SystemState::DISPENSING);
} else {
    enableCoinInputAfterCreditEmission();
}
}

bool mqttPublishAdapter(const char* topic, const char* payload) {
    return mqttManager.publish(topic, payload);
}

void handleMqttMessage(const char* topic, const char* payload) {
    Serial.println("----------------------------------------------");
    Serial.println("[MAIN] Message MQTT transmis à main.cpp.");

    Serial.print("[MAIN] Topic : ");
    Serial.println(topic);

    Serial.print("[MAIN] Payload : ");
    Serial.println(payload);
    Serial.println("----------------------------------------------");

    JsonDocument doc;

    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        Serial.println("[MAIN][MQTT][ERREUR] JSON invalide.");

        telemetryService.publishError(
            "INVALID_JSON",
            "Payload MQTT JSON invalide."
        );

        return;
    }

    const char* action = doc["action"] | "";
    const char* machineId = doc["machineId"] | "";
    const char* transactionId = doc["transactionId"] | "";
    const char* source = doc["source"] | "mqtt";
    uint16_t amountFcfa = doc["amountFcfa"] | 0;

    CommandValidator::DispenseCommand command = {
        action,
        machineId,
        transactionId,
        amountFcfa,
        source
    };

    CommandValidator::ValidationResult validation;

    if (!commandValidator.validateDispenseCommand(command, validation)) {
        Serial.println("----------------------------------------------");
        Serial.println("[MAIN][MQTT][SECURITY] Commande MQTT refusée.");

        Serial.print("[MAIN][MQTT][SECURITY] Code : ");
        Serial.println(validation.errorCode);

        Serial.print("[MAIN][MQTT][SECURITY] Message : ");
        Serial.println(validation.message);
        Serial.println("----------------------------------------------");

        telemetryService.publishError(
            validation.errorCode,
            validation.message
        );

        return;
    }

    Serial.println("----------------------------------------------");
    Serial.println("[MAIN][MQTT][SECURITY] Commande MQTT validée.");

    Serial.print("[MAIN][MQTT][SECURITY] Transaction ID : ");
    Serial.println(transactionId);

   if (isDuplicateMqttTransactionId(transactionId)) {
    Serial.println("[MAIN][MQTT][ANTI-DOUBLON] Transaction MQTT déjà traitée.");
    Serial.println("[MAIN][MQTT][ANTI-DOUBLON] Distribution ignorée pour éviter un double service.");

    telemetryService.publishError(
        "DUPLICATE_MQTT_TRANSACTION",
        "Commande MQTT ignorée : transactionId déjà traité."
    );

    return;
}

const bool machineCanAcceptPayment = isMachineCanAcceptPayment();

Serial.print("[MAIN][MQTT][SECURITY] COUNTER au moment de la commande : ");
Serial.println(machineCanAcceptPayment ? "HIGH / AVAILABLE" : "LOW / UNAVAILABLE");

telemetryService.publishMachineAvailabilityStatus(machineCanAcceptPayment);

if (!machineCanAcceptPayment) {
    Serial.println("----------------------------------------------");
    Serial.println("[MAIN][MQTT][SECURITY] Commande DISPENSE refusée.");
    Serial.println("[MAIN][MQTT][SECURITY] Raison : COUNTER LOW.");
    Serial.println("[MAIN][MQTT][SECURITY] Machine indisponible, vente en cours ou STOP SALE.");

    Serial.print("[MAIN][MQTT][SECURITY] Transaction ID refusée : ");
    Serial.println(transactionId);

    Serial.print("[MAIN][MQTT][SECURITY] Montant refusé : ");
    Serial.print(amountFcfa);
    Serial.println(" FCFA");
    Serial.println("----------------------------------------------");

    rememberMqttTransactionId(transactionId);

    telemetryService.publishError(
        "MACHINE_UNAVAILABLE_COUNTER_LOW",
        "Commande DISPENSE refusée : machine indisponible, vente en cours ou STOP SALE."
    );

    return;
}

rememberMqttTransactionId(transactionId);

Serial.print("[MAIN][MQTT][SECURITY] Montant : ");
Serial.print(amountFcfa);
Serial.println(" FCFA");

    Serial.print("[MAIN][MQTT][SECURITY] Impulsions autorisées : ");
    Serial.println(validation.pulseCount);
    Serial.println("----------------------------------------------");

    disableCoinInputDuringCreditEmission();

if (!transactionManager.startTransaction(
        amountFcfa,
        transactionId,
        source
    )) {
    Serial.println("[MAIN][MQTT][ERREUR] Impossible de démarrer la transaction.");

    telemetryService.publishError(
        "TRANSACTION_START_FAILED",
        "Impossible de démarrer la transaction MQTT."
    );

    enableCoinInputAfterCreditEmission();
    return;
}

setSystemState(SystemState::DISPENSING);
}

void debugRawCoinInputPeriodic() {
    if (!AppConfig::Debug::COIN_INPUT_RAW_LOG_ENABLED) {
        return;
    }

    const uint32_t now = millis();

    if (
        now - lastRawDebugMs <
        AppConfig::Debug::COIN_INPUT_RAW_LOG_INTERVAL_MS
    ) {
        return;
    }

    lastRawDebugMs = now;

    const int level = digitalRead(AppConfig::Pins::COIN_INPUT_PIN);

    Serial.print("[DEBUG][GPIO27] Niveau brut = ");
    Serial.println(level == HIGH ? "HIGH" : "LOW");
}

bool isDuplicateMqttTransactionId(const char* transactionId) {
    if (transactionId == nullptr) {
        return false;
    }

    String id = String(transactionId);

    if (id.length() == 0) {
        return false;
    }

    return id == lastProcessedMqttTransactionId;
}

void rememberMqttTransactionId(const char* transactionId) {
    if (transactionId == nullptr) {
        return;
    }

    lastProcessedMqttTransactionId = String(transactionId);
    lastProcessedMqttTransactionMs = millis();
}

bool isDuplicateCoinPaymentEvent(uint16_t amountFcfa, uint16_t pulseCount) {
    const uint32_t now = millis();

    if (lastCoinEventMs == 0) {
        return false;
    }

    return (
        amountFcfa == lastCoinEventAmount &&
        pulseCount == lastCoinEventPulses &&
        (now - lastCoinEventMs) <= COIN_EVENT_DUPLICATE_WINDOW_MS
    );
}

void rememberCoinPaymentEvent(uint16_t amountFcfa, uint16_t pulseCount) {
    lastCoinEventAmount = amountFcfa;
    lastCoinEventPulses = pulseCount;
    lastCoinEventMs = millis();
}

String buildCoinPaymentEventId(uint16_t amountFcfa, uint16_t pulseCount) {
    String eventId = String(AppConfig::Machine::ID);
    eventId += "-COIN-";
    eventId += String(millis());
    eventId += "-";
    eventId += String(amountFcfa);
    eventId += "-";
    eventId += String(pulseCount);

    return eventId;
}

void disableCoinInputDuringCreditEmission() {
    coinInputDisabledBySystem = true;

    coinAcceptor.disable();

    Serial.println("[MAIN][PROTECTION] Lecture COIN désactivée pendant émission ESP32.");
}

bool isMachineCanAcceptPayment() {
    return digitalRead(AppConfig::Pins::MACHINE_AVAILABLE_PIN) == HIGH;
}

void updateMachineAvailabilityStatus(bool forcePublish) {
    const bool machineCanAcceptPayment = isMachineCanAcceptPayment();
    const uint32_t now = millis();

    const bool changed =
        !hasPublishedMachineAvailability ||
        machineCanAcceptPayment != lastPublishedMachineAvailability;

    const bool periodic =
        now - lastMachineAvailabilityPublishMs >= MACHINE_AVAILABILITY_PERIODIC_PUBLISH_MS;

    if (!forcePublish && !changed && !periodic) {
        return;
    }

    telemetryService.publishMachineAvailabilityStatus(machineCanAcceptPayment);

    lastPublishedMachineAvailability = machineCanAcceptPayment;
    hasPublishedMachineAvailability = true;
    lastMachineAvailabilityPublishMs = now;

    Serial.print("[MACHINE][COUNTER] Status publié : ");
    Serial.println(machineCanAcceptPayment ? "AVAILABLE" : "UNAVAILABLE");
}

void setup() {
    Serial.begin(115200);
    delay(500);

    printBootInfo();
    initHardwarePins();

    pinMode(AppConfig::Pins::COIN_INPUT_PIN, INPUT_PULLUP);
    pinMode(AppConfig::Pins::MACHINE_AVAILABLE_PIN, INPUT);

    pulseOutput.begin();
    coinAcceptor.begin();
    dispenser.begin(&pulseOutput);

    transactionStore.begin();

     if (transactionStore.hasPendingTransaction()) {
     Serial.println("[BOOT][WARN] Une transaction locale semble avoir été interrompue.");
     transactionStore.printLastTransaction();
       }

      transactionManager.begin(&dispenser, &transactionStore);

     telemetryService.begin();
     commandValidator.begin();

     wifiManager.begin();

     mqttManager.begin();
     mqttManager.setMessageCallback(handleMqttMessage);
     telemetryService.setPublisher(mqttPublishAdapter);

     telemetryService.publishBoot();

    setSystemState(SystemState::IDLE);

    Serial.println("[BOOT] Initialisation terminée.");
    Serial.println("[VERSION] Firmware test affichage montant v0.1.1");
    Serial.println("[BOOT] Firmware prêt pour ajout progressif des modules.");
    Serial.println("[TEST] Tape 1, 2 ou 3 pour tester les impulsions.");
}

void loop() {
    wifiManager.update();
    mqttManager.update();

    updateMachineAvailabilityStatus(false);

    debugRawCoinInputPeriodic();

    updateHeartbeat();

    handleSerialPulseTest();

    if (!coinInputDisabledBySystem) {
        coinAcceptor.update();

        if (coinAcceptor.hasCoinEvent()) {
            const uint16_t amount = coinAcceptor.getLastAmountFcfa();
            const uint16_t pulses = coinAcceptor.getLastPulseCount();

            Serial.println("----------------------------------------------");
            Serial.println("[MAIN] Événement monnayeur détecté.");

            Serial.print("[MAIN] Impulsions reçues : ");
            Serial.println(pulses);

            if (amount > 0) {
    Serial.print("[MAIN] Montant reconnu : ");
    Serial.print(amount);
    Serial.println(" FCFA.");

    if (isDuplicateCoinPaymentEvent(amount, pulses)) {
        Serial.println("[MAIN][ANTI-DOUBLON] Paiement physique déjà publié récemment. Publication ignorée.");
    } else {
        String eventId = buildCoinPaymentEventId(amount, pulses);

       const uint16_t pulseCount = coinAcceptor.getLastPulseCount();

const bool published = telemetryService.publishCoinPaymentEvent(
    amount,
    pulseCount,
    "physical_coin",
    eventId.c_str()
);

if (published) {
    Serial.print("[MAIN] Paiement physique publié vers MQTT. Event ID : ");
    Serial.println(eventId);
} else {
    Serial.print("[MAIN][WARN] Paiement physique détecté mais publication MQTT échouée. Event ID : ");
    Serial.println(eventId);
}
    }

    setSystemState(SystemState::IDLE);
}

            Serial.println("----------------------------------------------");
        }
    }

        transactionManager.update();

   if (transactionManager.hasSucceeded()) {
    telemetryService.publishTransactionEvent(
        "transaction_success",
        transactionManager.getLastCompletedTransactionId(),
        transactionManager.getLastCompletedAmountFcfa(),
        transactionManager.getLastCompletedSource(),
        "SUCCESS"
    );

    enableCoinInputAfterCreditEmission();

    setSystemState(AppConfig::SystemState::IDLE);

    Serial.println("[MAIN] Transaction confirmée par TransactionManager.");
}

    if (transactionManager.hasFailed()) {
        telemetryService.publishTransactionEvent(
            "transaction_failed",
            transactionManager.getCurrentTransactionId(),
            transactionManager.getCurrentAmountFcfa(),
            transactionManager.getCurrentSource(),
            "FAILED"
        );

        enableCoinInputAfterCreditEmission();

        setSystemState(SystemState::IDLE);
        Serial.println("[MAIN][WARN] Transaction refusée ou échouée.");
    }
}