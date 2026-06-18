#include <Arduino.h>
#include <EEPROM.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "secrets.h"   // Contient tes identifiants WiFi + certificats AWS

/* =========================================================
   CONFIGURATION HARDWARE
   ========================================================= */
#define COIN_PIN D2      // Pin impulsion monnayeur
#define LED_PIN  D7      // Lampe témoin

/* =========================================================
   VARIABLES GLOBALES
   ========================================================= */
volatile int impulsCount        = 0;
int          lastImpulsReported = 0;
int          montantChoisi      = 0;   // 100, 200 ou 500
int          impulsAttendu      = 0;   // 1, 2 ou 3 selon montant
bool         waitingForCoinSent = false;
int          i                  = 0;
float        total_amount       = 0;

/* =========================================================
   CONFIGURATION MQTT AWS
   ========================================================= */
WiFiClientSecure netClient;
PubSubClient mqttClient(netClient);

/* =========================================================
   INTERRUPTION MONNAYEUR
   ========================================================= */
void IRAM_ATTR incomingImpuls() {
  impulsCount++;
  i = 0; // reset du compteur temps à chaque impulsion
}

/* =========================================================
   FONCTIONS RESEAU & MQTT
   ========================================================= */
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("WiFi: connexion");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi connecté !");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal RSSI: ");
    Serial.println(WiFi.RSSI());
  } else {
    Serial.println("\n❌ Échec connexion WiFi");
  }
}

void connectMQTT() {
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 5) {
    Serial.print("MQTT: tentative ");
    Serial.print(attempts + 1);
    Serial.print(" vers ");
    Serial.println(AWS_IOT_ENDPOINT);

    if (mqttClient.connect(THINGNAME)) {
      Serial.println("✅ MQTT connecté !");
      
      StaticJsonDocument<128> doc;
      doc["message"] = "MQTT connecté";
      doc["timestamp"] = millis();
      char payload[128];
      serializeJson(doc, payload);
      
      bool success = mqttClient.publish(AWS_IOT_PUBLISH_TOPIC, payload);
      Serial.print("Test publication: ");
      Serial.println(success ? "✅ OK" : "❌ FAIL");
      
    } else {
      Serial.print("❌ Échec MQTT, code: ");
      Serial.println(mqttClient.state());
    }

    attempts++;
    if (!mqttClient.connected()) delay(3000);
  }
}

