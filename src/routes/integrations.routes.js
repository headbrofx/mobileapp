'use strict';

const { Router } = require('express');
const webhook = require('../controllers/transportWebhook.controller');

// Machine-to-machine callbacks. No user token: each route proves who is
// calling with its own signature check.
const router = Router();

router.post('/transport/webhook', webhook.receive);

module.exports = router;
