// src/config/config.h

#pragma once

#include <Arduino.h>

/*
   =========================================================
   CONFIGURATION GLOBALE DU FIRMWARE
   Projet : Monnayeur / Distributeur intelligent connecté
   Carte  : ESP32
   =========================================================
*/
static constexpr uint32_t COIN_END_TIMEOUT_MS = 1000;

namespace AppConfig {

    /*
       =====================================================
       IDENTITÉ MACHINE
       =====================================================
       Cette identité doit être unique pour chaque machine.

       Plus tard, dans la version SaaS :
       - MACHINE_00
       
       - 1
       - MACHINE_003
       etc.
    */
    namespace Machine {
        //static constexpr const char* ID = "1";
        //static constexpr const char* ID="MACHINE3";
        static constexpr const char* ID="MACHINE4";
        static constexpr const char* FIRMWARE_VERSION = "0.1.0";
    }

    /*
       =====================================================
       CONFIGURATION HARDWARE
       =====================================================
       Ces pins viennent de ton ancien code :

       COIN_PIN       = GPIO27
       LED_PIN        = GPIO26
       PULSE_OUT_PIN  = GPIO25
    */
    namespace Pins {
    static constexpr uint8_t COIN_INPUT_PIN          = 27;
    static constexpr uint8_t LED_STATUS_PIN          = 26;
    static constexpr uint8_t PULSE_OUT_PIN           = 25;
    static constexpr uint8_t MACHINE_AVAILABLE_PIN   = 33;
    }

    namespace Debug {
    static constexpr bool COIN_INPUT_RAW_LOG_ENABLED = false;
    static constexpr uint32_t COIN_INPUT_RAW_LOG_INTERVAL_MS = 2000;
}

    /*
       =====================================================
       CONFIGURATION DES IMPULSIONS MONNAYEUR
       =====================================================
       Ton ancien code utilisait :

       100 FCFA = 2 impulsions
       300 FCFA = 6 impulsions
       600 FCFA = 12 impulsions

       On garde cette logique, mais on la centralise ici.
    */
   /*
   =====================================================
   CONFIGURATION MONÉTAIRE / IMPULSIONS
   =====================================================

   Nouvelle règle :
   1 impulsion = 50 FCFA

   Pièces physiques :
   50 FCFA  = 1 impulsion
   100 FCFA = 2 impulsions
   200 FCFA = 4 impulsions
   250 FCFA = 5 impulsions
   500 FCFA = 10 impulsions

   Les transactions backend peuvent aller jusqu'à 5700 FCFA :
   5700 / 50 = 114 impulsions
*/
struct Tariff {
    uint16_t amountFcfa;
    uint8_t pulses;
    const char* label;
};

static constexpr Tariff TARIFFS[] = {
    {50,  1,  "50 FCFA"},
    {100, 2,  "100 FCFA"},
    {200, 4,  "200 FCFA"},
    {250, 5,  "250 FCFA"},
    {500, 10, "500 FCFA"}
};

static constexpr uint8_t TARIFF_COUNT =
    sizeof(TARIFFS) / sizeof(TARIFFS[0]);

namespace Money {
    static constexpr uint16_t PULSE_VALUE_FCFA = 50;

    static constexpr uint16_t MIN_AMOUNT_FCFA = 50;
    static constexpr uint16_t MAX_AMOUNT_FCFA = 5700;

    static constexpr uint8_t MAX_OUTPUT_PULSES =
        MAX_AMOUNT_FCFA / PULSE_VALUE_FCFA;

    static constexpr bool isAmountValid(uint16_t amountFcfa) {
        return amountFcfa >= MIN_AMOUNT_FCFA
            && amountFcfa <= MAX_AMOUNT_FCFA
            && amountFcfa % PULSE_VALUE_FCFA == 0;
    }

    static constexpr uint8_t amountToPulseCount(uint16_t amountFcfa) {
        return isAmountValid(amountFcfa)
            ? static_cast<uint8_t>(amountFcfa / PULSE_VALUE_FCFA)
            : 0;
    }

    static constexpr uint16_t pulseCountToAmount(uint16_t pulseCount) {
        return pulseCount > 0 && pulseCount <= MAX_OUTPUT_PULSES
            ? static_cast<uint16_t>(pulseCount * PULSE_VALUE_FCFA)
            : 0;
    }
}
    /*
       =====================================================
       TIMING / DÉLAIS
       =====================================================
       On évite de mettre des valeurs magiques partout
       dans le code.

       Exemple mauvais :
       delay(3000);

       Exemple propre :
       AppConfig::Timing::COIN_END_TIMEOUT_MS
    */
    namespace Timing {
        // Anti-rebond impulsion monnayeur : 50 ms
        static constexpr uint32_t COIN_DEBOUNCE_US = 50000;

