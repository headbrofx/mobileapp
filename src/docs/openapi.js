'use strict';

// The OpenAPI document is built by walking the Express router rather
// than being written out by hand.
//
// Hand-written API docs drift the moment somebody adds a route and
// forgets the YAML, and drifted docs are worse than none — a mobile
// developer trusts them and loses an afternoon. Here the route list
// comes from the app itself, so it cannot be wrong about what exists.
// What is written by hand is the part a machine cannot know: what each
// endpoint is for, and who is allowed to call it. A test fails the
// build if any route is missing a description.

const DESCRIPTIONS = require('./descriptions');

const ENVELOPE_SUCCESS = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [true] },
    message: { type: 'string' },
    data: { nullable: true },
  },
  required: ['success', 'message'],
};

const ENVELOPE_ERROR = {
  type: 'object',
  properties: {
    success: { type: 'boolean', enum: [false] },
    message: { type: 'string' },
    code: { type: 'string', example: 'UNAUTHORIZED' },
    errors: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: { field: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
  required: ['success', 'message', 'code'],
};

function prefixOf(layer) {
  if (!layer.regexp) return '';
  let src = layer.regexp.source;
  if (src === '^\\/?$' || src === '^\\/?(?=\\/|$)') return '';
  return src
    .replace('^', '')
    .replace('\\/?(?=\\/|$)', '')
    .replace('(?:\\/(?=$))?$', '')
    .replace(/\\\//g, '/')
    .replace(/\$$/, '');
}

// Express writes parameters as :name; OpenAPI wants {name}.
function toOpenApiPath(path) {
  const normalised = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
  return normalised.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function collectRoutes(app) {
  const found = [];

  function walk(stack, prefix) {
    for (const layer of stack) {
      if (layer.route) {
        const path = prefix + layer.route.path;
        for (const method of Object.keys(layer.route.methods)) {
          found.push({ method: method.toUpperCase(), path });
        }
      } else if (layer.handle && layer.handle.stack) {
        walk(layer.handle.stack, prefix + prefixOf(layer));
      }
    }
  }

  walk((app._router || app.router).stack, '');

  const seen = new Set();
  return found.filter((route) => {
    const key = `${route.method} ${route.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pathParameters(path) {
  const names = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string', format: name.toLowerCase().includes('id') ? 'uuid' : undefined },
  }));
}

function build(app) {
  const routes = collectRoutes(app);
  const paths = {};
  const undocumented = [];

  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    const meta = DESCRIPTIONS[key];

    if (!meta) {
      undocumented.push(key);
      continue;
    }

    const openApiPath = toOpenApiPath(route.path);
    paths[openApiPath] = paths[openApiPath] || {};

    const responses = {
      200: { description: 'Success', content: { 'application/json': { schema: ENVELOPE_SUCCESS } } },
      400: { description: 'Validation failed', content: { 'application/json': { schema: ENVELOPE_ERROR } } },
    };

    if (meta.auth !== false) {
      responses[401] = {
        description: 'Missing or invalid token',
        content: { 'application/json': { schema: ENVELOPE_ERROR } },
      };
    }
    if (meta.roles) {
      responses[403] = {
        description: `Requires one of: ${meta.roles.join(', ')}`,
        content: { 'application/json': { schema: ENVELOPE_ERROR } },
      };
    }

    paths[openApiPath][route.method.toLowerCase()] = {
      tags: [meta.tag],
      summary: meta.summary,
      description: meta.description || undefined,
      security: meta.auth === false ? [] : [{ bearerAuth: [] }],
      parameters: pathParameters(route.path),
      responses,
    };
  }

  return {
    document: {
      openapi: '3.0.3',
      info: {
        title: 'Afya Nyumbani API',
        version: require('../../package.json').version,
        description: [
          'Backend for the Afya Nyumbani home-care platform, Dar es Salaam.',
          '',
          'Every response uses the same envelope: `{ success, message, data }`',
          'on the way out, and `{ success, message, code, errors }` when',
          'something is wrong.',
          '',
          'Authentication is a bearer access token from `POST /api/auth/login`.',
          'Access tokens are short-lived; use `POST /api/auth/refresh` with a',
          'refresh token to get another.',
          '',
          'Health data belongs to a **FamilyMember**, never to a User: a client',
          'may be managing care for a parent or a child, so most health',
          'endpoints hang off `/api/family-members/{familyMemberId}/...` and',
          'that member has to belong to the caller.',
        ].join('\n'),
      },
      servers: [
        { url: 'https://afya-nyumbani-api.onrender.com', description: 'Production' },
        { url: 'http://localhost:4000', description: 'Local' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: { SuccessEnvelope: ENVELOPE_SUCCESS, ErrorEnvelope: ENVELOPE_ERROR },
      },
      security: [{ bearerAuth: [] }],
      paths,
    },
    routes,
    undocumented,
  };
}

module.exports = { build, collectRoutes, toOpenApiPath };
