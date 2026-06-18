const waveService = require("./wave.service");
const mqttService = require("./mqtt.service");

exports.processPayment = async (montant, numero, provider) => {

    const payment = await waveService.createPayment(montant, numero);

    if (payment.status === "success") {

        mqttService.sendCommandToMachine({
            action: "DELIVER_PRODUCT",
            montant,
            numero
        });
    }

    return payment;
};