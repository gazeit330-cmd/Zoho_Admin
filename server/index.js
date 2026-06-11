/*
Copyright (c) 2017, ZOHO CORPORATION
License: MIT
*/

const portfinder = require('portfinder');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const errorHandler = require('errorhandler');
const morgan = require('morgan');
const serveIndex = require('serve-index');
const https = require('https');
const chalk = require('chalk');
const axios = require('axios');

require('dotenv').config();

process.env.PWD = process.env.PWD || process.cwd();

const expressApp = express();

expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: false }));

/* =====================================
   ZOHO ACCESS TOKEN FUNCTION
===================================== */

async function getAccessToken() {
    try {

        const response = await axios.post(
            "https://accounts.zoho.in/oauth/v2/token",
            null,
            {
                params: {
                    refresh_token: process.env.REFRESH_TOKEN,
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: "refresh_token"
                }
            }
        );

        return response.data.access_token;

    } catch (error) {

        console.log("Token Error:");
        console.log(error.response?.data);

    }
}

/* =====================================
   CREATE ITEM IN ZOHO BOOKS
===================================== */

expressApp.post('/create-item', async (req, res) => {
  console.log("BODY =", req.body);

    try {

        console.log("Received Data:", req.body);

        const accessToken = await getAccessToken();

        console.log("Access Token:", accessToken);

        const response = await axios.post(
            `https://www.zohoapis.in/books/v3/items?organization_id=${process.env.ORGANIZATION_ID}`,
            {
                name: req.body.item_name,
                sku: req.body.sku,
                rate: req.body.rate,
                description: req.body.description
            },
            {
                headers: {
                    Authorization: `Zoho-oauthtoken ${accessToken}`
                }
            }
        );

        console.log("Zoho Response:", response.data);

        res.json(response.data);

    } catch (error) {

        console.log("ZOHO ERROR:");
        console.log(error.response?.data || error.message);

        res.status(500).json(error.response?.data || error.message);
    }
});

/* =====================================
   SERVER CONFIG
===================================== */

const portPromise = portfinder.getPortPromise({
    startPort: 5000,
    port: 5000,
    stopPort: 5009
});

portPromise.then((port) => {

    expressApp.set('port', port);

    expressApp.use(morgan('dev'));
   
    expressApp.use(errorHandler());

    expressApp.use('/', function (req, res, next) {

        res.setHeader('Access-Control-Allow-Origin', '*');

        let connectSrc = "";

        let manifest = fs.readFileSync(
            path.join(__dirname, "..", "plugin-manifest.json")
        ).toString();

        manifest = JSON.parse(manifest);

        if (
            manifest &&
            manifest.cspDomains &&
            manifest.cspDomains["connect-src"]
        ) {

            let connectDomains =
                manifest.cspDomains["connect-src"];

            if (validateDomains(connectDomains)) {

                console.log(
                    chalk.bold.red(
                        connectDomains +
                        " - found to be invalid URL(s) in connect-src"
                    )
                );

                next();
                return false;
            }

            connectSrc = connectDomains.join(" ");
        }

        res.setHeader(
            'Content-Security-Policy',
            'connect-src https://*.zohostatic.com https://*.sigmausercontent.com ' +
            connectSrc
        );

        next();
    });

    expressApp.get('/plugin-manifest.json', function (req, res) {
        res.sendFile(
            path.join(__dirname, "..", "plugin-manifest.json")
        );
    });

    expressApp.use('/app', express.static('app'));
    expressApp.use('/app', serveIndex('app'));

    expressApp.get('/', function (req, res) {
        res.redirect('/app');
    });

    const options = {
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem')
    };

    https.createServer(options, expressApp)
        .listen(port, function () {

            console.log(
                chalk.green(
                    'Zet running at https://127.0.0.1:' + port
                )
            );

            console.log(
                chalk.bold.cyan(
                    'Enable host: https://127.0.0.1:' +
                    port +
                    ' and click Advanced → Proceed'
                )
            );
        })
        .on('error', function (err) {

            if (err.code === 'EADDRINUSE') {

                console.log(
                    chalk.bold.red(
                        port + ' port is already in use'
                    )
                );
            }
        });

});

/* =====================================
   HELPERS
===================================== */

function validateDomains(domainsList) {

    const invalidURLs = domainsList.filter(function (domain) {
        return !isValidURL(domain);
    });

    return invalidURLs && invalidURLs.length > 0;
}

function isValidURL(url) {

    try {

        const parsedURL = new URL(url);

        if (
            parsedURL.protocol !== 'http:' &&
            parsedURL.protocol !== 'https:' &&
            parsedURL.protocol !== 'wss:'
        ) {
            return false;
        }

    } catch (e) {

        return false;
    }

    return true;
}