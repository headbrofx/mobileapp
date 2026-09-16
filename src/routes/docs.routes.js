'use strict';

const { Router } = require('express');

const router = Router();

// The document is built from the live router on first request and kept,
// so a mobile developer reading it cannot be looking at something the
// server no longer does.
let cached = null;

function document(req) {
  if (!cached) {
    // Required lazily: openapi.js walks the app's router, and the app is
    // still being assembled while this module is being loaded.
    const { build } = require('../docs/openapi');
    cached = build(req.app).document;
  }
  return cached;
}

router.get('/docs.json', (req, res) => res.json(document(req)));

// A plain reference page. Swagger UI is loaded from a CDN rather than
// vendored, because the alternative is committing a megabyte of
// third-party JavaScript into a repository that is otherwise readable.
router.get('/docs', (req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Afya Nyumbani API</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css">
  <style>body { margin: 0; } .topbar { display: none; }</style>
</head>
<body>
  <div id="ui"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: '/api/docs.json', dom_id: '#ui', deepLinking: true });
  </script>
</body>
</html>`);
});

module.exports = router;
