'use strict';

// Strictly limit database pool in serverless Lambda to prevent max_client_conn exhaustion
process.env.NETLIFY = 'true';
process.env.PGPOOL_MAX = '1';
process.env.PGPOOL_MIN = '0';
process.env.PGPOOL_IDLE_TIMEOUT = '1000';

/**
 * TRIPAL ERP — Netlify Serverless Function Entry Point
 *
 * Bridges the Express application to AWS Lambda / Netlify Functions runtime
 * via `serverless-http`. Reuses the Layerbase PostgreSQL connection pool
 * across warm Lambda invocations.
 */

const serverless = require('serverless-http');
const { app } = require('../../server/index');
const { init: initDb } = require('../../server/db/index');

let isInitialized = false;

// Configure serverless-http with request path transformation
const serverlessHandler = serverless(app, {
  request: (req, event) => {
    // Preserve query parameters: req.url from serverless-http includes query string e.g. "/.netlify/functions/api/path?param=val"
    let [path, search] = (req.url || '').split('?');
    if (!path && event.path) {
      path = event.path;
    }
    if (path.startsWith('/.netlify/functions/api')) {
      path = path.replace('/.netlify/functions/api', '/api');
    }
    if (!path.startsWith('/api')) {
      path = '/api' + (path.startsWith('/') ? path : '/' + path);
    }

    // Retain query parameters from req.url, or fallback to event.rawQuery / event.queryStringParameters
    if (!search) {
      if (event.rawQuery) {
        search = event.rawQuery;
      } else if (event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0) {
        search = new URLSearchParams(event.queryStringParameters).toString();
      }
    }

    req.url = search ? `${path}?${search}` : path;
  }
});

exports.handler = async (event, context) => {
  // CRITICAL FOR SERVERLESS POSTGRESQL:
  // Prevents Lambda / Netlify Function from waiting for idle connection pool sockets
  // to close before returning the HTTP response.
  context.callbackWaitsForEmptyEventLoop = false;

  // Initialize Layerbase PostgreSQL pool once per container cold-start
  if (!isInitialized) {
    try {
      await initDb();
      isInitialized = true;
    } catch (err) {
      console.error('[Netlify Function] Database initialization error:', err.message);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Database connection failed. Verify DATABASE_URL in Netlify Environment Variables.'
        })
      };
    }
  }

  return serverlessHandler(event, context);
};
