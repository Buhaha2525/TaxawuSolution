const express = require('express');
const cors = require('cors');

const app = express();

/* =====================================
   MIDDLEWARES
===================================== */

app.use(cors());

app.use(express.json());

/* =====================================
   ROUTE TEST
===================================== */

app.get('/', (req, res) => {

    res.json({
        success: true,
        message: 'Backend paiement opérationnel'
    });

});
const dashboardRoutes = require("./routes/dashboard.routes");
const orangeRoutes = require("./routes/orange.routes");

app.use("/api/dashboard", dashboardRoutes);
app.use("/api/orange", orangeRoutes);


/* =====================================
   EXPORT
===================================== */

module.exports = app;