        // Temps sans nouvelle impulsion pour considérer que la pièce est terminée
        static constexpr uint32_t COIN_END_TIMEOUT_MS = 1000;

        // Durée HIGH d’une impulsion envoyée
        static constexpr uint16_t PULSE_HIGH_MS = 100;

        // Durée LOW entre deux impulsions envoyées
        static constexpr uint16_t PULSE_LOW_MS = 100;

        // Heartbeat MQTT toutes les 15 secondes
        static constexpr uint32_t HEARTBEAT_INTERVAL_MS = 15000;

        // Délai entre tentatives Wi-Fi
       static constexpr uint32_t WIFI_RETRY_DELAY_MS = 5000;

        // Délai entre tentatives MQTT
        static constexpr uint16_t MQTT_RETRY_DELAY_MS = 5000;
    }

    /*
       =====================================================
       LIMITES SYSTÈME
       =====================================================
       Ces limites protègent le firmware contre des commandes
       trop grandes ou mal formées.
    */
    namespace Limits {
        static constexpr uint16_t MQTT_PAYLOAD_MAX_SIZE = 1024;
        static constexpr uint16_t TELEMETRY_JSON_SIZE   = 256;
        static constexpr uint16_t COMMAND_JSON_SIZE     = 256;

        // Sécurité : on refuse tout montant supérieur à cette limite
        static constexpr uint16_t MAX_ALLOWED_AMOUNT_FCFA = Money::MAX_AMOUNT_FCFA;
        // Sécurité : nombre maximal d’impulsions qu’on accepte d’envoyer
        static constexpr uint8_t MAX_OUTPUT_PULSES = Money::MAX_OUTPUT_PULSES;
    }

    /*
       =====================================================
       TOPICS MQTT
       =====================================================
       Ancien code :
       - monnayeur/cmd

       Nouveau modèle professionnel :
       - machines/MACHINE_001/commands
       - machines/MACHINE_001/events
       - machines/MACHINE_001/telemetry
       - machines/MACHINE_001/status

       Pour l’instant, on les écrit directement.
       Plus tard, on pourra les générer dynamiquement.
    */
    namespace Topics {
        // static constexpr const char* COMMANDS  = "machines/1/commands";
        // static constexpr const char* EVENTS    = "machines/1/events";
        // static constexpr const char* TELEMETRY = "machines/1/telemetry";
        // static constexpr const char* STATUS    = "machines/1/status";
        // static constexpr const char* ACKS      = "machines/1/acks";
    // static constexpr const char* COMMANDS  = "machines/MACHINE3/commands";
    // static constexpr const char* EVENTS    = "machines/MACHINE3/events";
    // static constexpr const char* TELEMETRY = "machines/MACHINE3/telemetry";
    // static constexpr const char* STATUS    = "machines/MACHINE3/status";
    // static constexpr const char* ACKS      = "machines/MACHINE3/acks";
    static constexpr const char* COMMANDS  = "machines/MACHINE4/commands";
    static constexpr const char* EVENTS    = "machines/MACHINE4/events";
    static constexpr const char* TELEMETRY = "machines/MACHINE4/telemetry";
    static constexpr const char* STATUS    = "machines/MACHINE4/status";
    static constexpr const char* ACKS      = "machines/MACHINE4/acks";
    }

    /*
       =====================================================
       ÉTATS SYSTÈME
       =====================================================
       On prépare déjà une logique professionnelle.
       Même si on ne l’utilise pas entièrement au début,
       elle va structurer la suite.
    */
    enum class SystemState {
        BOOT,
        WIFI_CONNECTING,
        MQTT_CONNECTING,
        IDLE,
        WAITING_FOR_COIN,
        COIN_RECEIVED,
        VALIDATING_COIN,
        DISPENSING,
        DISPENSE_SUCCESS,
        DISPENSE_FAILED,
        ERROR,
        MAINTENANCE
    };

    namespace Security {
    /*
       true  = MQTT avec TLS, utilisé pour HiveMQ Cloud ou broker sécurisé
       false = MQTT simple sans TLS, utilisé pour Mosquitto local
    */
    static constexpr bool MQTT_USE_TLS = false;

    /*
       Utilisé seulement si MQTT_USE_TLS = true.
       En test cloud, on peut mettre true.
       En production réelle, il faudra mettre false et utiliser un certificat CA.
    */
    static constexpr bool MQTT_USE_INSECURE_TLS_FOR_TEST = true;
}


}