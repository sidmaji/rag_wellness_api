const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const queryRoute = require("./query");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/query", queryRoute);

module.exports = app;
module.exports.handler = serverless(app); // Vercel uses this
