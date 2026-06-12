const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const axios = require('axios');

require('dotenv').config();

const expressApp = express();

expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: false }));
expressApp.use(morgan('dev'));
expressApp.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Serve static app files
expressApp.use('/app', express.static(path.join(__dirname, '../app')));
expressApp.get('/', (req, res) => res.redirect('/app'));

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
    console.log("Token Error:", error.response?.data);
  }
}

/* =====================================
   CREATE ITEM IN ZOHO BOOKS
===================================== */
expressApp.post('/create-item', async (req, res) => {
  try {
    console.log("Received Data:", req.body);
    const accessToken = await getAccessToken();
    const response = await axios.post(
      `https://www.zohoapis.in/books/v3/items?organization_id=${process.env.ORGANIZATION_ID}`,
      {
        name: req.body.item_name,
        sku: req.body.sku,
        rate: req.body.rate,
        description: req.body.description
      },
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.log("ZOHO ERROR:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || error.message);
  }
});


expressApp.get('/get-items', async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    const response = await axios.get(
      `https://www.zohoapis.in/books/v3/items?organization_id=${process.env.ORGANIZATION_ID}`,
      {
        headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
      }
    );
    res.json(response.data);
  } catch (error) {
    console.log("Error fetching items:", error.response?.data || error.message);
    res.status(500).json(error.response?.data || error.message);
  }
});



/* =====================================
   START SERVER (Railway compatible)
===================================== */
const port = process.env.PORT || 5000;
expressApp.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});