// src/transaction/TransactionStore.cpp

#include "TransactionStore.h"

TransactionStore::TransactionStore()
    : _ready(false),
      _hasRecord(false) {
    resetLocalRecord();
}

bool TransactionStore::begin() {
    _ready = _preferences.begin("tx_store", false);

    if (!_ready) {
        Serial.println("[TransactionStore][ERREUR] Impossible d'ouvrir Preferences.");
        return false;
    }

    loadFromPreferences();

    Serial.println("[TransactionStore] Module initialisé.");

    if (_hasRecord) {
        printLastTransaction();
    } else {
        Serial.println("[TransactionStore] Aucune transaction locale enregistrée.");
    }

    return true;
}

bool TransactionStore::saveTransaction(
    const char* transactionId,
    uint16_t amountFcfa,
    const char* source,
    Status status
) {
    if (!_ready) {
        Serial.println("[TransactionStore][ERREUR] Store non initialisé.");
        return false;
    }

    copySafe(_lastRecord.transactionId, sizeof(_lastRecord.transactionId), transactionId);
    copySafe(_lastRecord.source, sizeof(_lastRecord.source), source);

    _lastRecord.amountFcfa = amountFcfa;
    _lastRecord.status = status;
    _lastRecord.updatedAtMs = millis();

    _hasRecord = true;

    if (!writeToPreferences()) {
        Serial.println("[TransactionStore][ERREUR] Échec sauvegarde transaction.");
        return false;
    }

    Serial.println("[TransactionStore] Transaction sauvegardée localement.");

    Serial.print("[TransactionStore] Transaction ID : ");
    Serial.println(_lastRecord.transactionId);

    Serial.print("[TransactionStore] Montant : ");
    Serial.print(_lastRecord.amountFcfa);
    Serial.println(" FCFA");

    Serial.print("[TransactionStore] Statut : ");
    Serial.println(statusToString(_lastRecord.status));

    return true;
}

bool TransactionStore::updateStatus(Status status) {
    if (!_ready) {
        Serial.println("[TransactionStore][ERREUR] Store non initialisé.");
        return false;
    }

    if (!_hasRecord) {
        Serial.println("[TransactionStore][WARN] Aucun enregistrement à mettre à jour.");
        return false;
    }

    _lastRecord.status = status;
    _lastRecord.updatedAtMs = millis();

    if (!writeToPreferences()) {
        Serial.println("[TransactionStore][ERREUR] Échec mise à jour statut.");
        return false;
    }

    Serial.print("[TransactionStore] Statut mis à jour : ");
    Serial.println(statusToString(status));

    return true;
}

bool TransactionStore::loadLastTransaction(Record& record) {
    if (!_hasRecord) {
        return false;
    }

    record = _lastRecord;
    return true;
}

bool TransactionStore::hasStoredTransaction() const {
    return _hasRecord;
}

bool TransactionStore::hasPendingTransaction() const {
    if (!_hasRecord) {
        return false;
    }

    return _lastRecord.status == Status::CREATED ||
           _lastRecord.status == Status::DISPENSING;
}

bool TransactionStore::clear() {
    if (!_ready) {
        return false;
    }

    _preferences.clear();
    resetLocalRecord();

    Serial.println("[TransactionStore] Mémoire transactionnelle effacée.");

    return true;
}

void TransactionStore::printLastTransaction() {
    if (!_hasRecord) {
        Serial.println("[TransactionStore] Aucune transaction à afficher.");
        return;
    }

    Serial.println("----------------------------------------------");
    Serial.println("[TransactionStore] Dernière transaction locale :");

    Serial.print("Transaction ID : ");
    Serial.println(_lastRecord.transactionId);

    Serial.print("Source         : ");
    Serial.println(_lastRecord.source);

    Serial.print("Montant        : ");
    Serial.print(_lastRecord.amountFcfa);
    Serial.println(" FCFA");

    Serial.print("Statut         : ");
    Serial.println(statusToString(_lastRecord.status));

    Serial.print("Updated at ms  : ");
    Serial.println(_lastRecord.updatedAtMs);

    Serial.println("----------------------------------------------");
}

const char* TransactionStore::statusToString(Status status) {
    switch (status) {
        case Status::EMPTY:
            return "EMPTY";

        case Status::CREATED:
            return "CREATED";

        case Status::DISPENSING:
            return "DISPENSING";

        case Status::SUCCESS:
            return "SUCCESS";

        case Status::FAILED:
            return "FAILED";

        default:
            return "UNKNOWN";
    }
}

void TransactionStore::resetLocalRecord() {
    _lastRecord.transactionId[0] = '\0';
    _lastRecord.source[0] = '\0';
    _lastRecord.amountFcfa = 0;
    _lastRecord.status = Status::EMPTY;
    _lastRecord.updatedAtMs = 0;

    _hasRecord = false;
}

void TransactionStore::loadFromPreferences() {
    _hasRecord = _preferences.getBool("has", false);

    if (!_hasRecord) {
        resetLocalRecord();
        return;
    }

    String transactionId = _preferences.getString("txid", "");
    String source = _preferences.getString("src", "");

    copySafe(
        _lastRecord.transactionId,
        sizeof(_lastRecord.transactionId),
        transactionId.c_str()
    );

    copySafe(
        _lastRecord.source,
        sizeof(_lastRecord.source),
        source.c_str()
    );

    _lastRecord.amountFcfa = _preferences.getUInt("amount", 0);
    _lastRecord.status = static_cast<Status>(_preferences.getUChar("status", 0));
    _lastRecord.updatedAtMs = _preferences.getULong("updated", 0);
}

bool TransactionStore::writeToPreferences() {
    if (!_ready) {
        return false;
    }

    _preferences.putBool("has", _hasRecord);
    _preferences.putString("txid", _lastRecord.transactionId);
    _preferences.putString("src", _lastRecord.source);
    _preferences.putUInt("amount", _lastRecord.amountFcfa);
    _preferences.putUChar("status", static_cast<uint8_t>(_lastRecord.status));
    _preferences.putULong("updated", _lastRecord.updatedAtMs);

    return true;
}

void TransactionStore::copySafe(
    char* destination,
    size_t destinationSize,
    const char* source
) {
    if (destination == nullptr || destinationSize == 0) {
        return;
    }

    if (source == nullptr) {
        destination[0] = '\0';
        return;
    }

    strncpy(destination, source, destinationSize - 1);
    destination[destinationSize - 1] = '\0';
}