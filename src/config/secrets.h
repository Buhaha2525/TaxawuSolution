#pragma once

namespace AppSecrets {

    namespace WiFiConfig {
        static constexpr const char* SSID = "Test";
        static constexpr const char* PASSWORD = "12345678";
    }

    namespace MqttConfig {
        /*
           Profil Mosquitto local 

           Broker installé sur ton PC Windows
        */
        //static constexpr const char* HOST = "13.140.174.32";
        static constexpr const char* HOST = "192.168.1.26";
        //static constexpr const char* HOST = "192.168.1.125";
        static constexpr uint16_t PORT = 1883;

        //static constexpr const char* CLIENT_ID = "MACHINE_001_ESP32";
        //static constexpr const char* CLIENT_ID = "MACHINE3";
        static constexpr const char* CLIENT_ID = "MACHINE4";

        /*
           Mosquitto local avec allow_anonymous true
           Donc pas de username/password
        */
        static constexpr const char* USERNAME = "";
        static constexpr const char* PASSWORD = "";

        /*
           false = Mosquitto local sans TLS sur port 1883
           true  = HiveMQ Cloud avec TLS sur port 8883
        */
        static constexpr bool USE_TLS = false;
    }

    namespace Certificates {
        /*
           Obligatoire pour compiler, même si Mosquitto local n'utilise pas TLS.
           Plus tard, pour HiveMQ Cloud en production, on mettra ici le certificat CA.
        */
        static constexpr const char* ROOT_CA = "";
    }
}