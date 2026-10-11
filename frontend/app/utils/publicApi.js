"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// utils/publicApi.ts
var axios_1 = require("axios");
var API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
var publicApi = axios_1.default.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json", // default for JSON
    },
});
// Handle FormData correctly by removing Content-Type header
// (browser will set it with correct boundary)
publicApi.interceptors.request.use(function (config) {
    if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
    }
    return config;
});
exports.default = publicApi;
