'use strict';

const AppError = require('../utils/appError');

// The transport lifecycle.
//
//   REQUESTED --review--> UNDER_REVIEW --quote--> QUOTED --acceptQuote--> ACCEPTED
//       |                      |                    |                        |
//       +-------quote----------+                declineQuote               assign
//                                                   v                        v
//                                               CANCELLED                ASSIGNED
//                                                                            |
//                     enRoute -> EN_ROUTE -> arrivedPickup -> ARRIVED_PICKUP
//                     startTrip -> IN_TRIP -> arrivedDestination -> ARRIVED_DESTINATION
//                     complete -> COMPLETED
//
// A fare is always quoted by a person (or a partner's real quote) and
// accepted by the client before anything is booked. Nothing moves to
// ASSIGNED on a price the client has not seen.
//
// reject   (dispatcher)  from REQUESTED / UNDER_REVIEW / QUOTED
// cancel   (client/admin) from anything before the vehicle is moving
// fail     (dispatcher)  from ASSIGNED onwards, before completion
// expire   (system)      when nobody acted before the pickup time
const ALLOWED_FROM = {
  review: ['REQUESTED'],
  quote: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED'],
  acceptQuote: ['QUOTED'],
  declineQuote: ['QUOTED'],
  reject: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED'],
  assign: ['ACCEPTED', 'ASSIGNED'],
  enRoute: ['ASSIGNED'],
  arrivedPickup: ['EN_ROUTE'],
  startTrip: ['ARRIVED_PICKUP'],
  arrivedDestination: ['IN_TRIP'],
  complete: ['ARRIVED_DESTINATION'],
  cancel: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED', 'ASSIGNED'],
  fail: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED_PICKUP', 'IN_TRIP'],
  expire: ['REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'ACCEPTED'],
};

const TARGET_STATUS = {
  review: 'UNDER_REVIEW',
  quote: 'QUOTED',
  acceptQuote: 'ACCEPTED',
  declineQuote: 'CANCELLED',
  reject: 'REJECTED',
  assign: 'ASSIGNED',
  enRoute: 'EN_ROUTE',
  arrivedPickup: 'ARRIVED_PICKUP',
  startTrip: 'IN_TRIP',
  arrivedDestination: 'ARRIVED_DESTINATION',
  complete: 'COMPLETED',
  cancel: 'CANCELLED',
  fail: 'FAILED',
  expire: 'EXPIRED',
};

// The trip-progress actions, which the driver (if one of our staff)
// may perform as well as a dispatcher. Also the vocabulary a partner
// webhook is translated into.
const PROGRESS_ACTIONS = ['enRoute', 'arrivedPickup', 'startTrip', 'arrivedDestination', 'complete'];

const STATUS_TO_PROGRESS_ACTION = {
  EN_ROUTE: 'enRoute',
  ARRIVED_PICKUP: 'arrivedPickup',
  IN_TRIP: 'startTrip',
  ARRIVED_DESTINATION: 'arrivedDestination',
  COMPLETED: 'complete',
  CANCELLED: 'cancel',
  FAILED: 'fail',
};

const TERMINAL = ['COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED', 'EXPIRED'];

function assertTransition(trip, action) {
  const allowedFrom = ALLOWED_FROM[action];
  if (!allowedFrom || !allowedFrom.includes(trip.status)) {
    throw AppError.conflict(`Cannot ${action} a transport request currently in status ${trip.status}`);
  }
  return TARGET_STATUS[action];
}

module.exports = { ALLOWED_FROM, TARGET_STATUS, PROGRESS_ACTIONS, STATUS_TO_PROGRESS_ACTION, TERMINAL, assertTransition };
