require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const partnerRoutes = require("./routes/partnerRoutes");
const providerRoutes = require("./routes/providerRoutes");
const teamRoutes = require("./routes/teamRoutes");
const formRoutes = require("./routes/formRoutes");
const app = express();
const CSP_CONFIG = require("./config/csp");

// security + middleware
app.use(helmet(CSP_CONFIG));

//Lock down CORS to only accept GET/POST between the domain
app.use(cors({ 
    origin: process.env.ALLOWED_ORIGIN, 
    methods: ["GET", "POST"] 
}));
app.use(express.json());
app.use(morgan("dev"));
// any routes inside the corresponding routes will be prefixed with "/api/*"
app.use("/api/partners", partnerRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/form", formRoutes);

// serve frontend (your old Google HTML will go here later)
app.use(express.static(path.join(__dirname, "../public")));

// health check
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        project: "mmconsultingagency 🚀"
    });
});

module.exports = app;
