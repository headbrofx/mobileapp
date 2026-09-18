'use strict';

// What each endpoint is for and who may call it — the part of the API
// documentation a machine cannot work out for itself. The route list
// itself comes from the Express router (see openapi.js), so this file
// only has to stay honest about intent, not about what exists.
//
// `roles` is the RBAC guard on the route. Omitted means any signed-in
// user. `auth: false` means no token needed at all.

module.exports = {
  // --- Service ---
  'GET /': { tag: 'Service', summary: 'API name and status', auth: false },
  'GET /api/health': {
    tag: 'Service',
    summary: 'Liveness check',
    description: 'Never touches the database, so a database blip does not restart a healthy process.',
    auth: false,
  },
  'GET /api/health/db': {
    tag: 'Service',
    summary: 'Readiness check',
    description: 'Confirms Postgres is actually reachable. 503 when it is not.',
    auth: false,
  },

  'GET /privacy': {
    tag: 'Service',
    summary: 'Privacy policy',
    description: 'Served from the API because Google Play requires a public policy URL for a health app.',
    auth: false,
  },

  // --- Auth ---
  'POST /api/auth/register': { tag: 'Auth', summary: 'Create a client account', auth: false },
  'POST /api/auth/login': { tag: 'Auth', summary: 'Sign in and receive tokens', auth: false },
  'POST /api/auth/google': {
    tag: 'Auth',
    summary: 'Sign in with a Google ID token',
    description:
      'Send { idToken }. A known Google account, or one whose verified email already has an account here, signs in straight away. A new one comes back 409 PHONE_REQUIRED with the email and name — call again with { idToken, phone } to finish. The number is required because it is how a nurse is sent to the right house.',
    auth: false,
  },
  'POST /api/auth/refresh': {
    tag: 'Auth',
    summary: 'Exchange a refresh token for a new pair',
    description: 'Refresh tokens rotate. Reusing an old one revokes the whole session family.',
    auth: false,
  },
  'POST /api/auth/logout': { tag: 'Auth', summary: 'Revoke this session' },
  'POST /api/auth/logout-all': { tag: 'Auth', summary: 'Revoke every session for this account' },
  'GET /api/auth/me': { tag: 'Auth', summary: 'The signed-in user' },
  'GET /api/auth/sessions': { tag: 'Auth', summary: 'List active sessions' },
  'DELETE /api/auth/sessions/:id': { tag: 'Auth', summary: 'Revoke one session' },
  'POST /api/auth/password/forgot': { tag: 'Auth', summary: 'Request a password reset', auth: false },
  'POST /api/auth/password/reset': { tag: 'Auth', summary: 'Set a new password with a reset token', auth: false },
  'POST /api/auth/verify/request': { tag: 'Auth', summary: 'Request a verification code' },
  'POST /api/auth/verify/confirm': { tag: 'Auth', summary: 'Confirm a verification code' },

  // --- Family members ---
  'POST /api/family-members/': { tag: 'Family members', summary: 'Add someone to care for', roles: ['CLIENT'] },
  'GET /api/family-members/': { tag: 'Family members', summary: 'List the people you manage', roles: ['CLIENT'] },
  'GET /api/family-members/:familyMemberId': { tag: 'Family members', summary: 'One family member' },
  'PATCH /api/family-members/:familyMemberId': { tag: 'Family members', summary: 'Update a family member' },

  // --- Health record ---
  'GET /api/family-members/:familyMemberId/health-profile': { tag: 'Health', summary: 'Health profile' },
  'PUT /api/family-members/:familyMemberId/health-profile': { tag: 'Health', summary: 'Replace the health profile' },
  'POST /api/family-members/:familyMemberId/vitals': { tag: 'Health', summary: 'Record a vital sign' },
  'GET /api/family-members/:familyMemberId/vitals': { tag: 'Health', summary: 'List vitals' },
  'GET /api/family-members/:familyMemberId/vitals/:vitalId': { tag: 'Health', summary: 'One vitals entry' },
  'PATCH /api/family-members/:familyMemberId/vitals/:vitalId': { tag: 'Health', summary: 'Correct a vitals entry' },
  'DELETE /api/family-members/:familyMemberId/vitals/:vitalId': { tag: 'Health', summary: 'Remove a vitals entry' },
  'GET /api/family-members/:familyMemberId/timeline': { tag: 'Health', summary: 'Everything, in date order' },
  'GET /api/family-members/:familyMemberId/insights': { tag: 'Health', summary: 'Patterns drawn from what was logged' },

  // --- Symptoms ---
  'GET /api/symptom-catalogue/': { tag: 'Symptoms', summary: 'The known-symptom catalogue' },
  'POST /api/family-members/:familyMemberId/symptoms': {
    tag: 'Symptoms',
    summary: 'Report a symptom',
    description: 'Enriched from the catalogue and checked against the red-flag rules on the way in.',
  },
  'GET /api/family-members/:familyMemberId/symptoms': { tag: 'Symptoms', summary: 'List symptoms' },
  'GET /api/family-members/:familyMemberId/symptoms/trends': { tag: 'Symptoms', summary: 'Symptom trends over time' },
  'GET /api/family-members/:familyMemberId/symptoms/:symptomId': { tag: 'Symptoms', summary: 'One symptom' },
  'PATCH /api/family-members/:familyMemberId/symptoms/:symptomId': { tag: 'Symptoms', summary: 'Correct a symptom' },
  'DELETE /api/family-members/:familyMemberId/symptoms/:symptomId': { tag: 'Symptoms', summary: 'Remove a symptom' },

  // --- Notifications ---
  'GET /api/notifications/': {
    tag: 'Notifications',
    summary: 'Your notifications, with an unread count',
    description: 'Scoped to the signed-in user. Nothing is pushed — the app reads these when it opens.',
  },
  'POST /api/notifications/:id/read': { tag: 'Notifications', summary: 'Mark one as read' },
  'POST /api/notifications/read-all': { tag: 'Notifications', summary: 'Mark everything as read' },

  // --- Services ---
  'GET /api/services/': {
    tag: 'Bookings',
    summary: 'The service catalogue',
    description: 'Where a booking’s serviceId comes from. Inactive services are not listed.',
  },

  // --- Client profile ---
  'GET /api/client-profile/': {
    tag: 'Bookings',
    summary: 'Your own address and emergency contact',
    description:
      'Always the caller’s own profile — there is no id in the path, so there is none to swap for somebody else’s.',
    roles: ['CLIENT'],
  },
  'PATCH /api/client-profile/': {
    tag: 'Bookings',
    summary: 'Save your address and emergency contact',
    description:
      'Fields left out are left alone. Recorded in the audit trail: this says where a nurse will be sent and who gets called in a crisis.',
    roles: ['CLIENT'],
  },

  // --- Bookings ---
  'POST /api/bookings/': { tag: 'Bookings', summary: 'Request a home visit', roles: ['CLIENT'] },
  'GET /api/bookings/': { tag: 'Bookings', summary: 'List bookings, scoped to your role' },
  'GET /api/bookings/:bookingId': { tag: 'Bookings', summary: 'One booking' },
  'GET /api/bookings/:bookingId/suggested-staff': {
    tag: 'Bookings',
    summary: 'Staff who could take this visit',
    roles: ['ADMIN'],
  },
  'PATCH /api/bookings/:bookingId/assign': { tag: 'Bookings', summary: 'Assign a staff member', roles: ['ADMIN'] },
  'PATCH /api/bookings/:bookingId/accept': { tag: 'Bookings', summary: 'Staff accepts the assignment', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/reject': { tag: 'Bookings', summary: 'Staff declines, freeing it', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/on-the-way': { tag: 'Bookings', summary: 'Staff sets off', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/arrive': { tag: 'Bookings', summary: 'Staff has arrived', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/start': { tag: 'Bookings', summary: 'The visit begins', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/complete': { tag: 'Bookings', summary: 'The visit is finished', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/reschedule': { tag: 'Bookings', summary: 'Move it, clearing any assignment' },
  'PATCH /api/bookings/:bookingId/cancel': { tag: 'Bookings', summary: 'Cancel with a reason' },

  // --- Visits ---
  'POST /api/bookings/:bookingId/visit/check-in': { tag: 'Visits', summary: 'Start the clinical record', roles: ['STAFF'] },
  'PATCH /api/bookings/:bookingId/visit': {
    tag: 'Visits',
    summary: 'Record observations during the visit',
    description: 'Vitals recorded here go straight into the patient’s health record.',
    roles: ['STAFF'],
  },
  'POST /api/bookings/:bookingId/visit/check-out': { tag: 'Visits', summary: 'Close the visit', roles: ['STAFF'] },
  'GET /api/bookings/:bookingId/visit': { tag: 'Visits', summary: 'The visit record' },

  // --- Location ---
  'POST /api/bookings/:bookingId/location': {
    tag: 'Location',
    summary: 'Record a position while on the way',
    roles: ['STAFF'],
  },
  'GET /api/bookings/:bookingId/location': {
    tag: 'Location',
    summary: 'Where the nurse is, with distance and ETA',
    description: 'Distance is haversine, not a routing API. The ETA is an estimate, not a promise.',
  },
  'GET /api/bookings/:bookingId/location/history': { tag: 'Location', summary: 'The trail of positions' },

  // --- Staff ---
  'GET /api/staff/': { tag: 'Staff', summary: 'Staff directory', roles: ['ADMIN'] },
  'GET /api/staff/me': { tag: 'Staff', summary: 'Your own staff profile', roles: ['STAFF'] },
  'PATCH /api/staff/me': { tag: 'Staff', summary: 'Update your profile and availability', roles: ['STAFF'] },
  'GET /api/staff/me/schedule': { tag: 'Staff', summary: 'Your assigned visits', roles: ['STAFF'] },
  'PATCH /api/staff/:id/approve': { tag: 'Staff', summary: 'Approve a staff registration', roles: ['ADMIN'] },
  'PATCH /api/staff/:id/reject': { tag: 'Staff', summary: 'Reject a staff registration', roles: ['ADMIN'] },

  // --- Afya AI ---
  'POST /api/ai/ask': {
    tag: 'Afya AI',
    summary: 'Ask a question',
    description:
      'The red-flag rules run first and depend on nothing. A question that trips one is answered with an emergency instruction and never from the knowledge base. Otherwise the answer is a signed-off knowledge entry returned word for word, or a refusal — never a guess.',
  },
  'GET /api/ai/history': { tag: 'Afya AI', summary: 'Your own questions and answers' },
  'GET /api/ai/knowledge': {
    tag: 'Afya AI',
    summary: 'What Afya AI may answer from',
    description: 'Admins also see entries still waiting for a professional to sign them off.',
  },
  'POST /api/ai/knowledge': { tag: 'Afya AI', summary: 'Add a knowledge entry', roles: ['ADMIN'] },
  'POST /api/ai/knowledge/:id/verify': {
    tag: 'Afya AI',
    summary: 'Professional sign-off',
    description: 'Clinical material is withheld from retrieval until this happens.',
    roles: ['ADMIN'],
  },
  'GET /api/ai/review': { tag: 'Afya AI', summary: 'Review queue, red flags first', roles: ['ADMIN'] },
  'POST /api/ai/review/:id': { tag: 'Afya AI', summary: 'Record a review verdict', roles: ['ADMIN'] },

  // --- Orbit ---
  'POST /api/family-members/:familyMemberId/cycles': { tag: 'Orbit (periods)', summary: 'Log a cycle' },
  'GET /api/family-members/:familyMemberId/cycles': { tag: 'Orbit (periods)', summary: 'List cycles' },
  'GET /api/family-members/:familyMemberId/cycles/insights': {
    tag: 'Orbit (periods)',
    summary: 'Averages, regularity and the next-start estimate',
    description:
      'Always an estimate, and says so. Confidence never reaches certain. No fertile window is returned: a calendar estimate is not reliable enough to be used as birth control.',
  },
  'GET /api/family-members/:familyMemberId/cycles/:cycleId': { tag: 'Orbit (periods)', summary: 'One cycle entry' },
  'PATCH /api/family-members/:familyMemberId/cycles/:cycleId': { tag: 'Orbit (periods)', summary: 'Correct an entry' },
  'DELETE /api/family-members/:familyMemberId/cycles/:cycleId': { tag: 'Orbit (periods)', summary: 'Remove an entry' },

  // --- Nutrition ---
  'GET /api/foods/': {
    tag: 'Nutrition',
    summary: 'Search the food catalogue',
    description: 'Tanzanian foods in household portions. Calorie figures are approximations and say so.',
  },
  'GET /api/family-members/:familyMemberId/nutrition': { tag: 'Nutrition', summary: 'Nutrition profile' },
  'PUT /api/family-members/:familyMemberId/nutrition': {
    tag: 'Nutrition',
    summary: 'Set goal, targets and restrictions',
    description: 'No calorie target is ever calculated for you. It stays null until somebody sets one on purpose.',
  },
  'GET /api/family-members/:familyMemberId/nutrition/summary': {
    tag: 'Nutrition',
    summary: 'The day, reported and not judged',
  },
  'POST /api/family-members/:familyMemberId/meals': { tag: 'Nutrition', summary: 'Log a meal' },
  'GET /api/family-members/:familyMemberId/meals': { tag: 'Nutrition', summary: 'List meals' },
  'DELETE /api/family-members/:familyMemberId/meals/:mealId': { tag: 'Nutrition', summary: 'Remove a meal' },
  'POST /api/family-members/:familyMemberId/water': { tag: 'Nutrition', summary: 'Log water' },
  'GET /api/family-members/:familyMemberId/water': { tag: 'Nutrition', summary: 'List water entries' },
  'DELETE /api/family-members/:familyMemberId/water/:waterId': { tag: 'Nutrition', summary: 'Remove a water entry' },

  // --- Fitness ---
  'GET /api/family-members/:familyMemberId/fitness': { tag: 'Fitness', summary: 'Fitness profile' },
  'PUT /api/family-members/:familyMemberId/fitness': { tag: 'Fitness', summary: 'Set goal and activity level' },
  'GET /api/family-members/:familyMemberId/fitness/summary': {
    tag: 'Fitness',
    summary: 'Weekly totals',
    description: 'Totals only. No target is returned, because published guidelines are written for healthy adults.',
  },
  'POST /api/family-members/:familyMemberId/workouts': { tag: 'Fitness', summary: 'Log a workout' },
  'GET /api/family-members/:familyMemberId/workouts': { tag: 'Fitness', summary: 'List workouts' },
  'DELETE /api/family-members/:familyMemberId/workouts/:workoutId': { tag: 'Fitness', summary: 'Remove a workout' },
  'PUT /api/family-members/:familyMemberId/activity': {
    tag: 'Fitness',
    summary: 'Record a day of steps',
    description: 'One row per date: sending the same day again corrects it rather than adding to it.',
  },
  'GET /api/family-members/:familyMemberId/activity': { tag: 'Fitness', summary: 'Daily activity history' },

  // --- Medications ---
  'POST /api/family-members/:familyMemberId/medications': {
    tag: 'Medications',
    summary: 'Record a prescription',
    description: 'Stored exactly as the prescriber wrote it. Nothing here interprets or converts a dose.',
  },
  'GET /api/family-members/:familyMemberId/medications': { tag: 'Medications', summary: 'List medicines' },
  'GET /api/family-members/:familyMemberId/medications/:medicationId': { tag: 'Medications', summary: 'One medicine' },
  'PATCH /api/family-members/:familyMemberId/medications/:medicationId': {
    tag: 'Medications',
    summary: 'Update or stop a course',
  },
  'GET /api/family-members/:familyMemberId/medications/doses': { tag: 'Medications', summary: 'Scheduled doses' },
  'GET /api/family-members/:familyMemberId/medications/due': {
    tag: 'Medications',
    summary: 'What is due soon',
    description: 'No SMS or push is sent by the server; the client app schedules its own local notifications.',
  },
  'POST /api/family-members/:familyMemberId/medications/doses/:doseId': {
    tag: 'Medications',
    summary: 'Mark a dose taken, missed or skipped',
  },
  'GET /api/family-members/:familyMemberId/medications/adherence': {
    tag: 'Medications',
    summary: 'Adherence, broken down per medicine',
  },

  // --- Content ---
  'GET /api/content/': { tag: 'Content', summary: 'Published articles, podcasts and news' },
  'GET /api/content/categories': { tag: 'Content', summary: 'Categories' },
  'POST /api/content/categories': { tag: 'Content', summary: 'Create a category', roles: ['ADMIN'] },
  'POST /api/content/': { tag: 'Content', summary: 'Create a draft', roles: ['ADMIN'] },
  'PATCH /api/content/:id': { tag: 'Content', summary: 'Edit', roles: ['ADMIN'] },
  'POST /api/content/:id/publish': { tag: 'Content', summary: 'Publish', roles: ['ADMIN'] },
  'POST /api/content/:id/unpublish': { tag: 'Content', summary: 'Return to draft', roles: ['ADMIN'] },
  'GET /api/content/:slug': {
    tag: 'Content',
    summary: 'One piece by slug',
    description: 'A draft reads as 404 to a client, so unpublished titles cannot be found by guessing.',
  },

  // --- Billing ---
  'POST /api/invoices/': {
    tag: 'Billing',
    summary: 'Raise an invoice',
    description: 'The total is computed from the line items. An amount sent by the caller is discarded.',
    roles: ['ADMIN', 'STAFF'],
  },
  'GET /api/invoices/': { tag: 'Billing', summary: 'List invoices, scoped to your role' },
  'GET /api/invoices/outstanding': { tag: 'Billing', summary: 'What is owed and overdue', roles: ['ADMIN'] },
  'GET /api/invoices/:id': { tag: 'Billing', summary: 'One invoice, with items and payments' },
  'POST /api/invoices/:id/issue': { tag: 'Billing', summary: 'Issue a draft', roles: ['ADMIN', 'STAFF'] },
  'POST /api/invoices/:id/cancel': {
    tag: 'Billing',
    summary: 'Cancel',
    description: 'Refused once any payment has been recorded against it.',
    roles: ['ADMIN'],
  },
  'POST /api/invoices/:id/payments': {
    tag: 'Billing',
    summary: 'Record money received',
    description:
      'Keyed by a person, not confirmed by a provider: gatewayConfirmed is always false. A payment larger than the balance is refused.',
    roles: ['ADMIN', 'STAFF'],
  },

  // --- Admin ---
  'GET /api/admin/dashboard': { tag: 'Admin', summary: 'The morning picture', roles: ['ADMIN'] },
  'GET /api/admin/analytics': {
    tag: 'Admin',
    summary: 'Business and service analytics',
    description: 'Aggregates only. Health breakdowns below five are withheld so no row can point at one household.',
    roles: ['ADMIN'],
  },
  'GET /api/admin/audit-logs': { tag: 'Admin', summary: 'Audit trail', roles: ['ADMIN'] },
  'GET /api/admin/users': { tag: 'Admin', summary: 'List and search accounts', roles: ['ADMIN'] },
  'PATCH /api/admin/users/:id/status': {
    tag: 'Admin',
    summary: 'Suspend or reactivate an account',
    description: 'Accounts are suspended, never deleted. An admin cannot change their own.',
    roles: ['ADMIN'],
  },
  'PATCH /api/admin/users/:id/role': {
    tag: 'Admin',
    summary: 'Change a role',
    description:
      'The most sensitive endpoint here: audited, and an admin cannot point it at themselves. The first admin is made with `npm run make-admin`.',
    roles: ['ADMIN'],
  },
  'GET /api/admin/staff': { tag: 'Admin', summary: 'Staff roster with approval state', roles: ['ADMIN'] },
  'GET /api/admin/bookings': { tag: 'Admin', summary: 'All bookings, filterable', roles: ['ADMIN'] },

  // --- Docs ---
  'GET /api/docs.json': { tag: 'Service', summary: 'This OpenAPI document', auth: false },
  'GET /api/docs': { tag: 'Service', summary: 'Browsable API reference', auth: false },
};