void publishTelemetry(const char* eventName) {
  if (WiFi.status() != WL_CONNECTED || !mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["ev"] = eventName;
  doc["montantChoisi"] = montantChoisi;
  doc["impulsCount"] = impulsCount;
  doc["ts"] = (uint32_t)(millis()/1000);
  doc["free_heap"] = ESP.getFreeHeap();
  doc["wifi_rssi"] = WiFi.RSSI();
  doc["id"] = THINGNAME;

  char payload[256];
  serializeJson(doc, payload);
  mqttClient.publish(AWS_IOT_PUBLISH_TOPIC, payload);
}

/* =========================================================
   RESET GLOBAL
   ========================================================= */
void resetSystem() {
  montantChoisi      = 0;
  impulsAttendu      = 0;
  impulsCount        = 0;
  lastImpulsReported = 0;
  waitingForCoinSent = false;
  i                  = 0;

  // LED clignotante pour confirmation
  for (int j = 0; j < 3; j++) {
    digitalWrite(LED_PIN, HIGH); delay(150);
    digitalWrite(LED_PIN, LOW);  delay(150);
  }

  Serial.println("------------------------------------------");
  Serial.println("Systeme reinitialise.");
  Serial.println("------------------------------------------");
  Serial.println("Choisissez un montant :");
  Serial.println("  1 --> 100 FCFA (1 impulsion)");
  Serial.println("  2 --> 200 FCFA (2 impulsions)");
  Serial.println("  3 --> 500 FCFA (3 impulsions)");
  Serial.println("------------------------------------------");
}

/* =========================================================
   SETUP
   ========================================================= */
void setup() {
  Serial.begin(115200);

  pinMode(LED_PIN,  OUTPUT);
  pinMode(COIN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(COIN_PIN), incomingImpuls, FALLING);

  EEPROM.begin(512);
  EEPROM.get(0, total_amount);

  Serial.println("==========================================");
  Serial.println("     DISTRIBUTEUR - CHOIX DU MONTANT     ");
  Serial.println("==========================================");
  Serial.println("Choisissez un montant :");
  Serial.println("  1 --> 100 FCFA (1 impulsion)");
  Serial.println("  2 --> 200 FCFA (2 impulsions)");
  Serial.println("  3 --> 500 FCFA (3 impulsions)");
  Serial.println("------------------------------------------");

  connectWiFi();
  if (WiFi.status() == WL_CONNECTED) {
    netClient.setCACert(AWS_CERT_CA);
    netClient.setCertificate(AWS_CERT_CRT);
    netClient.setPrivateKey(AWS_CERT_PRIVATE);
    mqttClient.setServer(AWS_IOT_ENDPOINT, 8883);
    connectMQTT();
    delay(500);
    publishTelemetry("boot");
  }
}

/* =========================================================
   LOOP PRINCIPALE
   ========================================================= */
void loop() {
  // Reconnexion
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected()) connectMQTT();
  if (mqttClient.connected()) mqttClient.loop();

  // Envoi heartbeat
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 15000) {
    lastHeartbeat = millis();
    publishTelemetry("heartbeat");
  }

  i++;

  // --- Lecture Serial Monitor ---
  if (Serial.available() > 0) {
    String choix = Serial.readStringUntil('\n');
    choix.trim();

    // Commande RESET manuelle
    if (choix.equalsIgnoreCase("RESET")) {
      resetSystem();
      return;
    }

    // Sélection du montant (seulement si pas encore choisi)
    if (montantChoisi == 0) {
      if (choix == "1") {
        montantChoisi = 100;
        impulsAttendu = 1;
        publishTelemetry("montant_100_choisi");
      } else if (choix == "2") {
        montantChoisi = 200;
        impulsAttendu = 2;
        publishTelemetry("montant_200_choisi");
      } else if (choix == "3") {
        montantChoisi = 500;
        impulsAttendu = 3;
        publishTelemetry("montant_500_choisi");
      } else {
        Serial.println("Choix invalide ! Tapez 1, 2 ou 3.");
        return;
      }

      Serial.print("Montant selectionne : ");
      Serial.print(montantChoisi);
      Serial.println(" FCFA");
      Serial.print("Attendu            : ");
      Serial.print(impulsAttendu);
      Serial.println(" impulsion(s)");
    }
  }

  // --- Passer en attente de pièce une seule fois ---
  if (montantChoisi != 0 && !waitingForCoinSent) {
    Serial.println("------------------------------------------");
    Serial.println("Inserez votre piece...");
    Serial.println("------------------------------------------");
    waitingForCoinSent = true;
    i = 0; // reset timer au moment où on commence à attendre
  }

  // --- Signaler chaque nouvelle impulsion reçue ---
  if (impulsCount != lastImpulsReported && waitingForCoinSent) {
    Serial.print("Impulsion recue : ");
    Serial.print(impulsCount);
    Serial.println(" impulsion(s)");
    lastImpulsReported = impulsCount;
    // i est déjà remis à 0 dans l'interruption
  }

  // --- Validation après ~3 secondes sans nouvelle impulsion ---
  if (i >= 300 && montantChoisi != 0 && waitingForCoinSent) {

    bool pieceValidee = false;

    if (impulsCount == impulsAttendu) {
      pieceValidee = true;
    }

    Serial.println("------------------------------------------");
    if (pieceValidee) {
      Serial.print("Piece validee ! ");
      Serial.print(montantChoisi);
      Serial.println(" FCFA acceptes.");
      Serial.println("Distribution en cours...");

      publishTelemetry("piece_validee");
      total_amount += montantChoisi;
      EEPROM.put(0, total_amount);
      EEPROM.commit();

      digitalWrite(LED_PIN, HIGH);
      delay(2000);
      digitalWrite(LED_PIN, LOW);

    } else if (impulsCount > 0) {
      Serial.print("Erreur ! ");
      Serial.print(impulsCount);
      Serial.print(" impulsion(s) recues, ");
      Serial.print(impulsAttendu);
      Serial.println(" attendue(s).");
      Serial.println("Piece rejetee.");
      publishTelemetry("piece_rejetee");
    } else {
      Serial.println("Aucune piece inseree. Operation annulee.");
      publishTelemetry("operation_annulee");
    }

    resetSystem();
  }

  delay(10);
}
