'use strict';

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
    // Netlify Functions receives event.path e.g. "/.netlify/functions/api/auth/login" or "/api/auth/login"
    let p = event.path || req.url || '';
    if (p.startsWith('/.netlify/functions/api')) {
      p = p.replace('/.netlify/functions/api', '/api');
    }
    if (!p.startsWith('/api')) {
      p = '/api' + (p.startsWith('/') ? p : '/' + p);
    }
    req.url = p;
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
