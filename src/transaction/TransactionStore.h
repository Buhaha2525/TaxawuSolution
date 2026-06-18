// src/transaction/TransactionStore.h

#pragma once

#include <Arduino.h>
#include <Preferences.h>

/*
   =========================================================
   MODULE : TransactionStore

   Rôle :
   - Stocker localement la dernière transaction importante
   - Survivre à un redémarrage de l'ESP32
   - Préparer la gestion des coupures électriques
   - Préparer la prévention des doubles distributions
   =========================================================
*/

class TransactionStore {
public:
    enum class Status : uint8_t {
        EMPTY = 0,
        CREATED = 1,
        DISPENSING = 2,
        SUCCESS = 3,
        FAILED = 4
    };

    struct Record {
        char transactionId[48];
        char source[32];
        uint16_t amountFcfa;
        Status status;
        uint32_t updatedAtMs;
    };

    TransactionStore();

    bool begin();

    bool saveTransaction(
        const char* transactionId,
        uint16_t amountFcfa,
        const char* source,
        Status status
    );

    bool updateStatus(Status status);

    bool loadLastTransaction(Record& record);
    bool hasStoredTransaction() const;
    bool hasPendingTransaction() const;

    bool clear();

    void printLastTransaction();

    static const char* statusToString(Status status);

private:
    Preferences _preferences;

    bool _ready;
    bool _hasRecord;

    Record _lastRecord;

    void resetLocalRecord();
    void loadFromPreferences();
    bool writeToPreferences();

    void copySafe(
        char* destination,
        size_t destinationSize,
        const char* source
    );
};