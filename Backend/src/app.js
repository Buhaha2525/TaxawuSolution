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
        message: 'Backend Wave opérationnel'
    });

});
const dashboardRoutes = require("./routes/dashboard.routes");

app.use("/api/dashboard", dashboardRoutes);


/* =====================================
   EXPORT
===================================== */

module.exports = app;